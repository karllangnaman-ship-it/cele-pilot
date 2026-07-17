import { auth } from '@/firebase';

const API_ROOT = '/api/storage';
const RETRIES = 2;
const offlineQueue = [];
let onlineListenerInstalled = false;

const token = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in before accessing storage.');
  return user.getIdToken();
};
const isRetryable = (caught) => !navigator.onLine || /network|failed to fetch|timed out|temporar/i.test(caught?.message || '');
const waitForOnline = () => new Promise((resolve) => {
  if (navigator.onLine) return resolve();
  offlineQueue.push(resolve);
  if (!onlineListenerInstalled) {
    onlineListenerInstalled = true;
    window.addEventListener('online', () => { while (offlineQueue.length) offlineQueue.shift()(); });
  }
});

async function request(action, { method = 'POST', body, signal } = {}) {
  const response = await fetch(`${API_ROOT}/${action}`, {
    method, signal,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Storage request failed.');
  return data;
}

function uploadOnce({ file, folder, onProgress, signal }) {
  return new Promise(async (resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      xhr.open('POST', `${API_ROOT}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${await token()}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      xhr.setRequestHeader('X-File-Size', String(file.size));
      xhr.setRequestHeader('X-Storage-Folder', folder);
      const startedAt = performance.now();
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const elapsed = Math.max((performance.now() - startedAt) / 1000, 0.01);
        const speed = event.loaded / elapsed;
        onProgress?.({ progress: Math.round((event.loaded / event.total) * 100), loaded: event.loaded, total: event.total, speed, remainingTime: speed ? (event.total - event.loaded) / speed : null });
      };
      xhr.onerror = () => reject(new Error('Network error. Your upload can be retried.'));
      xhr.onabort = () => reject(new DOMException('Upload cancelled.', 'AbortError'));
      xhr.onload = () => {
        let data = {}; try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* server response is malformed */ }
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(data.error || 'Upload failed. Please retry.'));
        resolve(data);
      };
      xhr.send(file);
    } catch (caught) { reject(caught); }
  });
}

export const supabaseStorage = {
  async upload({ file, folder = 'Cloud', onProgress, signal }) {
    if (!file) throw new Error('No file selected.');
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        if (!navigator.onLine) await waitForOnline();
        const result = await uploadOnce({ file, folder, onProgress, signal });
        return { file_url: result.url, path: result.path, bucket: result.bucket, size: result.size, mimeType: result.mimeType };
      } catch (caught) {
        if (caught?.name === 'AbortError' || attempt === RETRIES || !isRetryable(caught)) throw caught;
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
  },
  signUrl: (path, expiresIn = 900) => request('signed-url', { body: { path, expiresIn } }),
  download: (path) => request(`download?path=${encodeURIComponent(path)}`, { method: 'GET' }),
  list: (path = '', offset = 0, limit = 100) => request(`list?path=${encodeURIComponent(path)}&offset=${offset}&limit=${limit}`, { method: 'GET' }),
  remove: (path) => request('delete', { method: 'DELETE', body: { path } }),
  move: (fromPath, toPath) => request('move', { body: { fromPath, toPath } }),
  rename: (path, name) => request('rename', { body: { path, name } }),
  createFolder: (path) => request('create-folder', { body: { path } }),
  deleteFolder: (path) => request('delete-folder', { body: { path } }),
};
