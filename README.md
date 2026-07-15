# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and a Vercel serverless function that generates plans with Google Gemini.

## Prerequisites

1. Clone the repository and run `npm install`.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Copy `.env.example` to `.env.local` and fill in your Firebase values and `GEMINI_API_KEY`.

`GEMINI_API_KEY` and `GEMINI_MODEL` are server-side only. Do not prefix either with `VITE_`, commit the API key, or place either value in frontend code. `GEMINI_MODEL` defaults to `gemini-2.5-flash-lite` when it is not configured.

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

## Vercel deployment

In Vercel, add every `VITE_FIREBASE_*` variable for the appropriate environment and add `GEMINI_API_KEY` as a server-side environment variable. Optionally add `GEMINI_MODEL` to override the default `gemini-2.5-flash-lite`. Do not expose either Gemini variable as a `VITE_` variable. Redeploy after changing environment variables.

## Build

```bash
npm run build
```
