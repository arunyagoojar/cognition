/**
 * API client auth contract — a signed-in user must always be able to reach
 * the API (credential status, AI evaluation, account deletion), even when
 * the build had no .env file.
 */
import assert from 'node:assert/strict';
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
globalThis.window = { localStorage: globalThis.localStorage, addEventListener() {}, dispatchEvent() {} };
const api = await import('../src/utils/api.js');
const storage = await import('../src/utils/storage.js');

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

console.log('== API client auth contract ==');
await t('signed-out: no API auth', () => { api.setClerkAuth(null); assert.equal(api.hasApiAuth(), false); });

await t('signed-in: API auth available without any .env key', () => {
  api.setClerkAuth({ isSignedIn: true, userId: 'user_1', getToken: async () => 'tok' });
  assert.equal(api.hasApiAuth(), true);
});

await t('credential status: stored key → configured', async () => {
  globalThis.fetch = respond(200, { configured: true, provider: 'gemini', maskedSuffix: '••••abcd' });
  storage.invalidateCredentialStatusCache();
  assert.equal(await storage.getAiConfigState(), 'configured');
});

await t('credential status: a failed check is unknown, never "no key", and is not cached', async () => {
  globalThis.fetch = respond(401, { error: 'Unauthorized' });
  storage.invalidateCredentialStatusCache();
  assert.equal(await storage.getAiConfigState(), 'unknown');
  globalThis.fetch = respond(200, { configured: true, provider: 'gemini' });
  assert.equal(await storage.getAiConfigState(), 'configured', 'retried after the failure');
});

await t('credential status: definite "no key" from the server → not_configured', async () => {
  globalThis.fetch = respond(200, { configured: false, provider: 'gemini' });
  storage.invalidateCredentialStatusCache();
  assert.equal(await storage.getAiConfigState(), 'not_configured');
});

await t('AI evaluation: a 401 explains the session, and says to retry', async () => {
  globalThis.fetch = respond(401, { error: 'Unauthorized' });
  const r = await api.evaluateSpeakingServer({ transcripts: { a: 'x' }, testMeta: {} });
  assert.equal(r.status, 'failed'); assert.equal(r.reason, 'session'); assert.match(r.message, /Retry evaluation/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
