# CELE Pilot

CELE Pilot is a Vite + React study-planning app powered by Firebase Authentication, Firestore, Firebase Storage, and the Gemini API.

## Prerequisites

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies with `npm install`.
4. Create a local environment file with your Firebase and Gemini credentials.

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
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Build

```bash
npm run build
```
