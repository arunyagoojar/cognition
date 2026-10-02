/**
 * Cognition Cloudflare Worker API.
 * Verifies Clerk session tokens and provides user-scoped D1 access.
 * Architecture: Browser → Clerk session → Worker (verify JWT) → D1
 */

const CLERK_JWKS_URL = 'https://api.clerk.com/v1/jwks';

let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_TTL = 3600000; // 1 hour

async function getJWKS(env) {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_TTL) return jwksCache;
  const res = await fetch(CLERK_JWKS_URL, {
    headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to fetch JWKS');
  jwksCache = await res.json();
  jwksCacheTime = Date.now();
  return jwksCache;
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

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key, { name: 'RS256', hash: 'SHA-256' }, false, ['verify']
    );

    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RS256', cryptoKey, signature, data);
    if (!valid) return null;

    // Verify expiry
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    return { userId: payload.sub, email: payload.email || null };
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    try {
      // Verify authentication for all /api routes
      if (path.startsWith('/api/')) {
        const auth = await verifyClerkToken(request, env);
        if (!auth) return error('Unauthorized', 401);
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
          if (!attempt) return error('Attempt not found', 404);
          return json(attempt, 200, corsHeaders);
        }

        // ── POST /api/attempts — create attempt ──
        if (path === '/api/attempts' && request.method === 'POST') {
          const body = await request.json();
          if (!body.id || !body.type) return error('Missing id or type', 400);
          const existing = await env.DB.prepare(
            'SELECT id FROM attempts WHERE id = ?'
          ).bind(body.id).first();
          if (existing) return error('Attempt already exists', 409);
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
          if (!existing) return error('Attempt not found', 404);
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
          if (!body.lesson_id) return error('Missing lesson_id', 400);
          await env.DB.prepare(
            'INSERT OR IGNORE INTO completed_lessons (id, clerk_user_id, lesson_id) VALUES (?, ?, ?)'
          ).bind(crypto.randomUUID(), userId, body.lesson_id).run();
          return json({ ok: true }, 200, corsHeaders);
        }

        return error('Not found', 404);
      }

      return error('Not found', 404);
    } catch (e) {
      console.error('Worker error:', e.message);
      return error('Internal server error', 500);
    }
  }
};
