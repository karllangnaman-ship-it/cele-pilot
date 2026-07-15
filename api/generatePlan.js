const jsonError = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

const isValidRequest = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object.';
  }

  if (typeof body.model !== 'string' || body.model.trim().length === 0) {
    return 'A non-empty "model" string is required.';
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'At least one chat message is required.';
  }

  if (body.messages.some(({ role, content } = {}) =>
    typeof role !== 'string' || role.trim().length === 0 ||
    typeof content !== 'string' || content.trim().length === 0
  )) {
    return 'Each message requires non-empty "role" and "content" strings.';
  }

  if (body.temperature !== undefined &&
    (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature))) {
    return '"temperature" must be a finite number when provided.';
  }

  if (body.stream === true) {
    return 'Streaming responses are not supported by this endpoint.';
  }

  return null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonError(res, 405, 'method_not_allowed', 'Only POST requests are supported.');
  }

  const validationError = isValidRequest(req.body);
  if (validationError) {
    return jsonError(res, 400, 'invalid_request', validationError);
  }

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    console.error('[generatePlan] CEREBRAS_API_KEY is not configured.');
    return jsonError(
      res,
      500,
      'missing_configuration',
      'The plan-generation service is not configured. Set CEREBRAS_API_KEY in Vercel Environment Variables and redeploy.'
    );
  }

  console.info('[generatePlan] forwarding request to Cerebras.', {
    model: req.body.model,
    messageCount: req.body.messages.length,
  });

  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...req.body, stream: false }),
    });

    const responseText = await response.text();
    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      console.error('[generatePlan] Cerebras returned a non-JSON response.', { status: response.status });
      return jsonError(res, 500, 'upstream_invalid_response', 'The plan-generation service returned an invalid response.');
    }

    if (!response.ok) {
      const message = responseBody?.error?.message || 'The plan-generation service rejected the request.';
      console.error('[generatePlan] Cerebras request failed.', { status: response.status, message });
      return jsonError(res, 500, 'upstream_request_failed', message);
    }

    console.info('[generatePlan] Cerebras request completed.', { status: response.status });
    return res.status(200).json(responseBody);
  } catch (error) {
    console.error('[generatePlan] Unable to reach Cerebras.', {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError(res, 500, 'upstream_unavailable', 'Unable to reach the plan-generation service. Please try again later.');
  }
}
