/**
 * Cognition Cloudflare Worker API + frontend host.
 * Verifies Clerk session tokens and provides user-scoped D1 access,
 * encrypted AI credential storage, and server-side AI evaluation.
 * Architecture: Browser → Clerk session → Worker (verify JWT) → D1 / Gemini
 */

import { encryptCredential, decryptCredential, maskedSuffix } from './crypto.js';
import {
  IELTS_WRITING_SYSTEM_PROMPT,
  IELTS_SPEAKING_SYSTEM_PROMPT,
  buildWritingUserPrompt,
  buildSpeakingUserPrompt,
  normalizeWritingEvaluation,
  normalizeSpeakingEvaluation,
  countWords,
  runEvaluationChain,
  validateGeminiKeyServer,
  validateGroqKeyServer,
  runAnswerVerification,
} from './ai.js';
import { isReverificationSatisfied, reverificationErrorBody } from './reverification.js';

const CLERK_JWKS_URL = 'https://api.clerk.com/v1/jwks';

let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_TTL = 3600000; // 1 hour

/**
 * Derives the instance's Frontend API domain from the publishable key
 * (public by design): pk_<env>_<base64url("$...$domain")>.
 */
function getFrontendApiDomain(env) {
  const pk = env.CLERK_PUBLISHABLE_KEY || '';
  const payload = pk.replace(/^pk_(test|live)_/, '');
  if (!payload) return null;
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const decoded = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const parts = decoded.split('$').filter(s => s.includes('.'));
    return parts.pop() || null;
  } catch {
    return null;
  }
}

async function getJWKS(env) {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_TTL) return jwksCache;
  // Preferred: canonical unauthenticated JWKS on the Frontend API domain.
  const domain = getFrontendApiDomain(env);
  const urls = domain
    ? [`https://${domain}/.well-known/jwks.json`, `${CLERK_JWKS_URL}`]
    : [`${CLERK_JWKS_URL}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, url.includes('api.clerk.com')
        ? { headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` } }
        : {});
      if (res.ok) {
        jwksCache = await res.json();
        jwksCacheTime = Date.now();
        return jwksCache;
      }
    } catch { /* try next source */ }
  }
  throw new Error('Failed to fetch JWKS');
}

async function verifyClerkToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const jwks = await getJWKS(env);
    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    const kid = header.kid;

    const key = jwks.keys.find(k => k.kid === kid);
    if (!key) return null;

    // workerd requires the explicit RSASSA-PKCS1-v1_5 + hash form for JWK import
    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );

    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, cryptoKey, signature, data);
    if (!valid) return null;

    // Verify expiry / not-before (small leeway for clock skew)
    const nowSec = Date.now() / 1000;
    if (typeof payload.exp !== 'number' || payload.exp < nowSec - 5) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > nowSec + 5) return null;
    // Authorized party: the token must have been minted for one of our origins
    if (payload.azp && !isAllowedOrigin(payload.azp, request, env)) return null;

    if (!payload.sub) return null;
    return { userId: payload.sub, email: payload.email || null, fva: payload.fva };
  } catch (e) {
    // Safe diagnostic only — never logs the token or provider internals.
    console.error('JWT verification failed:', e.constructor?.name || 'Error', e.message);
    return null;
  }
}

// ── CORS: explicit origin allowlist (same-origin + configured dev origins) ──

function isAllowedOrigin(origin, request, env) {
  const url = new URL(request.url);
  const selfOrigin = `${url.protocol}//${url.host}`;
  const allowList = (env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return origin === selfOrigin || allowList.includes(origin);
}

function resolveCorsHeaders(request, env) {
  const headers = { 'Content-Type': 'application/json' };
  const origin = request.headers.get('Origin');
  if (!origin) return headers; // same-origin fetch or non-browser client
  if (isAllowedOrigin(origin, request, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function handlePreflight(request, env) {
  const headers = resolveCorsHeaders(request, env);
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  headers['Access-Control-Max-Age'] = '86400';
  return new Response(null, { status: 204, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function error(message, status = 400, extraHeaders = {}) {
  return json({ error: message }, status, extraHeaders);
}

// ── Request body limits ─────────────────────────────────────────────────────
// Bounds what an authenticated client can push into D1 or relay to the AI
// provider. Two IELTS essays + prompts fit comfortably in 128 KB.
const BODY_LIMIT_SMALL = 16 * 1024;   // preferences, lessons, credentials
const BODY_LIMIT_ATTEMPT = 256 * 1024; // attempt records (feedback JSON)
const BODY_LIMIT_AI = 128 * 1024;      // essays / transcripts / verify items

class BodyError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyError('Request body too large', 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new BodyError('Request body too large', 413);
  }
  try {
    const parsed = JSON.parse(text || 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new BodyError('Invalid JSON body', 400);
  }
}

// ── Credential helpers ──────────────────────────────────────────────────────

const ALLOWED_PROVIDERS = new Set(['gemini', 'groq']);

async function loadCredential(env, userId, provider) {
  return env.DB.prepare(
    `SELECT encrypted_value, iv, encryption_version, masked_suffix
     FROM user_ai_credentials WHERE clerk_user_id = ? AND provider = ?`
  ).bind(userId, provider).first();
}

function base64KeyOrThrow(env) {
  const key = env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) throw new Error('Credential encryption is not configured');
  return key;
}

/**
 * Fail-fast check that the encryption secret is present AND usable
 * (valid base64, exactly 32 bytes). Runs a throw-away round trip, so a
 * misconfigured Worker is reported precisely instead of surfacing as an
 * opaque 500 after the user's key has already been validated.
 */
async function encryptionReady(env) {
  try {
    const probe = await encryptCredential('probe', base64KeyOrThrow(env));
    const back = await decryptCredential(probe.ciphertext, probe.iv, base64KeyOrThrow(env));
    return back === 'probe';
  } catch {
    return false;
  }
}

/** Verifies the Clerk account for `userId` exists. 'unknown' = could not tell. */
async function clerkUserState(env, userId) {
  if (!env.CLERK_SECRET_KEY) return 'unknown';
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
    if (res.status === 200) return 'exists';
    if (res.status === 404) return 'gone';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = resolveCorsHeaders(request, env);

    if (request.method === 'OPTIONS') return handlePreflight(request, env);

    try {
      // Verify authentication for all /api routes
      if (path.startsWith('/api/')) {
        const auth = await verifyClerkToken(request, env);
        if (!auth) return error('Unauthorized', 401, corsHeaders);
        const userId = auth.userId;

        // ── GET /api/me — get or provision user ──
        if (path === '/api/me' && request.method === 'GET') {
          let user = await env.DB.prepare(
            'SELECT * FROM users WHERE clerk_user_id = ?'
          ).bind(userId).first();

          if (!user) {
            // First login — provision user. A still-valid token belonging to an
            // account that was just deleted must not resurrect its D1 row.
            if (await clerkUserState(env, userId) === 'gone') {
              return error('This account no longer exists.', 401, corsHeaders);
            }
            await env.DB.prepare(
              'INSERT INTO users (clerk_user_id, email, full_name) VALUES (?, ?, ?)'
            ).bind(userId, auth.email || '', '').run();
            user = await env.DB.prepare(
              'SELECT * FROM users WHERE clerk_user_id = ?'
            ).bind(userId).first();
          }
          return json(user, 200, corsHeaders);
        }

        // ── DELETE /api/me — full account deletion ──
        // Order (never a half-deleted account):
        //   0. The Clerk session must be freshly verified (reverification).
        //      The identity comes ONLY from the verified JWT `sub`.
        //   1. Pre-flight: confirm we can actually reach/administer the Clerk
        //      account BEFORE destroying anything.
        //   2. Purge every D1 row for the user in ONE atomic batch (idempotent).
        //   3. Only after the purge succeeds, delete the Clerk account.
        if (path === '/api/me' && request.method === 'DELETE') {
          if (!isReverificationSatisfied(auth.fva, 'strict')) {
            return json(reverificationErrorBody('strict'), 403, corsHeaders);
          }
          if (!env.CLERK_SECRET_KEY) {
            return json({ error: 'Account deletion is not configured on the server. Nothing was deleted.', stage: 'config' }, 500, corsHeaders);
          }
          const preflight = await clerkUserState(env, userId);
          if (preflight === 'unknown') {
            return json({ error: 'Could not reach the identity provider. Nothing was deleted — please try again.', stage: 'preflight' }, 502, corsHeaders);
          }

          try {
            await env.DB.batch([
              env.DB.prepare('DELETE FROM attempts WHERE clerk_user_id = ?').bind(userId),
              env.DB.prepare('DELETE FROM completed_lessons WHERE clerk_user_id = ?').bind(userId),
              env.DB.prepare('DELETE FROM user_ai_credentials WHERE clerk_user_id = ?').bind(userId),
              env.DB.prepare('DELETE FROM users WHERE clerk_user_id = ?').bind(userId),
            ]);
          } catch (e) {
            console.error('Account purge failed:', e.constructor?.name || 'Error', e.message);
            return json({ error: 'Failed to erase your saved data. Your account was not deleted — please retry.', stage: 'd1' }, 500, corsHeaders);
          }

          if (preflight === 'gone') {
            return json({ deleted: true, clerkDeleted: 'already_gone' }, 200, corsHeaders);
          }
          let clerkRes;
          try {
            clerkRes = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
            });
          } catch {
            return json({ error: 'Your saved data was erased but the account itself could not be removed yet. Please retry — it is safe to repeat.', stage: 'clerk' }, 502, corsHeaders);
          }
          if (!clerkRes.ok && clerkRes.status !== 404) {
            const detail = clerkRes.status === 429
              ? 'Your saved data was erased; the identity provider is rate-limiting. Please retry shortly — it is safe to repeat.'
              : 'Your saved data was erased but the account itself could not be removed yet. Please retry — it is safe to repeat.';
            return json({ error: detail, stage: 'clerk' }, 502, corsHeaders);
          }
          return json({ deleted: true, clerkDeleted: true }, 200, corsHeaders);
        }

        // ── PUT /api/me/onboarding — mark onboarding completed/skipped (once) ──
        if (path === '/api/me/onboarding' && request.method === 'PUT') {
          await env.DB.prepare(
            `UPDATE users SET onboarding_completed_at = COALESCE(onboarding_completed_at, datetime('now'))
             WHERE clerk_user_id = ?`
          ).bind(userId).run();
          const row = await env.DB.prepare(
            'SELECT onboarding_completed_at FROM users WHERE clerk_user_id = ?'
          ).bind(userId).first();
          return json({ onboardingCompleted: Boolean(row?.onboarding_completed_at) }, 200, corsHeaders);
        }

        // ── PUT /api/me/preferences — update preferences ──
        if (path === '/api/me/preferences' && request.method === 'PUT') {
          const body = await readJson(request, BODY_LIMIT_SMALL);
          const updates = [];
          const params = [];
          if (body.target_band !== undefined) { updates.push('target_band = ?'); params.push(String(body.target_band).slice(0, 8)); }
          if (body.theme !== undefined) { updates.push('theme = ?'); params.push(String(body.theme).slice(0, 16)); }
          if (updates.length) {
            updates.push('updated_at = datetime(\'now\')');
            params.push(userId);
            await env.DB.prepare(
              `UPDATE users SET ${updates.join(', ')} WHERE clerk_user_id = ?`
            ).bind(...params).run();
          }
          const user = await env.DB.prepare(
            'SELECT target_band, theme FROM users WHERE clerk_user_id = ?'
          ).bind(userId).first();
          return json(user, 200, corsHeaders);
        }

        // ── GET /api/attempts — list user's attempts ──
        if (path === '/api/attempts' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT * FROM attempts WHERE clerk_user_id = ? ORDER BY updated_at DESC LIMIT 100'
          ).bind(userId).all();
          return json(results || [], 200, corsHeaders);
        }

        // ── GET /api/attempts/:id — get specific attempt ──
        const attemptMatch = path.match(/^\/api\/attempts\/(.+)$/);
        if (attemptMatch && request.method === 'GET') {
          const attempt = await env.DB.prepare(
            'SELECT * FROM attempts WHERE id = ? AND clerk_user_id = ?'
          ).bind(attemptMatch[1], userId).first();
          if (!attempt) return error('Attempt not found', 404, corsHeaders);
          return json(attempt, 200, corsHeaders);
        }

        // ── POST /api/attempts — create attempt ──
        if (path === '/api/attempts' && request.method === 'POST') {
          const body = await readJson(request, BODY_LIMIT_ATTEMPT);
          if (!body.id || !body.type) return error('Missing id or type', 400, corsHeaders);
          const existing = await env.DB.prepare(
            'SELECT id FROM attempts WHERE id = ?'
          ).bind(body.id).first();
          if (existing) return error('Attempt already exists', 409, corsHeaders);
          await env.DB.prepare(
            `INSERT INTO attempts (id, clerk_user_id, type, test_id, test_label, status, band, data, started_at, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            body.id, userId, body.type, body.test_id || '', body.test_label || '',
            body.status || 'completed', body.band || null,
            body.data ? JSON.stringify(body.data) : null,
            body.started_at || new Date().toISOString(),
            body.completed_at || new Date().toISOString()
          ).run();
          return json({ id: body.id, created: true }, 201, corsHeaders);
        }

        // ── PUT /api/attempts/:id — update attempt ──
        if (attemptMatch && request.method === 'PUT') {
          const body = await readJson(request, BODY_LIMIT_ATTEMPT);
          const existing = await env.DB.prepare(
            'SELECT id FROM attempts WHERE id = ? AND clerk_user_id = ?'
          ).bind(attemptMatch[1], userId).first();
          if (!existing) return error('Attempt not found', 404, corsHeaders);
          const updates = [];
          const params = [];
          if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
          if (body.band !== undefined) { updates.push('band = ?'); params.push(body.band); }
          if (body.data !== undefined) { updates.push('data = ?'); params.push(JSON.stringify(body.data)); }
          if (body.completed_at !== undefined) { updates.push('completed_at = ?'); params.push(body.completed_at); }
          if (updates.length) {
            updates.push('updated_at = datetime(\'now\')');
            params.push(attemptMatch[1], userId);
            await env.DB.prepare(
              `UPDATE attempts SET ${updates.join(', ')} WHERE id = ? AND clerk_user_id = ?`
            ).bind(...params).run();
          }
          return json({ id: attemptMatch[1], updated: true }, 200, corsHeaders);
        }

        // ── GET /api/lessons — completed lessons ──
        if (path === '/api/lessons' && request.method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT lesson_id, completed_at FROM completed_lessons WHERE clerk_user_id = ?'
          ).bind(userId).all();
          return json(results || [], 200, corsHeaders);
        }

        // ── POST /api/lessons — mark lesson complete ──
        if (path === '/api/lessons' && request.method === 'POST') {
          const body = await readJson(request, BODY_LIMIT_SMALL);
          if (!body.lesson_id) return error('Missing lesson_id', 400, corsHeaders);
          await env.DB.prepare(
            'INSERT OR IGNORE INTO completed_lessons (id, clerk_user_id, lesson_id) VALUES (?, ?, ?)'
          ).bind(crypto.randomUUID(), userId, body.lesson_id).run();
          return json({ ok: true }, 200, corsHeaders);
        }

        // ── PUT /api/credentials/:provider — store/replace encrypted credential ──
        const credMatch = path.match(/^\/api\/credentials\/([a-z0-9_-]+)$/);
        if (credMatch && request.method === 'PUT') {
          const provider = credMatch[1];
          if (!ALLOWED_PROVIDERS.has(provider)) return error('Unknown provider', 400, corsHeaders);

          let body;
          try { body = await readJson(request, BODY_LIMIT_SMALL); } catch (e) {
            if (e instanceof BodyError && e.status === 413) return error(e.message, 413, corsHeaders);
            body = null;
          }
          const key = (body?.key || '').trim();
          if (!key) return json({ error: 'Paste your API key first.', code: 'empty_key' }, 400, corsHeaders);
          if (key.length < 20 || key.length > 512 || /\s/.test(key)) {
            return json({ error: 'That does not look like a valid API key (wrong length or contains spaces).', code: 'invalid_key' }, 400, corsHeaders);
          }

          // Fail fast when server-side encryption is unusable — before the key
          // is sent anywhere else and before any misleading "rejected" message.
          if (!(await encryptionReady(env))) {
            console.error('Credential save blocked: CREDENTIAL_ENCRYPTION_KEY missing or invalid');
            return json({ error: 'Secure key storage is not available on the server right now.', code: 'storage_unavailable' }, 503, corsHeaders);
          }

          // Server-side validation against the provider before storing (Part K)
          if (provider === 'gemini') {
            const check = await validateGeminiKeyServer(key);
            if (!check.valid) {
              return json({ error: check.message || 'Key validation failed', code: check.code || 'invalid_key', validated: false }, 400, corsHeaders);
            }
          } else if (provider === 'groq') {
            const check = await validateGroqKeyServer(key);
            if (!check.valid) {
              return json({ error: check.message || 'Key validation failed', code: check.code || 'invalid_key', validated: false }, 400, corsHeaders);
            }
          }

          let encrypted;
          try {
            encrypted = await encryptCredential(key, base64KeyOrThrow(env));
            await env.DB.prepare(
              `INSERT INTO user_ai_credentials
                 (id, clerk_user_id, provider, encrypted_value, iv, encryption_version, masked_suffix)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (clerk_user_id, provider) DO UPDATE SET
                 encrypted_value = excluded.encrypted_value,
                 iv = excluded.iv,
                 encryption_version = excluded.encryption_version,
                 masked_suffix = excluded.masked_suffix,
                 updated_at = datetime('now')`
            ).bind(
              crypto.randomUUID(), userId, provider,
              encrypted.ciphertext, encrypted.iv, encrypted.version,
              maskedSuffix(key)
            ).run();
          } catch (e) {
            // Type + message only — the key itself is never part of these.
            console.error('Credential write failed:', e.constructor?.name || 'Error', e.message);
            return json({ error: 'Could not store the key securely right now.', code: 'storage_failed' }, 503, corsHeaders);
          }

          return json({
            configured: true,
            provider,
            maskedSuffix: maskedSuffix(key),
            encryptionVersion: encrypted.version,
          }, 200, corsHeaders);
        }

        // ── GET /api/credentials/:provider/status — NEVER returns the key ──
        const credStatusMatch = path.match(/^\/api\/credentials\/([a-z0-9_-]+)\/status$/);
        if (credStatusMatch && request.method === 'GET') {
          const provider = credStatusMatch[1];
          if (!ALLOWED_PROVIDERS.has(provider)) return error('Unknown provider', 400, corsHeaders);
          const row = await loadCredential(env, userId, provider);
          return json({
            configured: Boolean(row),
            provider,
            maskedSuffix: row ? row.masked_suffix : null,
            encryptionVersion: row ? row.encryption_version : null,
          }, 200, corsHeaders);
        }

        // ── DELETE /api/credentials/:provider ──
        if (credMatch && request.method === 'DELETE') {
          const provider = credMatch[1];
          if (!ALLOWED_PROVIDERS.has(provider)) return error('Unknown provider', 400, corsHeaders);
          await env.DB.prepare(
            'DELETE FROM user_ai_credentials WHERE clerk_user_id = ? AND provider = ?'
          ).bind(userId, provider).run();
          return json({ configured: false, provider }, 200, corsHeaders);
        }

        // ── Helper to load configured credential for requested or fallback provider ──
        async function resolveCredential(requestedProvider, explicitKey = null) {
          if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()
              && explicitKey.trim().length <= 512 && !/\s/.test(explicitKey.trim())) {
            const prov = (requestedProvider && ALLOWED_PROVIDERS.has(requestedProvider)) ? requestedProvider : 'gemini';
            return { cred: { explicit: true, plaintext: explicitKey.trim() }, provider: prov };
          }
          if (requestedProvider && ALLOWED_PROVIDERS.has(requestedProvider)) {
            const cred = await loadCredential(env, userId, requestedProvider);
            if (cred) return { cred, provider: requestedProvider };
          }
          const geminiCred = await loadCredential(env, userId, 'gemini');
          if (geminiCred) return { cred: geminiCred, provider: 'gemini' };
          const groqCred = await loadCredential(env, userId, 'groq');
          if (groqCred) return { cred: groqCred, provider: 'groq' };
          return { cred: null, provider: null };
        }

        // ── POST /api/ai/evaluate-writing — session-level, server-side evaluation (Gemini / Groq) ──
        if (path === '/api/ai/evaluate-writing' && request.method === 'POST') {
          const body = await readJson(request, BODY_LIMIT_AI);
          const { cred, provider: providerToUse } = await resolveCredential(body.provider, body.key);
          if (!cred) {
            return json({
              status: 'failed',
              message: 'AI evaluation is not configured. Add your Gemini or Groq API key in Settings.',
            }, 200, corsHeaders);
          }
          const t1Clean = (body.task1Text || '').trim();
          const t2Clean = (body.task2Text || '').trim();
          if (!t1Clean && !t2Clean) {
            return json({ status: 'failed', message: 'No essay content submitted for evaluation.' }, 200, corsHeaders);
          }

          const t1Words = typeof body.task1Words === 'number' ? body.task1Words : countWords(t1Clean);
          const t2Words = typeof body.task2Words === 'number' ? body.task2Words : countWords(t2Clean);
          const userPrompt = buildWritingUserPrompt({
            prompts: body.prompts || {},
            task1Text: t1Clean,
            task2Text: t2Clean,
            task1Words: t1Words,
            task2Words: t2Words,
          });

          const plaintextKey = cred.explicit
            ? cred.plaintext
            : await decryptCredential(cred.encrypted_value, cred.iv, base64KeyOrThrow(env));
          const result = await runEvaluationChain({
            apiKey: plaintextKey,
            systemPrompt: IELTS_WRITING_SYSTEM_PROMPT,
            userPrompt,
            provider: providerToUse,
            // bands are computed in code from the whole-band criteria
            validator: (data) => normalizeWritingEvaluation(data, { task1Words: t1Words, task2Words: t2Words }),
          });
          // plaintextKey goes out of scope here — never stored or returned.
          return json(result, 200, corsHeaders);
        }

        // ── POST /api/ai/evaluate-speaking — session-level, server-side evaluation (Gemini / Groq) ──
        if (path === '/api/ai/evaluate-speaking' && request.method === 'POST') {
          const body = await readJson(request, BODY_LIMIT_AI);
          const { cred, provider: providerToUse } = await resolveCredential(body.provider, body.key);
          if (!cred) {
            return json({
              status: 'failed',
              message: 'AI evaluation is not configured. Add your Gemini or Groq API key in Settings.',
            }, 200, corsHeaders);
          }
          const transcripts = body.transcripts || {};
          const combinedSpeech = Object.values(transcripts).filter(Boolean).join(' ').trim();
          const wordCount = combinedSpeech ? combinedSpeech.split(/\s+/).length : 0;
          if (wordCount < 10) {
            return json({
              status: 'failed',
              message: 'Insufficient audio/transcript content recorded for evaluation (minimum 10 words required).',
            }, 200, corsHeaders);
          }

          const userPrompt = buildSpeakingUserPrompt({
            transcripts, testMeta: body.testMeta || {}, durations: body.durations || {},
          });

          const plaintextKey = cred.explicit
            ? cred.plaintext
            : await decryptCredential(cred.encrypted_value, cred.iv, base64KeyOrThrow(env));
          const result = await runEvaluationChain({
            apiKey: plaintextKey,
            systemPrompt: IELTS_SPEAKING_SYSTEM_PROMPT,
            userPrompt,
            provider: providerToUse,
            // transcript only: pronunciation is never inferred
            validator: (data) => normalizeSpeakingEvaluation(data, { audioAssessed: false }),
          });
          return json(result, 200, corsHeaders);
        }

        // ── POST /api/ai/verify-answers — batched objective-answer verification (Gemini / Groq) ──
        if (path === '/api/ai/verify-answers' && request.method === 'POST') {
          const body = await readJson(request, BODY_LIMIT_AI);
          const { cred, provider: providerToUse } = await resolveCredential(body.provider, body.key);
          if (!cred) {
            // Without a configured credential the deterministic result stands
            // (UNCERTAIN is treated as INCORRECT by the engine).
            return json({ results: [] }, 200, corsHeaders);
          }
          const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
          if (items.length === 0) return json({ results: [] }, 200, corsHeaders);

          const plaintextKey = cred.explicit
            ? cred.plaintext
            : await decryptCredential(cred.encrypted_value, cred.iv, base64KeyOrThrow(env));
          const result = await runAnswerVerification(items, plaintextKey, providerToUse);
          // plaintextKey goes out of scope — never stored, logged, or returned.
          return json(result, 200, corsHeaders);
        }

        return error('Not found', 404, corsHeaders);
      }

      return error('Not found', 404, corsHeaders);
    } catch (e) {
      if (e instanceof BodyError) return error(e.message, e.status, corsHeaders);
      // Log only the error type — never request bodies, keys, or stack internals.
      console.error('Worker error:', e.constructor?.name || 'Error', e.message);
      return error('Internal server error', 500, corsHeaders);
    }
  }
};
