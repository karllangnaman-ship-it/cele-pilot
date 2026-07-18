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
  onSnapshot,
  limit,
  startAfter,
  runTransaction,
} from 'firebase/firestore';
import { auth, db, googleProvider, firebaseInitializationError } from '@/firebase';
import { supabaseStorage } from '@/services/supabaseStorage';

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
  subscribe(callback) {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    return onSnapshot(getUserCollectionRef(uid, collectionName), (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => { console.error(`Realtime ${collectionName} subscription failed.`, error); });
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
  Formula: getEntityApi('formulas'),
  FormulaFolder: getEntityApi('formulaFolders'),
  Question: getEntityApi('questions'),
  Situation: getEntityApi('situations'),
  Import: getEntityApi('imports'),
  ExamResult: getEntityApi('examResults'),
  PracticeHistory: getEntityApi('practiceHistory'),
  UserFormulaHistory: getEntityApi('userFormulaHistory'),
  UserQuestionHistory: getEntityApi('userQuestionHistory'),
  ExamHistory: getEntityApi('examHistory'),
  MistakeNotebook: getEntityApi('mistakeNotebook'),
});

// Study history deliberately has a small dedicated API instead of using the
// generic entity helper: it needs a stable document id, pagination and a live
// listener. Every operation is rooted at the authenticated user's document.
const studyHistoryQueueKey = (uid) => `cele-study-history-queue:${uid}`;
const readStudyHistoryQueue = (uid) => {
  try { return JSON.parse(localStorage.getItem(studyHistoryQueueKey(uid)) || '[]'); } catch { return []; }
};
const writeStudyHistoryQueue = (uid, records) => {
  try { localStorage.setItem(studyHistoryQueueKey(uid), JSON.stringify(records)); } catch { /* storage unavailable */ }
};
const toHistoryRecord = (item) => ({ id: item.id, ...item.data() });

const studyHistory = {
  async list() {
    const uid = await getUserId();
    const snapshot = await getDocs(getUserCollectionRef(uid, 'studyHistory'));
    return snapshot.docs.map(toHistoryRecord);
  },
  async save(record) {
    const uid = await getUserId(record.userId || record.user_id);
    const id = record.id || crypto.randomUUID();
    const payload = {
      ...record,
      id,
      userId: uid,
      // The camel-case schema is the canonical Study History schema.
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await firestoreSetDoc(getUserDocRef(uid, 'studyHistory', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const queued = readStudyHistoryQueue(uid).filter((item) => item.id !== id);
      writeStudyHistoryQueue(uid, queued);
    } catch (error) {
      console.error('Failed to save study history session; queued for retry.', error);
      // Keep one entry per id. setDoc with this same id makes subsequent syncs
      // idempotent, including after an app reload.
      const queued = readStudyHistoryQueue(uid);
      writeStudyHistoryQueue(uid, [...queued.filter((item) => item.id !== id), payload]);
      // A transient online failure is treated the same as offline. The browser
      // will retry on its next online event, with the same document id.
    }
    return payload;
  },
  async flushPending() {
    try {
      const uid = await getUserId();
      const queued = readStudyHistoryQueue(uid);
      for (const record of queued) {
        await firestoreSetDoc(getUserDocRef(uid, 'studyHistory', record.id), {
          ...record,
          userId: uid,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      writeStudyHistoryQueue(uid, []);
    } catch (error) {
      console.error('Failed to synchronize pending study history sessions.', error);
      throw error;
    }
  },
  async getPage({ pageSize = 25, cursor = null } = {}) {
    try {
      const uid = await getUserId();
      const historyRef = getUserCollectionRef(uid, 'studyHistory');
      const historyQuery = cursor
        ? query(historyRef, orderBy('startTime', 'desc'), startAfter(cursor), limit(pageSize))
        : query(historyRef, orderBy('startTime', 'desc'), limit(pageSize));
      const snapshot = await getDocs(historyQuery);
      return {
        records: snapshot.docs.map(toHistoryRecord),
        cursor: snapshot.docs.at(-1) || null,
        hasMore: snapshot.docs.length === pageSize,
      };
    } catch (error) {
      console.error('Failed to load study history page.', error);
      throw error;
    }
  },
  subscribe(callback) {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    try {
      return onSnapshot(
        query(getUserCollectionRef(uid, 'studyHistory'), orderBy('startTime', 'desc')),
        (snapshot) => callback(snapshot.docs.map(toHistoryRecord)),
        (error) => { console.error('Study history realtime subscription failed.', error); callback([]); },
      );
    } catch (error) {
      console.error('Unable to start study history realtime subscription.', error);
      return () => {};
    }
  },
  async delete(id) {
    const uid = await getUserId();
    await deleteDoc(getUserDocRef(uid, 'studyHistory', id));
    return true;
  },
  async bulkDelete(ids) {
    const uid = await getUserId();
    const batch = writeBatch(db);
    ids.forEach((id) => batch.delete(getUserDocRef(uid, 'studyHistory', id)));
    await batch.commit();
    return true;
  },
};

// A timer is a singleton, rather than an entity list.  A fixed document id is
// important here: it prevents concurrent Play clicks/devices from creating
// independent clocks.
const studyTimer = {
  async get() {
    const uid = await getUserId();
    const snapshot = await getDoc(getUserDocRef(uid, 'timerStates', 'active'));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  },
  async save(state) {
    const uid = await getUserId(state.user_id);
    const payload = { ...state, user_id: uid, updatedAt: serverTimestamp() };
    await firestoreSetDoc(getUserDocRef(uid, 'timerStates', 'active'), payload, { merge: true });
    return { id: 'active', ...state, user_id: uid };
  },
  subscribe(callback) {
    const uid = auth.currentUser?.uid;
    if (!uid) return () => {};
    return onSnapshot(getUserDocRef(uid, 'timerStates', 'active'),
      (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
      (error) => console.error('Study timer realtime subscription failed.', error));
  },
  async claimCompletion(sessionId) {
    const uid = await getUserId();
    const ref = getUserDocRef(uid, 'timerStates', 'active');
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return false;
      const state = snapshot.data();
      if (state.session_id !== sessionId || state.completion_saved) return false;
      transaction.update(ref, { is_running: false, remaining_seconds: 0, completion_saved: true, expected_finish_at: null, updatedAt: serverTimestamp() });
      return true;
    });
  },
};

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

const invokeGemini = async ({ prompt, file_urls = [], response_json_schema, timeoutMs = 0, signal }) => {
  const systemPrompt = 'You are a helpful CELE study planner. Return valid JSON only when requested.';
  const userPrompt = file_urls.length > 0 ? `${prompt}\n\nAdditional file references:\n${file_urls.join('\n')}` : prompt;

  const payload = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    stream: false,
    file_urls,
  };

  if (response_json_schema) {
    payload.response_format = { type: 'json_object' };
  }

  const controller = timeoutMs ? new AbortController() : null;
  const activeSignal = signal || controller?.signal;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch('/api/generatePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: activeSignal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Gemini extraction timed out after 60 seconds. Please try again.');
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

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
  async UploadFile({ file, timeoutMs = 0, folder = 'Cloud', onProgress, signal }) {
    const uid = await getUserId();
    return supabaseStorage.upload({ file, folder, timeoutMs, onProgress, signal });
  },
  async DeleteFile({ path }) { return supabaseStorage.remove(path); },
  async SignFileUrl({ path, expiresIn }) { return supabaseStorage.signUrl(path, expiresIn); },
  async DownloadFile({ path }) { return supabaseStorage.download(path); },
  async RenameFile({ path, name }) { return supabaseStorage.rename(path, name); },
  async CreateFolder({ path }) { return supabaseStorage.createFolder(path); },
  async DeleteFolder({ path }) { return supabaseStorage.deleteFolder(path); },
  async ExtractDataFromUploadedFile({ file_url, storagePath, json_schema }) {
    const privateUrl = file_url || (await supabaseStorage.signUrl(storagePath)).url;
    const response = await fetch(privateUrl);
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
  async InvokeLLM({ prompt, response_json_schema, file_urls = [], timeoutMs = 0, signal }) {
    return invokeGemini({ prompt, file_urls, response_json_schema, timeoutMs, signal });
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
  studyTimer,
  studyHistory,
  integrations: {
    Core: coreIntegrations,
  },
};
