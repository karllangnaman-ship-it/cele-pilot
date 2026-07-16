const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS_URL = `${GEMINI_API_BASE_URL}/models`;
const REQUEST_TIMEOUT_MS = 60_000;

const normalizeModelName = (model) => typeof model === 'string'
  ? model.trim().replace(/^models\//, '')
  : '';

const GEMINI_FAILOVER_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
];

const sendError = (res, status, error, provider) => res.status(status).json({
  success: false,
  status,
  ...(provider ? { provider } : {}),
  model: GEMINI_FAILOVER_MODELS[0],
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

class GeminiApiError extends Error {
  constructor(status, error, model) {
    super(typeof error === 'string' ? error : error?.message || 'Gemini API request failed.');
    this.name = 'GeminiApiError';
    this.status = status;
    this.providerError = error;
    this.model = model;
  }
}

const getProviderError = (body) => isPlainObject(body) && Object.hasOwn(body, 'error')
  ? body.error
  : body;

const listAvailableModels = async (apiKey, signal) => {
  const models = [];
  let pageToken;

  do {
    const url = pageToken ? `${GEMINI_MODELS_URL}?pageToken=${encodeURIComponent(pageToken)}` : GEMINI_MODELS_URL;
    console.info('[generatePlan] Gemini model discovery request.', { endpoint: url });
    const response = await fetch(url, {
      headers: { 'x-goog-api-key': apiKey },
      signal,
    });
    const responseText = await response.text();
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      console.error('[generatePlan] Gemini model discovery returned a non-JSON response.', {
        status: response.status,
        body: responseText,
      });
      throw new GeminiApiError(response.status || 502, responseText, GEMINI_FAILOVER_MODELS[0]);
    }

    console.info('[generatePlan] Gemini model discovery response.', {
      status: response.status,
      body: toLogJson(responseBody),
    });
    if (!response.ok) {
      throw new GeminiApiError(response.status, getProviderError(responseBody), GEMINI_FAILOVER_MODELS[0]);
    }

    if (Array.isArray(responseBody.models)) models.push(...responseBody.models);
    pageToken = responseBody.nextPageToken;
  } while (pageToken);

  return models;
};

const getGenerateContentUrl = (model) => {
  const normalizedModel = normalizeModelName(model);
  return `${GEMINI_API_BASE_URL}/models/${normalizedModel}:generateContent`;
};

const isModelsDiagnosticRequest = (req) => req.query?.diagnostic === 'models'
  || req.body?.diagnostic === 'models';

const summarizeModels = (models) => models.map((model) => ({
  name: model.name,
  supportedGenerationMethods: Array.isArray(model.supportedGenerationMethods)
    ? model.supportedGenerationMethods
    : [],
}));

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

const providerError = (res, status, error, model) => res.status(status).json({
  success: false,
  status,
  provider: 'Gemini',
  model: normalizeModelName(model) || GEMINI_FAILOVER_MODELS[0],
  error,
});

export default async function handler(req, res) {
  const startedAt = Date.now();
  console.info('[generatePlan] request received.', {
    method: req.method,
    body: toLogJson(redactSecrets(req.body)),
  });

  const diagnosticRequest = isModelsDiagnosticRequest(req);
  const isDiagnosticGet = req.method === 'GET' && diagnosticRequest;
  if (req.method !== 'POST' && !isDiagnosticGet) {
    res.setHeader('Allow', 'POST, GET');
    return sendError(res, 405, 'Only POST requests are supported, except GET ?diagnostic=models.');
  }

  if (!diagnosticRequest) {
    const validationError = validateRequest(req.body);
    if (validationError) return sendError(res, 400, validationError);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  console.info('[generatePlan] Gemini configuration.', {
    apiKeyConfigured: Boolean(apiKey),
    modelsEndpoint: GEMINI_MODELS_URL,
    failoverModels: GEMINI_FAILOVER_MODELS,
  });
  if (!apiKey) {
    console.error('[generatePlan] GEMINI_API_KEY is not configured.');
    return providerError(res, 500, 'GEMINI_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    if (diagnosticRequest) {
      const models = await listAvailableModels(apiKey, controller.signal);
      return res.status(200).json({
        success: true,
        provider: 'Gemini',
        model: GEMINI_FAILOVER_MODELS[0],
        models: summarizeModels(models),
      });
    }

    const payload = buildGeminiRequest(req.body);
    for (const [index, model] of GEMINI_FAILOVER_MODELS.entries()) {
      const attempt = index + 1;
      const endpoint = getGenerateContentUrl(model);
      console.info('[generatePlan] Gemini generateContent attempt.', { attempt, model, endpoint });
      const response = await fetch(endpoint, {
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
          attempt,
          model,
          status: response.status,
          body: responseText,
        });
        if ((response.status === 429 || response.status === 503) && index < GEMINI_FAILOVER_MODELS.length - 1) continue;
        return providerError(res, response.ok ? 502 : response.status, responseText, model);
      }

      console.info('[generatePlan] Gemini response.', {
        attempt,
        model,
        status: response.status,
        body: toLogJson(responseBody),
      });
      if (!response.ok) {
        const error = getProviderError(responseBody);
        console.error('[generatePlan] Gemini error.', { attempt, model, status: response.status, body: toLogJson(responseBody) });
        if ((response.status === 429 || response.status === 503) && index < GEMINI_FAILOVER_MODELS.length - 1) continue;
        return providerError(res, response.status, error, model);
      }

      try {
        return res.status(200).json({ success: true, provider: 'Gemini', model, plan: parsePlan(responseBody) });
      } catch (error) {
        console.error('[generatePlan] Invalid Gemini plan response.', error);
        if (error instanceof Error && error.stack) console.error(error.stack);
        return providerError(res, 502, responseBody, model);
      }
    }
  } catch (error) {
    if (error instanceof GeminiApiError) {
      console.error('[generatePlan] Gemini Models API request failed.', error);
      if (error.stack) console.error(error.stack);
      return providerError(res, error.status, error.providerError, error.model);
    }
    const timedOut = error?.name === 'AbortError';
    console.error('[generatePlan] Gemini request failed.', error);
    if (error instanceof Error && error.stack) console.error(error.stack);
    return providerError(res, timedOut ? 504 : 502, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
    console.info('[generatePlan] execution time.', { milliseconds: Date.now() - startedAt });
  }
}
