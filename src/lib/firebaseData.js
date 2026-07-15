import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { getAuth } from 'firebase/auth';

const auth = getAuth();

const getUserDocRef = (uid, subcollection = null, id = null) => {
  if (!uid) return null;
  const baseRef = doc(db, 'users', uid);
  if (!subcollection) return baseRef;
  return id ? doc(db, 'users', uid, subcollection, id) : doc(db, 'users', uid, subcollection);
};

const getUserCollectionRef = (uid, collectionName) => {
  if (!uid) return null;
  return collection(db, 'users', uid, collectionName);
};

export const ensureUserProfile = async (uid, data = {}) => {
  if (!uid) return null;
  const ref = getUserDocRef(uid, 'profile');
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const payload = { uid, createdAt: serverTimestamp(), ...data };
  await setDoc(ref, payload);
  return payload;
};

export const setDoc = async (ref, data) => {
  if (!ref) return null;
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return { ...data, id: ref.id };
};

export const createDoc = async (path, data) => {
  if (!path) return null;
  const ref = doc(db, path);
  await setDoc(ref, data);
  return { ...data, id: ref.id };
};

export const createUserDoc = async (uid, collectionName, data) => {
  if (!uid) return null;
  const ref = doc(getUserCollectionRef(uid, collectionName));
  const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, payload);
  return { ...payload, id: ref.id };
};

export const readUserCollection = async (uid, collectionName, filters = {}, order = null) => {
  if (!uid) return [];
  const constraints = [];
  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== null) constraints.push(where(field, '==', value));
  });
  if (order) constraints.push(orderBy(order));
  const q = query(getUserCollectionRef(uid, collectionName), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const readUserDoc = async (uid, collectionName, docId = null) => {
  if (!uid) return null;
  const ref = docId ? getUserDocRef(uid, collectionName, docId) : getUserDocRef(uid, collectionName);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const updateUserDoc = async (uid, collectionName, docId, data) => {
  if (!uid || !docId) return null;
  const ref = getUserDocRef(uid, collectionName, docId);
  const payload = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
  return { id: docId, ...payload };
};

export const deleteUserDoc = async (uid, collectionName, docId) => {
  if (!uid || !docId) return null;
  const ref = getUserDocRef(uid, collectionName, docId);
  await deleteDoc(ref);
  return true;
};

export const bulkCreateUserDocs = async (uid, collectionName, items) => {
  if (!uid || !Array.isArray(items) || items.length === 0) return [];
  const batch = writeBatch(db);
  const created = [];
  items.forEach((item) => {
    const ref = doc(getUserCollectionRef(uid, collectionName));
    const payload = { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    batch.set(ref, payload);
    created.push({ ...payload, id: ref.id });
  });
  await batch.commit();
  return created;
};

export const getCurrentUser = () => auth.currentUser;

export const getCurrentUserId = () => auth.currentUser?.uid || null;

export const getCurrentUserEmail = () => auth.currentUser?.email || null;
