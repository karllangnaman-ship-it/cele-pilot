import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const BUCKET = 'cele-pilot';
const MAX_FILE_BYTES = 45 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'zip']);

export const config = { api: { bodyParser: false } };

function getAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Storage service authentication is not configured.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

function storage() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Storage service is not configured.');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}

const error = (res, status, message) => res.status(status).json({ error: message });
const cleanPart = (value, label = 'path') => {
  const result = String(value || '').replace(/^\/+|\/+$/g, '');
  if (!result || result.split('/').some((part) => !part || part === '.' || part === '..' || /[\\\0]/.test(part))) {
    throw Object.assign(new Error(`Invalid ${label}.`), { status: 400 });
  }
  return result;
};
const userPath = (uid, value) => {
  const path = cleanPart(value);
  const prefix = `users/${uid}/`;
  if (!path.startsWith(prefix)) throw Object.assign(new Error('Permission denied.'), { status: 403 });
  return path;
};
const userRelativePath = (value) => value ? cleanPart(value) : '';

async function jsonBody(req) {
  const raw = await rawBody(req, 1024 * 1024);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid request body.'), { status: 400 }); }
}

async function rawBody(req, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximum) throw Object.assign(new Error(`File is too large. Maximum size is ${Math.floor(maximum / 1024 / 1024)} MB.`), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function signedUrl(client, path, expiresIn = 900) {
  const { data, error: supabaseError } = await client.createSignedUrl(path, Math.min(Math.max(Number(expiresIn) || 900, 60), 3600));
  if (supabaseError) throw new Error(`Unable to create a private URL: ${supabaseError.message}`);
  return data.signedUrl;
}

export default async function handler(req, res) {
  const action = String(req.query.action || '').replace(/-/g, '').toLowerCase();
  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return error(res, 401, 'Authentication is required.');
    const { uid } = await getAdmin().auth().verifyIdToken(token);
    const client = storage();

    if (action === 'upload' && req.method === 'POST') {
      const fileName = req.headers['x-file-name'];
      const folder = req.headers['x-storage-folder'] || 'Cloud';
      const declaredSize = Number(req.headers['x-file-size'] || 0);
      const safeName = cleanPart(decodeURIComponent(fileName), 'file name').split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '_');
      const extension = safeName.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(extension)) return error(res, 415, 'Unsupported file type.');
      if (!Number.isFinite(declaredSize) || declaredSize < 1 || declaredSize > MAX_FILE_BYTES) return error(res, 413, 'File is too large or invalid.');
      const bytes = await rawBody(req, MAX_FILE_BYTES);
      if (bytes.length !== declaredSize) return error(res, 400, 'Uploaded file size did not match the selected file.');
      const path = `users/${uid}/${cleanPart(folder, 'folder')}/${randomUUID()}-${safeName}`;
      const { error: supabaseError } = await client.upload(path, bytes, { contentType: req.headers['content-type'] || 'application/octet-stream', upsert: false });
      if (supabaseError) throw new Error(`Upload failed: ${supabaseError.message}`);
      return res.status(201).json({ bucket: BUCKET, path, size: bytes.length, mimeType: req.headers['content-type'] || 'application/octet-stream', url: await signedUrl(client, path) });
    }

    if (action === 'list' && req.method === 'GET') {
      const relative = userRelativePath(req.query.path);
      const prefix = `users/${uid}/${relative ? `${relative}/` : ''}`;
      const { data, error: supabaseError } = await client.list(prefix, { limit: Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000), offset: Math.max(Number(req.query.offset) || 0, 0), sortBy: { column: 'name', order: 'asc' } });
      if (supabaseError) throw new Error(`List failed: ${supabaseError.message}`);
      return res.status(200).json({ bucket: BUCKET, path: prefix, items: data || [] });
    }

    const body = req.method === 'GET' ? req.query : await jsonBody(req);
    if ((action === 'signedurl' || action === 'download') && ['POST', 'GET'].includes(req.method)) {
      const path = userPath(uid, body.path);
      return res.status(200).json({ path, url: await signedUrl(client, path, body.expiresIn) });
    }
    if (action === 'delete' && req.method === 'DELETE') {
      const path = userPath(uid, body.path);
      const { error: supabaseError } = await client.remove([path]);
      if (supabaseError) throw new Error(`Delete failed: ${supabaseError.message}`);
      return res.status(200).json({ path });
    }
    if (action === 'move' && req.method === 'POST') {
      const fromPath = userPath(uid, body.fromPath); const toPath = userPath(uid, body.toPath);
      const { error: supabaseError } = await client.move(fromPath, toPath);
      if (supabaseError) throw new Error(`Move failed: ${supabaseError.message}`);
      return res.status(200).json({ fromPath, toPath });
    }
    if (action === 'rename' && req.method === 'POST') {
      const path = userPath(uid, body.path);
      const name = cleanPart(body.name, 'file name').split('/').pop().replace(/[^a-zA-Z0-9._-]/g, '_');
      const toPath = `${path.split('/').slice(0, -1).join('/')}/${name}`;
      const { error: supabaseError } = await client.move(path, toPath);
      if (supabaseError) throw new Error(`Rename failed: ${supabaseError.message}`);
      return res.status(200).json({ path: toPath });
    }
    if (action === 'createfolder' && req.method === 'POST') {
      const path = userPath(uid, body.path);
      const { error: supabaseError } = await client.upload(`${path}/.keep`, new Uint8Array(), { contentType: 'application/octet-stream', upsert: false });
      if (supabaseError && !/already exists/i.test(supabaseError.message)) throw new Error(`Create folder failed: ${supabaseError.message}`);
      return res.status(201).json({ path });
    }
    if (action === 'deletefolder' && req.method === 'POST') {
      const path = userPath(uid, body.path);
      const collectObjects = async (prefix) => {
        const { data, error: listError } = await client.list(`${prefix}/`, { limit: 1000 });
        if (listError) throw new Error(`List folder failed: ${listError.message}`);
        const nested = await Promise.all((data || []).filter((item) => !item.id).map((item) => collectObjects(`${prefix}/${item.name}`)));
        return [(data || []).filter((item) => item.id).map((item) => `${prefix}/${item.name}`), ...nested].flat();
      };
      const objectPaths = await collectObjects(path);
      if (objectPaths.length) { const { error: removeError } = await client.remove(objectPaths); if (removeError) throw new Error(`Delete folder failed: ${removeError.message}`); }
      return res.status(200).json({ path });
    }
    return error(res, 404, 'Storage endpoint not found.');
  } catch (caught) {
    const status = caught?.status || (caught?.code?.startsWith('auth/') ? 401 : 500);
    console.error('[storage] request failed', { action: req.query.action, status, message: caught?.message });
    return error(res, status, status === 401 ? 'Authentication is invalid or expired.' : caught?.message || 'Storage operation failed.');
  }
}
