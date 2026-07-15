# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and a Vercel serverless function that generates plans with Google Gemini.

## Prerequisites

1. Clone the repository and run `npm install`.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Copy `.env.example` to `.env.local` and fill in your Firebase values and `GEMINI_API_KEY`.

`GEMINI_API_KEY` and `GEMINI_MODEL` are server-side only. Do not prefix either with `VITE_`, commit the API key, or place either value in frontend code. Set `GEMINI_MODEL` explicitly before generating plans.

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

The response contains each model's `name` and `supportedGenerationMethods`. Choose a model that includes `generateContent`, then set its name (without the `models/` prefix) as `GEMINI_MODEL`.

## Vercel deployment

In Vercel, add every `VITE_FIREBASE_*` variable for the appropriate environment, plus `GEMINI_API_KEY` and the selected `GEMINI_MODEL` as server-side environment variables. Do not expose either Gemini variable as a `VITE_` variable. Redeploy after changing environment variables.

## Build

```bash
npm run build
```
