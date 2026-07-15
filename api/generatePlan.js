const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 25_000;

const sendError = (res, status, error) => res.status(status).json({ success: false, error });

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validateRequest = (body) => {
  if (!isPlainObject(body)) return 'Request body must be a JSON object.';
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'At least one message is required.';
  }

  const validRoles = new Set(['system', 'user', 'assistant']);
  if (body.messages.some((message) => !isPlainObject(message)
    || !validRoles.has(message.role)
    || typeof message.content !== 'string'
    || !message.content.trim())) {
    return 'Each message requires a supported role and non-empty content.';
  }

  if (body.temperature !== undefined
    && (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature))) {
    return '"temperature" must be a finite number when provided.';
  }

  if (body.stream === true) return 'Streaming responses are not supported.';
  return null;
};

const buildGeminiRequest = ({ messages, temperature, response_format: responseFormat }) => {
  const systemInstruction = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => content)
    .join('\n\n');
  const plannerInstructions = [
    'Return JSON only: no Markdown, prose, or code fences.',
    'When generating a Civil Engineering Licensure Examination review schedule, tailor it to the supplied survey, available study hours, wake and sleep times, weak and strong PSAD, MSTE, and HGE subjects, learning style, target CELE date, and review intensity.',
    'The schedule must be chronological, non-overlapping, realistic, and include study blocks of at least three hours, breaks, lunch, dinner, sleep, review sessions, flashcards, practice problems, and reflection.',
  ].join(' ');
  const generationConfig = { responseMimeType: 'application/json' };

  if (typeof temperature === 'number') generationConfig.temperature = temperature;
  if (isPlainObject(responseFormat?.json_schema)) generationConfig.responseSchema = responseFormat.json_schema;

  return {
    systemInstruction: { parts: [{ text: [plannerInstructions, systemInstruction].filter(Boolean).join('\n\n') }] },
    contents: messages
      .filter(({ role }) => role !== 'system')
      .map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      })),
    generationConfig,
  };
};

const getGeminiError = (body) => body?.error?.message || 'The Gemini service rejected the request.';

const parsePlan = (body) => {
  const text = body?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned no generated content.');

  const plan = JSON.parse(text);
  if (!isPlainObject(plan)) throw new Error('Gemini returned a JSON value instead of a plan object.');
  return plan;
};

const mapGeminiError = (status) => {
  if (status === 400) return [400, 'Invalid request sent to Gemini.'];
  if (status === 401 || status === 403) return [502, 'The Gemini API key is invalid or does not have access.'];
  if (status === 429) return [429, 'Gemini quota exceeded. Please try again later.'];
  return [502, 'Gemini could not generate a plan. Please try again later.'];
};

export default async function handler(req, res) {
  const startedAt = Date.now();
  console.info('[generatePlan] request received.', { method: req.method });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Only POST requests are supported.');
  }

  const validationError = validateRequest(req.body);
  if (validationError) return sendError(res, 400, validationError);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[generatePlan] GEMINI_API_KEY is not configured.');
    return sendError(res, 500, 'The plan-generation service is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const payload = buildGeminiRequest(req.body);
    console.info('[generatePlan] Gemini request.', { model: GEMINI_MODEL, messageCount: payload.contents.length });
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      console.error('[generatePlan] Gemini returned invalid JSON.', { status: response.status });
      return sendError(res, 502, 'Gemini returned an invalid response.');
    }

    console.info('[generatePlan] Gemini response.', { status: response.status });
    if (!response.ok) {
      const message = getGeminiError(responseBody);
      console.error('[generatePlan] Gemini error.', { status: response.status, message });
      const [status, error] = mapGeminiError(response.status);
      return sendError(res, status, error);
    }

    try {
      return res.status(200).json({ success: true, plan: parsePlan(responseBody) });
    } catch (error) {
      console.error('[generatePlan] Invalid Gemini plan response.', { message: error.message });
      return sendError(res, 502, 'Gemini returned an invalid plan response.');
    }
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('[generatePlan] Gemini request failed.', {
      type: timedOut ? 'timeout' : 'network_failure',
      message: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, timedOut ? 504 : 502, timedOut
      ? 'Gemini request timed out. Please try again.'
      : 'Unable to reach Gemini. Please try again later.');
  } finally {
    clearTimeout(timeout);
    console.info('[generatePlan] execution time.', { milliseconds: Date.now() - startedAt });
  }
}
