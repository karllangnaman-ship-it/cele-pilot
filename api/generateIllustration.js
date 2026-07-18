import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_PROMPT_LENGTH = 6000;
const BUCKET = 'cele-pilot';

const fail = (res, status, error) => res.status(status).json({ success: false, error });

function firebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Image service authentication is not configured.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

function storage() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Image storage is not configured.');
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Only POST requests are supported.'); }
  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail(res, 401, 'Authentication is required.');
    const { uid } = await firebaseAdmin().auth().verifyIdToken(token);
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) return fail(res, 400, 'A valid illustration prompt is required.');
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';
    if (!apiKey) return fail(res, 500, 'GEMINI_API_KEY is not configured.');

    const response = await fetch(`${GEMINI_API}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return fail(res, response.status, body?.error?.message || 'Illustration generation failed.');
    const image = body?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
    if (!image?.data) return fail(res, 502, 'The image provider did not return an illustration.');
    const mimeType = image.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const path = `users/${uid}/Engineering Illustrations/${randomUUID()}.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    const client = storage();
    const { error } = await client.upload(path, Buffer.from(image.data, 'base64'), { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Unable to store illustration: ${error.message}`);
    const { data, error: urlError } = await client.createSignedUrl(path, 3600);
    if (urlError) throw new Error(`Unable to create illustration URL: ${urlError.message}`);
    // Deliberately return the URL only; image bytes never pass through the frontend API response.
    return res.status(200).json({ success: true, imageUrl: data.signedUrl });
  } catch (error) {
    console.error('[generateIllustration] failed', { message: error?.message });
    return fail(res, error?.code?.startsWith('auth/') ? 401 : 500, error?.message || 'Illustration generation failed.');
  }
}
