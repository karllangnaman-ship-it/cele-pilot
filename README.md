# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, private Supabase Storage accessed only through a Vercel server API, and Google Gemini.

## Prerequisites

1. Clone the repository and run `npm install`.
2. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Copy `.env.example` to `.env.local` and fill in your Firebase and Supabase build values.

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

## Vercel deployment and private storage

In Vercel, add every `VITE_FIREBASE_*` variable required by the frontend, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Add `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` as server-only variables. `SUPABASE_URL` may be used as a server-only alternative to `VITE_SUPABASE_URL`.

Apply [`supabase/storage-policies.sql`](supabase/storage-policies.sql) in the Supabase SQL editor. It creates the private `cele-pilot` bucket and revokes direct anon/authenticated object access. The browser never receives the service-role key and every storage API request verifies a Firebase ID token before restricting object paths to `users/{firebaseUid}/`.

The storage API routes are `/api/storage/upload`, `/download`, `/list`, `/delete`, `/rename`, `/move`, `/create-folder`, `/delete-folder`, and `/signed-url`. Uploads stream binary files through Vercel, report progress/speed/ETA, retry transient network failures, pause while offline, and resume automatically when connectivity returns. Configure Vercel's request-body limits/plan for uploads larger than 45 MB; the API rejects larger requests deliberately rather than buffering an unbounded file in memory.

## Build

```bash
npm run build
```
