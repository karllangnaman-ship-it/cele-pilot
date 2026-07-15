# AGENTS.md

## Project Context

This is a Firebase-backed CELE Pilot app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and build workflow.

## Key Files

- `src/`: frontend application source.
- `src/api/firebaseClient.js`: frontend Firebase and Gemini integration layer.
- `src/firebase.js`: Firebase initialization.
- `vite.config.js`: Vite config.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` for local frontend development.
- Keep Firebase Authentication, Firestore, Storage, and Gemini API usage centralized in the Firebase integration layer.
- Run the relevant checks from `package.json` before finishing code changes.
