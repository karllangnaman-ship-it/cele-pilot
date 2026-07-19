import { addDoc, collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

const chats = (uid) => collection(db, 'users', uid, 'askAiChats');
const messages = (uid, chatId) => collection(db, 'users', uid, 'askAiChats', chatId, 'messages');
const folders = (uid) => collection(db, 'users', uid, 'askAiFolders');
const uid = () => auth.currentUser?.uid || null;
const asItem = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

export const askAiStore = {
  async listChats() {
    const userId = uid(); if (!userId) return [];
    const snapshot = await getDocs(query(chats(userId), orderBy('updatedAt', 'desc'), limit(100)));
    return snapshot.docs.map(asItem);
  },
  async listFolders() {
    const userId = uid(); if (!userId) return [];
    const snapshot = await getDocs(query(folders(userId), orderBy('name'), limit(100)));
    return snapshot.docs.map(asItem);
  },
  async createChat(model) {
    const userId = uid(); if (!userId) throw new Error('Please sign in to use Ask AI.');
    const ref = await addDoc(chats(userId), { userId, title: 'New chat', model, pinned: false, favorite: false, folderId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { id: ref.id, title: 'New chat', model };
  },
  async updateChat(chatId, data) { const userId = uid(); await updateDoc(doc(chats(userId), chatId), { ...data, updatedAt: serverTimestamp() }); },
  async deleteChat(chatId) { const userId = uid(); await deleteDoc(doc(chats(userId), chatId)); },
  async messages(chatId) {
    const userId = uid(); if (!userId || !chatId) return [];
    const snapshot = await getDocs(query(messages(userId, chatId), orderBy('createdAt'), limit(200)));
    return snapshot.docs.map(asItem);
  },
  async saveMessage(chatId, message) {
    const userId = uid(); if (!userId) return null;
    const ref = doc(messages(userId, chatId), message.id);
    await setDoc(ref, { ...message, userId, createdAt: serverTimestamp() });
    return message;
  },
  async createFolder(name) { const userId = uid(); const ref = await addDoc(folders(userId), { userId, name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return { id: ref.id, name }; },
};

export async function streamAskAi({ messages: history, model, image, signal, onChunk }) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/ask-ai', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: history, model, image }) });
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
