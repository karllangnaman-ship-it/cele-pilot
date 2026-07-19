import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

const chats = (userId) => collection(db, 'users', userId, 'askAiChats');
const messages = (userId, chatId) => collection(db, 'users', userId, 'askAiChats', chatId, 'messages');
const folders = (userId) => collection(db, 'users', userId, 'askAiFolders');
const uid = () => auth.currentUser?.uid || null;
const asItem = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

// Firestore rejects undefined values. Keep persistence deliberately narrow so
// temporary UI state can never leak into a document write.
const withoutUndefined = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined),
);
const chatData = (data, userId) => withoutUndefined({
  userId,
  title: data.title,
  model: data.model,
  folderId: data.folderId,
  favorite: data.favorite,
  pinned: data.pinned,
});
const messageData = (chatId, data, userId) => withoutUndefined({
  chatId,
  userId,
  role: data.role,
  content: data.content,
  model: data.model,
  attachmentType: data.attachmentType,
  attachmentName: data.attachmentName,
  attachmentSize: data.attachmentSize,
  attachmentStorageUrl: data.attachmentStorageUrl,
  attachmentStoragePath: data.attachmentStoragePath,
  mimeType: data.mimeType,
});

export const askAiStore = {
  async listChats() {
    const userId = uid(); if (!userId) return [];
    const snapshot = await getDocs(query(chats(userId), orderBy('updatedAt', 'desc')));
    return snapshot.docs.map(asItem);
  },
  async listFolders() {
    const userId = uid(); if (!userId) return [];
    const snapshot = await getDocs(query(folders(userId), orderBy('name')));
    return snapshot.docs.map(asItem);
  },
  async createChat(model) {
    const userId = uid(); if (!userId) throw new Error('Please sign in to use Ask AI.');
    const ref = await addDoc(chats(userId), {
      ...chatData({ title: 'New chat', model, folderId: null, favorite: false, pinned: false }, userId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, title: 'New chat', model, folderId: null, favorite: false, pinned: false };
  },
  async updateChat(chatId, data) {
    const userId = uid(); if (!userId) return;
    await updateDoc(doc(chats(userId), chatId), { ...chatData(data, userId), updatedAt: serverTimestamp() });
  },
  async deleteChat(chatId) { const userId = uid(); if (userId) await deleteDoc(doc(chats(userId), chatId)); },
  async messages(chatId) {
    const userId = uid(); if (!userId || !chatId) return [];
    const snapshot = await getDocs(query(messages(userId, chatId), orderBy('createdAt')));
    return snapshot.docs.map(asItem);
  },
  async saveMessage(chatId, message) {
    const userId = uid(); if (!userId) return null;
    await setDoc(doc(messages(userId, chatId), message.id), {
      ...messageData(chatId, message, userId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return message;
  },
  async deleteMessage(chatId, messageId) { const userId = uid(); if (userId) await deleteDoc(doc(messages(userId, chatId), messageId)); },
  async createFolder(name) {
    const userId = uid(); if (!userId) throw new Error('Please sign in to use Ask AI.');
    const ref = await addDoc(folders(userId), withoutUndefined({ userId, name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return { id: ref.id, name };
  },
  async updateFolder(folderId, data) { const userId = uid(); if (userId) await updateDoc(doc(folders(userId), folderId), { ...withoutUndefined({ name: data.name }), updatedAt: serverTimestamp() }); },
  async deleteFolder(folderId) { const userId = uid(); if (userId) await deleteDoc(doc(folders(userId), folderId)); },
};

export async function streamAskAi({ messages: history, model, signal, onChunk }) {
  const response = await fetch('/api/ask-ai', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, model }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Ask AI could not complete the request.'); }
  const reader = response.body?.getReader(); if (!reader) throw new Error('Streaming is unavailable in this browser.');
  const decoder = new TextDecoder(); let buffer = ''; let output = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n'); buffer = events.pop() || '';
    for (const event of events) for (const line of event.split('\n')) if (line.startsWith('data:')) {
      const data = JSON.parse(line.slice(5)); if (data.error) throw new Error(data.error);
      if (data.text) { output += data.text; onChunk(output); }
    }
  }
  return output;
}

export async function streamAskAiVision({ messages: history, model, attachment, signal, onChunk }) {
  const response = await fetch('/api/ask-ai-vision', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history, model, attachment }),
  });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Ask AI could not complete the request.'); }
  const reader = response.body?.getReader(); if (!reader) throw new Error('Streaming is unavailable in this browser.');
  const decoder = new TextDecoder(); let buffer = ''; let output = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n'); buffer = events.pop() || '';
    for (const event of events) for (const line of event.split('\n')) if (line.startsWith('data:')) {
      const data = JSON.parse(line.slice(5)); if (data.error) throw new Error(data.error);
      if (data.text) { output += data.text; onChunk(output); }
    }
  }
  return output;
}
