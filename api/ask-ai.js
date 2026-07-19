import admin from 'firebase-admin';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const ALLOWED_MODELS = new Set(['gemini-3.5-flash', 'gemini-3.1-flash-lite']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function firebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Ask AI authentication is not configured.');
  return admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}
const fail = (res, status, error) => res.status(status).json({ success: false, error });
const textFrom = (event) => event?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Only POST requests are supported.'); }
  try {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail(res, 401, 'Authentication is required.');
    await firebaseAdmin().auth().verifyIdToken(token);
    const model = ALLOWED_MODELS.has(req.body?.model) ? req.body.model : 'gemini-3.5-flash';
    const input = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];
    if (!input.length || input.some((item) => !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string')) return fail(res, 400, 'A valid conversation is required.');
    const image = req.body?.image;
    let imagePart = null;
    if (image?.data && /^image\/(png|jpeg|webp|gif)$/.test(image.mimeType || '')) {
      const data = String(image.data).replace(/^data:[^;]+;base64,/, '');
      if (Buffer.byteLength(data, 'base64') > MAX_IMAGE_BYTES) return fail(res, 413, 'Images must be 10 MB or smaller.');
      imagePart = { inlineData: { mimeType: image.mimeType, data } };
    }
    const contents = input.map((item, index) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }, ...(index === input.length - 1 && imagePart ? [imagePart] : [])] }));
    const upstream = await fetch(`${API}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: 'You are CELE Pilot Ask AI, a precise and helpful civil engineering study assistant. Use Markdown and LaTex ($...$ or $$...$$) when useful.' }] },
      }),
    });
    if (!upstream.ok) { const body = await upstream.json().catch(() => ({})); return fail(res, upstream.status, body?.error?.message || 'Gemini request failed.'); }
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive');
    const reader = upstream.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) if (line.startsWith('data:')) { try { const text = textFrom(JSON.parse(line.slice(5))); if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`); } catch { /* wait for next event */ } } }
    res.end();
  } catch (error) { console.error('[ask-ai] failed', error?.message); if (!res.headersSent) return fail(res, error?.code?.startsWith('auth/') ? 401 : 500, error?.message || 'Ask AI failed.'); res.write(`data: ${JSON.stringify({ error: 'The response was interrupted.' })}\n\n`); res.end(); }
}
