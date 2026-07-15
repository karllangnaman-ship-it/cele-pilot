const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 25_000;

const sendError = (res, status, error, provider) => res.status(status).json({
  success: false,
  status,
  ...(provider ? { provider } : {}),
  error,
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const redactSecrets = (value) => {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /(?:api.?key|authorization|password|secret|token)/i.test(key) ? '[REDACTED]' : redactSecrets(item),
  ]));
};

const toLogJson = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable value]';
  }
};

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

const providerError = (res, status, error) => sendError(res, status, error, 'Gemini');

export default async function handler(req, res) {
  const startedAt = Date.now();
  console.info('[generatePlan] request received.', {
    method: req.method,
    body: toLogJson(redactSecrets(req.body)),
  });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Only POST requests are supported.');
  }

  const validationError = validateRequest(req.body);
  if (validationError) return sendError(res, 400, validationError);

  const apiKey = process.env.GEMINI_API_KEY;
  console.info('[generatePlan] Gemini configuration.', {
    apiKeyConfigured: Boolean(apiKey),
    endpoint: GEMINI_URL,
    model: GEMINI_MODEL,
  });
  if (!apiKey) {
    console.error('[generatePlan] GEMINI_API_KEY is not configured.');
    return providerError(res, 500, 'GEMINI_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const payload = buildGeminiRequest(req.body);
    console.info('[generatePlan] Gemini request.', {
      endpoint: GEMINI_URL,
      model: GEMINI_MODEL,
      payload: toLogJson(payload),
    });
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
      console.error('[generatePlan] Gemini returned a non-JSON response.', {
        status: response.status,
        body: responseText,
      });
      return providerError(res, response.ok ? 502 : response.status, responseText);
    }

    console.info('[generatePlan] Gemini response.', {
      status: response.status,
      body: toLogJson(responseBody),
    });
    if (!response.ok) {
      // Preserve the provider's error object exactly as Gemini returned it.
      const error = isPlainObject(responseBody) && Object.hasOwn(responseBody, 'error')
        ? responseBody.error
        : responseBody;
      console.error('[generatePlan] Gemini error.', {
        status: response.status,
        body: toLogJson(responseBody),
      });
      return providerError(res, response.status, error);
    }

    try {
      return res.status(200).json({ success: true, plan: parsePlan(responseBody) });
    } catch (error) {
      console.error('[generatePlan] Invalid Gemini plan response.', error);
      if (error instanceof Error && error.stack) console.error(error.stack);
      return providerError(res, 502, responseBody);
    }
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    console.error('[generatePlan] Gemini request failed.', error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    return providerError(res, timedOut ? 504 : 502, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
    console.info('[generatePlan] execution time.', { milliseconds: Date.now() - startedAt });
  }
}
