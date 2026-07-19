import { GoogleGenerativeAI } from '@google/generative-ai';

const ALLOWED_MODELS = new Set(['gemini-3.5-flash', 'gemini-3.1-flash-lite']);
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const fail = (res, status, error) => res.status(status).json({ success: false, error });

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Only POST requests are supported.'); }
  try {
    if (!process.env.GEMINI_API_KEY) return fail(res, 500, 'GEMINI_API_KEY is not configured.');
    const modelName = ALLOWED_MODELS.has(req.body?.model) ? req.body.model : 'gemini-3.5-flash';
    const input = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];
    const attachment = req.body?.attachment;
    if (!input.length || input.some((item) => !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string')) return fail(res, 400, 'A valid text conversation is required.');
    if (!attachment?.storageUrl || !ALLOWED_TYPES.has(attachment.mimeType)) return fail(res, 400, 'A PNG, JPG, WEBP, GIF, or PDF attachment is required.');
    if (!Number.isFinite(attachment.size) || attachment.size < 1 || attachment.size > MAX_FILE_BYTES) return fail(res, 413, 'Attachments must be 20 MB or smaller.');

    const download = await fetch(attachment.storageUrl);
    if (!download.ok) return fail(res, 422, 'The uploaded attachment could not be read. Please upload it again.');
    const declaredSize = Number(download.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_FILE_BYTES) return fail(res, 413, 'Attachments must be 20 MB or smaller.');
    const bytes = Buffer.from(await download.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) return fail(res, 413, 'Attachments must be 20 MB or smaller.');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: 'You are CELE Pilot Ask AI, a precise and helpful civil engineering study assistant. Analyze the supplied attachment when relevant. Use Markdown and valid LaTeX ($...$ for inline math and $$...$$ for display math) when useful.' });
    const contents = input.map((item, index) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }, ...(index === input.length - 1 ? [{ inlineData: { mimeType: attachment.mimeType, data: bytes.toString('base64') } }] : [])],
    }));
    const result = await model.generateContentStream({ contents });
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive');
    for await (const chunk of result.stream) { const text = chunk.text(); if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`); }
    res.end();
  } catch (error) {
    console.error('[ask-ai-vision] failed', error?.message);
    if (!res.headersSent) return fail(res, 500, error?.message || 'Ask AI could not complete the request.');
    res.write(`data: ${JSON.stringify({ error: 'The response was interrupted.' })}\n\n`); res.end();
  }
}
