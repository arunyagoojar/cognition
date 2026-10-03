/**
 * Cognition Cloudflare Worker API + frontend host.
 * Verifies Clerk session tokens and provides user-scoped D1 access,
 * encrypted AI credential storage, and server-side AI evaluation.
 * Architecture: Browser → Clerk session → Worker (verify JWT) → D1 / Gemini
 */

import { encryptCredential, decryptCredential, maskedSuffix } from './crypto.js';
import {
  IELTS_WRITING_SYSTEM_PROMPT_V1,
  IELTS_SPEAKING_SYSTEM_PROMPT_V1,
  validateWritingEvaluationJson,
  validateSpeakingEvaluationJson,
  runEvaluationChain,
  validateGeminiKeyServer,
  runAnswerVerification,
} from './ai.js';

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

    // Verify expiry
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    return { userId: payload.sub, email: payload.email || null };
  } catch (e) {
    // Safe diagnostic only — never logs the token or provider internals.
    console.error('JWT verification failed:', e.constructor?.name || 'Error', e.message);
    return null;
  }
}

// ── CORS: explicit origin allowlist (same-origin + configured dev origins) ──

function resolveCorsHeaders(request, env) {
  const headers = { 'Content-Type': 'application/json' };
  const origin = request.headers.get('Origin');
  if (!origin) return headers; // same-origin fetch or non-browser client
  const url = new URL(request.url);
  const selfOrigin = `${url.protocol}//${url.host}`;
  const allowList = (env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (origin === selfOrigin || allowList.includes(origin)) {
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

// ── Credential helpers ──────────────────────────────────────────────────────

const ALLOWED_PROVIDERS = new Set(['gemini']);

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
            // First login — provision user
            await env.DB.prepare(
              'INSERT INTO users (clerk_user_id, email, full_name) VALUES (?, ?, ?)'
            ).bind(userId, auth.email || '', '').run();
            user = await env.DB.prepare(
              'SELECT * FROM users WHERE clerk_user_id = ?'
            ).bind(userId).first();
          }
          return json(user, 200, corsHeaders);
        }

        // ── PUT /api/me/preferences — update preferences ──
        if (path === '/api/me/preferences' && request.method === 'PUT') {
          const body = await request.json();
          const updates = [];
          const params = [];
          if (body.target_band !== undefined) { updates.push('target_band = ?'); params.push(String(body.target_band)); }
          if (body.theme !== undefined) { updates.push('theme = ?'); params.push(String(body.theme)); }
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
          const body = await request.json();
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
          const body = await request.json();
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
          const body = await request.json();
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

          const body = await request.json();
          const key = (body.key || '').trim();
          if (!key || key.length < 20 || key.length > 512 || /\s/.test(key)) {
            return error('Invalid API key format', 400, corsHeaders);
          }

          // Server-side validation against the provider before storing (Part K)
          if (provider === 'gemini') {
            const check = await validateGeminiKeyServer(key);
            if (!check.valid) {
              return json({ error: check.message || 'Key validation failed', validated: false }, 400, corsHeaders);
            }
          }

          const encrypted = await encryptCredential(key, base64KeyOrThrow(env));
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

        // ── POST /api/ai/evaluate-writing — session-level, server-side Gemini ──
        if (path === '/api/ai/evaluate-writing' && request.method === 'POST') {
          const cred = await loadCredential(env, userId, 'gemini');
          if (!cred) {
            return json({
              status: 'failed',
              message: 'AI evaluation is not configured. Add your Gemini API key in Settings.',
            }, 200, corsHeaders);
          }
          const body = await request.json();
          const t1Clean = (body.task1Text || '').trim();
          const t2Clean = (body.task2Text || '').trim();
          if (!t1Clean && !t2Clean) {
            return json({ status: 'failed', message: 'No essay content submitted for evaluation.' }, 200, corsHeaders);
          }

          const t1Words = t1Clean ? t1Clean.split(/\s+/).length : 0;
          const t2Words = t2Clean ? t2Clean.split(/\s+/).length : 0;
          const prompts = body.prompts || {};
          const userPrompt = `Evaluate the candidate's IELTS Academic Writing submission:
Task 1 Prompt: ${prompts.task1 || 'Academic visual/data report (150 words minimum)'}
Task 1 Candidate Response (${t1Words} words):
${t1Clean || '(No response submitted)'}

Task 2 Prompt: ${prompts.task2 || 'Academic discursive essay (250 words minimum)'}
Task 2 Candidate Response (${t2Words} words):
${t2Clean || '(No response submitted)'}`;

          const plaintextKey = await decryptCredential(
            cred.encrypted_value, cred.iv, base64KeyOrThrow(env)
          );
          const result = await runEvaluationChain({
            apiKey: plaintextKey,
            systemPrompt: IELTS_WRITING_SYSTEM_PROMPT_V1,
            userPrompt,
            validator: validateWritingEvaluationJson,
          });
          // plaintextKey goes out of scope here — never stored or returned.
          return json(result, 200, corsHeaders);
        }

        // ── POST /api/ai/evaluate-speaking — session-level, server-side Gemini ──
        if (path === '/api/ai/evaluate-speaking' && request.method === 'POST') {
          const cred = await loadCredential(env, userId, 'gemini');
          if (!cred) {
            return json({
              status: 'failed',
              message: 'AI evaluation is not configured. Add your Gemini API key in Settings.',
            }, 200, corsHeaders);
          }
          const body = await request.json();
          const transcripts = body.transcripts || {};
          const combinedSpeech = Object.values(transcripts).filter(Boolean).join(' ').trim();
          const wordCount = combinedSpeech ? combinedSpeech.split(/\s+/).length : 0;
          if (wordCount < 10) {
            return json({
              status: 'failed',
              message: 'Insufficient audio/transcript content recorded for evaluation (minimum 10 words required).',
            }, 200, corsHeaders);
          }

          const testMeta = body.testMeta || {};
          const userPrompt = `Candidate Responses by Part:
${JSON.stringify(transcripts, null, 2)}

Test Topic Context: ${testMeta.title || 'IELTS Speaking Academic Interview'}`;

          const plaintextKey = await decryptCredential(
            cred.encrypted_value, cred.iv, base64KeyOrThrow(env)
          );
          const result = await runEvaluationChain({
            apiKey: plaintextKey,
            systemPrompt: IELTS_SPEAKING_SYSTEM_PROMPT_V1,
            userPrompt,
            validator: validateSpeakingEvaluationJson,
          });
          return json(result, 200, corsHeaders);
        }

        // ── POST /api/ai/verify-answers — batched objective-answer verification ──
        if (path === '/api/ai/verify-answers' && request.method === 'POST') {
          const cred = await loadCredential(env, userId, 'gemini');
          if (!cred) {
            // Without a configured credential the deterministic result stands
            // (UNCERTAIN is treated as INCORRECT by the engine).
            return json({ results: [] }, 200, corsHeaders);
          }
          const body = await request.json();
          const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
          if (items.length === 0) return json({ results: [] }, 200, corsHeaders);

          const plaintextKey = await decryptCredential(
            cred.encrypted_value, cred.iv, base64KeyOrThrow(env)
          );
          const result = await runAnswerVerification(items, plaintextKey);
          // plaintextKey goes out of scope — never stored, logged, or returned.
          return json(result, 200, corsHeaders);
        }

        return error('Not found', 404, corsHeaders);
      }

      return error('Not found', 404, corsHeaders);
    } catch (e) {
      // Log only the error type — never request bodies, keys, or stack internals.
      console.error('Worker error:', e.constructor?.name || 'Error', e.message);
      return error('Internal server error', 500, corsHeaders);
    }
  }
};
