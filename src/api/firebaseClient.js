import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  sendEmailVerification,
  updateProfile,
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
import { auth, db, storage, googleProvider, firebaseInitializationError } from '@/firebase';

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

const signupLog = (step, details = {}) => {
  console.info(`[signup] ${step}`, details);
};

const initializeNewUser = async (user, displayName) => {
  signupLog('creating Firestore user profile', { uid: user.uid });
  const userRef = doc(db, 'users', user.uid);
  const settingsRef = doc(db, 'users', user.uid, 'userSettings', 'default');
  const statisticsRef = doc(db, 'users', user.uid, 'statistics', 'overview');
  const foldersRef = doc(db, 'users', user.uid, 'cloudFolders', 'root');
  const profileRef = doc(db, 'users', user.uid, 'profile', 'default');
  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(userRef, {
    uid: user.uid,
    fullName: displayName,
    displayName,
    email: user.email,
    preferences: { darkMode: true, notificationsEnabled: true, soundEnabled: true, vibrationEnabled: true },
    statistics: { studyMinutes: 0, cardsReviewed: 0, sessionsCompleted: 0 },
    cloudProfile: { rootFolder: `users/${user.uid}`, initialized: true },
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  batch.set(profileRef, { uid: user.uid, displayName, email: user.email, initialized: true, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(settingsRef, { user_id: user.uid, dark_mode: true, notifications_enabled: true, sound_enabled: true, vibration_enabled: true, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(statisticsRef, { user_id: user.uid, study_minutes: 0, cards_reviewed: 0, sessions_completed: 0, createdAt: now, updatedAt: now }, { merge: true });
  batch.set(foldersRef, { user_id: user.uid, name: 'My Files', path: `users/${user.uid}`, createdAt: now, updatedAt: now }, { merge: true });
  await batch.commit();
  signupLog('Firestore user profile created', { uid: user.uid });
};

const getUserId = async (providedId = null) => {
  const currentUid = auth.currentUser?.uid;
  if (providedId && currentUid && providedId !== currentUid) {
    throw new Error('Cannot access another user\'s data');
  }
  if (currentUid) return currentUid;
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
  Notification: getEntityApi('notifications'),
  FlashcardSession: getEntityApi('flashcardSessions'),
  // One immutable coaching snapshot per generated day.  Keeping these separate
  // from tasks lets the next plan learn from history even after a regeneration.
  DailyAISchedule: getEntityApi('dailyAiSchedules'),
  DailyReview: getEntityApi('dailyReviews'),
});

const getGeminiErrorMessage = async (response) => {
  try {
    const errorData = await response.json();
    const providerError = errorData?.error;
    if (typeof providerError === 'string') return providerError;
    if (providerError && typeof providerError === 'object') {
      return providerError.message || JSON.stringify(providerError);
    }
    return JSON.stringify(errorData);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const invokeGemini = async ({ prompt, file_urls = [], response_json_schema }) => {
  const systemPrompt = 'You are a helpful CELE study planner. Return valid JSON only when requested.';
  const userPrompt = file_urls.length > 0 ? `${prompt}\n\nAdditional file references:\n${file_urls.join('\n')}` : prompt;

  const payload = {
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
  if (!data?.success) {
    const providerError = data?.error;
    throw new Error(typeof providerError === 'string'
      ? providerError
      : providerError?.message || JSON.stringify(providerError));
  }
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
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await signOut(auth);
        const error = new Error('Please verify your email before logging in.');
        error.code = 'auth/email-not-verified';
        throw error;
      }
      return normalizeUser(credential.user);
    },
    register: async ({ name, email, password }) => {
      const cleanName = name?.trim();
      const cleanEmail = email?.trim();
      signupLog('validation started', { email: cleanEmail });
      if (!cleanName) { signupLog('validation failed', { field: 'name' }); throw new Error('Name is required.'); }
      if (!cleanEmail) { signupLog('validation failed', { field: 'email' }); throw new Error('Email is required.'); }
      if (!password || password.length < 6) { signupLog('validation failed', { field: 'password' }); throw new Error('Password must be at least 6 characters.'); }
      signupLog('Firebase initialization checked', { initialized: Boolean(auth && db), error: firebaseInitializationError || null });
      if (!auth || !db) throw new Error(firebaseInitializationError || 'Firebase Authentication or Firestore failed to initialize.');
      try {
        signupLog('creating Firebase Authentication account', { email: cleanEmail });
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        signupLog('Authentication account created', { uid: credential.user.uid });
        await updateProfile(credential.user, { displayName: cleanName });
        signupLog('display name saved', { uid: credential.user.uid });
        await initializeNewUser(credential.user, cleanName);
        signupLog('Firestore profile initialized', { uid: credential.user.uid });
        signupLog('sending Firebase email verification link', { uid: credential.user.uid });
        await sendEmailVerification(credential.user);
        signupLog('email verification link sent', { uid: credential.user.uid });
        signupLog('signup completed', { uid: credential.user.uid });
        return { ...normalizeUser(credential.user), displayName: cleanName };
      } catch (error) {
        signupLog('signup failed', { code: error?.code, message: error?.message });
        throw error;
      }
    },
    resetPasswordRequest: async (email) => {
      await sendPasswordResetEmail(auth, email);
      return true;
    },
    resendEmailVerification: async (email, password) => {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      try {
        await credential.user.reload();
        if (credential.user.emailVerified) return { alreadyVerified: true };
        await sendEmailVerification(credential.user);
        return { sent: true };
      } finally {
        await signOut(auth);
      }
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
