# Cognition

IELTS Academic preparation with Listening, Reading, Writing, Speaking, full mock exams, learning videos, tips, local grammar practice, and progress tracking. Built with React/Vite and a Cloudflare Worker/D1 API.

## Run locally

Use a recent Node.js version supported by the installed Vite version (this checkout was verified with Node 26.7.0).

```sh
npm ci
npm run dev:local
```

Open http://127.0.0.1:5173. This command applies **local-only** D1 migrations, starts the Worker on port 8787, and starts Vite on port 5173. Ctrl+C stops both servers. No Cloudflare deployment or remote database migration occurs. If either port is occupied, stop the existing process first.

No `.env` file is necessary for the existing public Clerk key and R2 media library. For overrides, copy `.env.example` to `.env.local` and fill only the values you need. Keep `VITE_API_BASE_URL` blank to use the local API proxy.

Authentication still uses the existing Clerk development instance; lessons/media and initial speech-model downloads need internet. AI grading needs a user-supplied Gemini or Groq key. Running the web server locally does not make every feature offline.

Optional Worker secrets belong in `.dev.vars` (ignored by Git), never in a `VITE_` variable:

- `CLERK_SECRET_KEY`: needed for Clerk administrative actions, such as account deletion. Account deletion affects the configured Clerk instance even when D1 is local.
- `CREDENTIAL_ENCRYPTION_KEY`: base64 32-byte key for legacy cloud-stored credentials. Current Settings saves new AI keys on the current device.

For separate terminals: `npm run db:local`, then `npm run dev:api` and `npm run dev`.

## Checks

```sh
npm test
npm run lint
npm run build
npm run validate:production:reading
```

`npm run validate:production:writing` re-derives content from the original source mirror. Set `COGNITION_SRC_ROOT` to that directory; it is not included in this checkout. It also needs BeautifulSoup4 and Pillow. `npm run release:check` intentionally requires this source validation and fails if the mirror is missing.

## Project map

- `src/`: app, evaluation, storage, speech processing, and generated runtime content.
- `worker/`, `migrations/`: authenticated API and database schema.
- `public-static/`: shipped icons; default asset directory for both development and production.
- `content-db/`: source records, reviewed content, manifests, and validation evidence.
- `pipeline/`: retained production-content generators and independent validators. Python is not required to run the app.
- `test/`, `qa/`: automated checks and manual development harnesses; not shipped in the app.
- `scripts/`: local startup and opt-in release/live checks. Production lifecycle scripts can create/delete remote test accounts; they are not part of `npm test` or local startup.

See `DEPLOYMENT.md` for hosting details. The local setup does not deploy anything.
