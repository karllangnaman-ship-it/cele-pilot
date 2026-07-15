import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  setDoc as firestoreSetDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { auth, db, storage, googleProvider } from '@/firebase';

const normalizeUser = (user) => {
  if (!user) return null;
  return {
    id: user.uid,
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
};

const getUserCollectionRef = (uid, collectionName) => collection(db, 'users', uid, collectionName);
const getUserDocRef = (uid, collectionName, docId) => doc(db, 'users', uid, collectionName, docId);

const getUserId = async (providedId = null) => {
  if (providedId) return providedId;
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  throw new Error('Authentication required');
};

const getEntityApi = (collectionName) => ({
  async filter(filters = {}) {
    const uid = await getUserId(filters.user_id);
    const constraints = [];
    Object.entries(filters).forEach(([field, value]) => {
      if (field !== 'user_id' && value !== undefined && value !== null) {
        constraints.push(where(field, '==', value));
      }
    });
    const q = query(getUserCollectionRef(uid, collectionName), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  },
  async create(data) {
    const uid = await getUserId(data.user_id);
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const refDoc = doc(getUserCollectionRef(uid, collectionName));
    await firestoreSetDoc(refDoc, payload);
    return { ...payload, id: refDoc.id };
  },
  async update(id, updates) {
    const uid = await getUserId();
    const refDoc = getUserDocRef(uid, collectionName, id);
    const payload = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(refDoc, payload);
    return { id, ...payload };
  },
  async delete(id) {
    const uid = await getUserId();
    const refDoc = getUserDocRef(uid, collectionName, id);
    await deleteDoc(refDoc);
    return true;
  },
  async bulkCreate(items) {
    const uid = await getUserId(items?.[0]?.user_id ?? null);
    const batch = writeBatch(db);
    const created = [];
    items.forEach((item) => {
      const refDoc = doc(getUserCollectionRef(uid, collectionName));
      const payload = {
        ...item,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(refDoc, payload);
      created.push({ ...payload, id: refDoc.id });
    });
    await batch.commit();
    return created;
  },
});

const buildEntityMap = () => ({
  SurveyProfile: getEntityApi('surveyProfiles'),
  StudyTask: getEntityApi('studyTasks'),
  StudyNote: getEntityApi('studyNotes'),
  Flashcard: getEntityApi('flashcards'),
  UserFile: getEntityApi('userFiles'),
  Achievement: getEntityApi('achievements'),
  UserSettings: getEntityApi('userSettings'),
  TimerState: getEntityApi('timerStates'),
  TimerHistory: getEntityApi('timerHistories'),
});

const getGeminiErrorMessage = async (response) => {
  try {
    const errorData = await response.json();
    const message = errorData?.error?.message || errorData?.error || 'Unable to reach Gemini';
    if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
      return 'Gemini is currently unavailable because the API quota has been exceeded. Please try again later.';
    }
    if (message.includes('API key')) {
      return 'Gemini API key is invalid or missing.';
    }
    return message;
  } catch {
    return 'Unable to reach Gemini';
  }
};

const invokeGemini = async ({ prompt, file_urls = [], response_json_schema }) => {
  const systemPrompt = 'You are a helpful CELE study planner. Return valid JSON only when requested.';
  const userPrompt = file_urls.length > 0 ? `${prompt}\n\nAdditional file references:\n${file_urls.join('\n')}` : prompt;

  const payload = {
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    stream: false,
  };

  if (response_json_schema) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('/api/generatePlan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await getGeminiErrorMessage(response);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (!data?.success) throw new Error(data?.error || 'Gemini did not return a plan.');
  return data.plan || {};
};

const coreIntegrations = {
  async UploadFile({ file }) {
    const uid = await getUserId();
    const storagePath = `users/${uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        () => {},
        reject,
        resolve
      );
    });
    const file_url = await getDownloadURL(storageRef);
    return { file_url, path: storagePath };
  },
  async ExtractDataFromUploadedFile({ file_url, json_schema }) {
    const response = await fetch(file_url);
    const contentText = await response.text();
    return invokeGemini({
      prompt: `Extract structured data from the provided file content. Return valid JSON matching the requested schema.\n\nContent:\n${contentText}`,
      response_json_schema: json_schema,
    });
  },
  async TranscribeAudio({ audio_url }) {
    return invokeGemini({
      prompt: `Transcribe the supplied audio content into text. Return only the transcription.\n\nAudio URL: ${audio_url}`,
    });
  },
  async InvokeLLM({ prompt, response_json_schema, file_urls = [] }) {
    return invokeGemini({ prompt, file_urls, response_json_schema });
  },
};

export const firebaseApi = {
  auth: {
    me: async () => {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      return normalizeUser(user);
    },
    loginViaEmailPassword: async (email, password) => {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return normalizeUser(credential.user);
    },
    register: async ({ email, password }) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
      }
      return normalizeUser(credential.user);
    },
    verifyOtp: async () => ({ access_token: 'firebase' }),
    resendOtp: async () => true,
    setToken: () => true,
    resetPasswordRequest: async (email) => {
      await sendPasswordResetEmail(auth, email);
      return true;
    },
    resetPassword: async ({ resetToken, newPassword }) => {
      if (!resetToken) throw new Error('Reset token is missing');
      await confirmPasswordReset(auth, resetToken, newPassword);
      return true;
    },
    loginWithProvider: async (provider, redirectTo = '/') => {
      if (provider !== 'google') throw new Error('Only Google sign-in is supported');
      const credential = await signInWithPopup(auth, googleProvider);
      if (redirectTo && typeof window !== 'undefined') {
        window.location.assign(redirectTo);
      }
      return normalizeUser(credential.user);
    },
    logout: async (redirectTo = '/login') => {
      await signOut(auth);
      if (typeof window !== 'undefined' && redirectTo) {
        window.location.assign(redirectTo);
      }
      return true;
    },
    redirectToLogin: () => {
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      }
      return true;
    },
  },
  entities: buildEntityMap(),
  integrations: {
    Core: coreIntegrations,
  },
};
