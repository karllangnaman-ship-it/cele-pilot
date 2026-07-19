import { GoogleGenerativeAI } from '@google/generative-ai';

const ALLOWED_MODELS = new Set(['gemini-3.5-flash', 'gemini-3.1-flash-lite']);
const fail = (res, status, error) => res.status(status).json({ success: false, error });

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Only POST requests are supported.'); }
  try {
    if (!process.env.GEMINI_API_KEY) return fail(res, 500, 'GEMINI_API_KEY is not configured.');
    const modelName = ALLOWED_MODELS.has(req.body?.model) ? req.body.model : 'gemini-3.5-flash';
    const input = Array.isArray(req.body?.messages) ? req.body.messages.slice(-30) : [];
    if (!input.length || input.some((item) => !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string')) return fail(res, 400, 'A valid text conversation is required.');

    // The Gemini API key is the sole server credential used by this endpoint.
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: 'You are CELE Pilot Ask AI, a precise and helpful civil engineering study assistant. Use Markdown and valid LaTeX ($...$ for inline math and $$...$$ for display math) when useful.',
    });
    const contents = input.map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] }));
    const result = await model.generateContentStream({ contents });

    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive');
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.end();
  } catch (error) {
    console.error('[ask-ai] failed', error?.message);
    if (!res.headersSent) return fail(res, 500, error?.message || 'Ask AI failed.');
    res.write(`data: ${JSON.stringify({ error: 'The response was interrupted.' })}\n\n`);
    res.end();
  }
}
