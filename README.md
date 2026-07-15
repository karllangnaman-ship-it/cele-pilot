# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and a Vercel serverless function for plan generation.

## Prerequisites

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies with `npm install`.
4. Create a local environment file with your Firebase configuration and Cerebras API key.

## Local Development

Run the frontend locally:

```bash
npm run dev
```

## Environment Variables

Create a `.env.local` file in the project root and add:

```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
CEREBRAS_API_KEY=your_cerebras_api_key
```

For Vercel, add all six `VITE_FIREBASE_*` variables to the Production environment. They are compiled into the Vite frontend, so redeploy after changing them. Add `CEREBRAS_API_KEY` only as a server-side Vercel environment variable; it is used exclusively by `api/generatePlan.js` and must not be prefixed with `VITE_`.

## Build

```bash
npm run build
```
