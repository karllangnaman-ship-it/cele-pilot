# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and a Vercel serverless function that generates plans with Google Gemini.

## Prerequisites

1. Clone the repository and run `npm install`.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Copy `.env.example` to `.env.local` and fill in your Firebase values and `GEMINI_API_KEY`.

`GEMINI_API_KEY` is server-side only. Do not prefix it with `VITE_`, commit it, or place it in frontend code.

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

In Vercel, add every `VITE_FIREBASE_*` variable for the appropriate environment and add `GEMINI_API_KEY` as a server-side environment variable. Do not expose it as a `VITE_` variable. Redeploy after changing environment variables.

## Build

```bash
npm run build
```
