// Disposable-account production test harness (dev tooling only; never prints secrets).
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
export const SK = env.CLERK_SECRET_KEY;
export const BASE = process.env.PROD_BASE || 'https://cognition.eu.cc';

export async function clerk(method, path, body) {
  const r = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}

export async function createTestUser() {
  const stamp = Date.now();
  const email = `cogtest+clerk_test${stamp}@example.com`;
  const password = crypto.randomBytes(18).toString('base64url') + 'aA1!';
  const u = await clerk('POST', '/users', { email_address: [email], password, skip_password_checks: true });
  if (u.status >= 300) throw new Error(`create user failed ${u.status} ${JSON.stringify(u.data?.errors?.[0]?.code)}`);
  return { id: u.data.id, email, password };
}

export async function mintToken(userId) {
  const s = await clerk('POST', '/sessions', { user_id: userId });
  if (s.status >= 300) throw new Error(`create session failed ${s.status}`);
  const t = await clerk('POST', `/sessions/${s.data.id}/tokens`, {});
  if (t.status >= 300) throw new Error(`mint token failed ${t.status}`);
  return t.data.jwt;
}

export async function api(token, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}
