# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and a Vercel serverless function that generates plans with Google Gemini.

## Prerequisites

1. Clone the repository and run `npm install`.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Copy `.env.example` to `.env.local` and fill in your Firebase values and `GEMINI_API_KEY`.

`GEMINI_API_KEY` is server-side only. Do not prefix it with `VITE_`, commit it, or place it in frontend code. Plan generation uses an immediate Gemini failover chain: `gemini-3.5-flash`, `gemini-flash-latest`, `gemini-3.1-flash-lite`, then `gemini-2.0-flash`.

## Local development

Run the Vite frontend:

```bash
npm run dev
```

To exercise `/api/generatePlan` locally, use the Vercel CLI so the serverless API is available:

```bash
npx vercel dev
```

The endpoint accepts the existing chat-style request body and returns either:

```json
{ "success": true, "plan": {} }
```

or:

```json
{ "success": false, "error": "..." }
```

## Models diagnostic

To list every model available to the current `GEMINI_API_KEY` without generating a plan, send a POST request to:

```text
/api/generatePlan?diagnostic=models
```

The response contains each model's `name` and `supportedGenerationMethods`. It does not generate a plan.

## Vercel deployment

In Vercel, add every `VITE_FIREBASE_*` variable for the appropriate environment, plus `GEMINI_API_KEY` as a server-side environment variable. Do not expose it as a `VITE_` variable. Redeploy after changing environment variables.

## Build

```bash
npm run build
```
