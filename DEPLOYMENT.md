# Cognition — Deployment Guide

Cognition is a Vite + React IELTS Academic preparation app deployed entirely on Cloudflare.

## Architecture

```
                Cognition (Vite + React SPA)
                            │
                     Clerk Auth (session JWT)
                            │
                            ▼
          Cloudflare Worker  (cognition-api)  ◄── also serves the static frontend
              │            │            │
              ▼            ▼            ▼
        Cloudflare D1   Cloudflare R2   Gemini API
        user data       media/assets    (server-side,
        (cognition-db)  (cognition-     user's encrypted
                         media bucket)  credential)
```

- **Frontend + API**: a single Worker named `cognition` — production URL
  **https://cognition.eu.cc** (custom domain declared in `wrangler.toml` routes).
  `cognition.arunyagoojar.workers.dev` serves the same Worker. Static assets are
  served from the `[assets]` binding (`dist/`). The Worker runs first for every
  request to permanently redirect public HTTP URLs to the same HTTPS URL (308),
  preserving paths, query strings, and request methods. HTTPS assets are then
  passed through to `ASSETS`; `/api/*` retains its authentication and API routing.
  HTTP loopback development (`localhost`, `*.localhost`, `127.*`, and `::1`) is
  exempt; `[dev]` explicitly keeps Wrangler's upstream on HTTP localhost so it
  does not inherit the production route hostname. This uses a Worker invocation
  for each asset request as well as APIs.
- **Auth**: Clerk session tokens are verified in the Worker (RSASSA-PKCS1-v1_5 via
  WebCrypto against the instance JWKS on the Frontend API domain).
- **User data**: D1 `cognition-db` (id `edd1e971-91b6-4f37-bd9d-b49b763e7b7c`).
- **Media**: R2 bucket `cognition-media`, public delivery via the r2.dev domain. The
  runtime resolves media URLs through `src/utils/media.js` against
  `content-db/media_manifest.json` (353 objects).
- **AI**: user-supplied Gemini credentials are validated and AES-256-GCM-encrypted by
  the Worker, stored encrypted in D1, decrypted only transiently in Worker memory for
  server-side evaluation calls. Raw keys never persist in the browser and are never
  returned by any endpoint.

## Local development

```bash
npm ci
npm run dev:local            # local D1 migrations + Worker :8787 + Vite :5173
```

Open http://127.0.0.1:5173. `/api` is proxied to the local Worker.
See [README.md](README.md) for optional environment overrides and local secrets.
Clerk authentication, R2 media, model downloads, and AI providers still need internet.

The shipped assets come from `public-static/` by default in both dev and build.
`PUBLIC_DIR_OVERRIDE` remains available for explicit alternate asset directories.

## Worker secrets

Set via `npx wrangler secret put <NAME>` (never in files or vars):

| Secret | Purpose |
|---|---|
| `CLERK_SECRET_KEY` | Clerk Backend API key |
| `CREDENTIAL_ENCRYPTION_KEY` | base64 32-byte AES-256-GCM master key (e.g. `openssl rand -base64 32`) |

Non-secret vars live in `wrangler.toml` `[vars]`: `ALLOWED_ORIGINS` (CORS allowlist) and
`CLERK_PUBLISHABLE_KEY` (used to derive the JWKS domain).

## D1 migrations

```bash
npx wrangler d1 migrations list cognition-db --remote
npx wrangler d1 migrations apply cognition-db --remote
```

- `0001_initial_schema.sql` — users, attempts, completed_lessons
- `0003_onboarding_state.sql` — per-account onboarding completion
- `0002_user_ai_credentials.sql` — encrypted AI credentials
  (`user_ai_credentials`: ciphertext, IV, version, masked suffix; UNIQUE per user+provider)

## R2 media

Media lives in bucket `cognition-media` (public access via r2.dev). Uploads are
deduplicated by SHA-256 and documented in `content-db/media_manifest.json`. To re-upload
a file (keys collapse consecutive dots — Cloudflare WAF rejects `...` in API paths):

```bash
npx wrangler r2 object put "cognition-media/<key>" --file <local> --content-type <mime> --remote
```

Note: `--remote` is required — without it wrangler writes to a local simulator.
Object sizes above 300 MiB are rejected by the API; large videos must be re-encoded
under that limit (see `content-db/orig/` for retained originals).

## Deploy

```bash
PUBLIC_DIR_OVERRIDE=public-static VITE_API_BASE_URL= npm run build
npx wrangler deploy
```

The production URL: https://cognition.eu.cc
(SPA fallback enabled; the Worker checks HTTPS before serving assets or APIs.)

Verify the HTTPS redirect after deployment:

```bash
curl -I 'http://cognition.eu.cc/?source=https-check'  # 308 to the same HTTPS URL
curl -I 'https://cognition.eu.cc/'                   # 200, no redirect loop
node test/https_redirect.test.js                    # routing regression checks
```

## Legacy cloud credential security model

Current Settings saves new Gemini/Groq keys on the current device and evaluates directly with the provider. The Worker path below remains for existing cloud credentials.

1. Browser sends the raw key once: `PUT /api/credentials/gemini` (authenticated).
2. Worker validates the key against Gemini's models endpoint, then encrypts it
   (AES-256-GCM, random 96-bit IV, master key from the Worker secret).
3. D1 stores only ciphertext + IV + version + last-4 suffix.
4. `GET /api/credentials/gemini/status` returns only
   `{ configured, provider, maskedSuffix, encryptionVersion }`.
5. `POST /api/ai/evaluate-writing` / `evaluate-speaking` decrypt the credential in
   memory, call Gemini, validate the rubric JSON, and return the evaluation only.
6. `DELETE /api/credentials/gemini` removes the row.
7. No endpoint returns the credential; legacy localStorage keys are detected in
   Settings and offered a one-time secure migration (then removed).
