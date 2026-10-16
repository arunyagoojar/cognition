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

await t('hydration: restores authentic scores from remote attempts without blending degradation', () => {
  storage.resetPerformanceData();
  const remoteRows = [
    { id: 'att_l_1', clerk_user_id: 'user_A', type: 'listening', band: 7.5, status: 'completed', completed_at: '2026-10-15T10:00:00Z' },
    { id: 'att_l_old', clerk_user_id: 'user_A', type: 'listening', band: 3.0, status: 'completed', completed_at: '2026-10-01T10:00:00Z' },
    { id: 'att_s_1', clerk_user_id: 'user_A', type: 'speaking', band: 5.0, status: 'completed', completed_at: '2026-10-14T10:00:00Z' },
    { id: 'att_w_1', clerk_user_id: 'user_A', type: 'writing', band: 5.5, status: 'completed', completed_at: '2026-10-13T10:00:00Z' },
    { id: 'att_r_1', clerk_user_id: 'user_A', type: 'reading', band: 5.0, status: 'completed', completed_at: '2026-10-12T10:00:00Z' },
  ];
  const ok = storage.hydrateFromRemoteAttempts(remoteRows, 'user_A');
  assert.equal(ok, true);
  const scores = storage.getSkillScores();
  assert.equal(scores.listening?.band, 7.5, 'Listening latest band is exactly 7.5, not degraded by old band 3 test');
  assert.equal(scores.speaking?.band, 5.0, 'Speaking latest band is exactly 5.0');
  assert.equal(scores.writing?.band, 5.5, 'Writing latest band is exactly 5.5');
  assert.equal(scores.reading?.band, 5.0, 'Reading latest band is exactly 5.0');
});

await t('hydration: strict user isolation rejects foreign account attempts', () => {
  storage.resetPerformanceData();
  const mixedRows = [
    { id: 'att_1', clerk_user_id: 'user_A', type: 'listening', band: 8.0, status: 'completed', completed_at: '2026-10-15T10:00:00Z' },
    { id: 'att_foreign', clerk_user_id: 'user_B', type: 'listening', band: 2.0, status: 'completed', completed_at: '2026-10-16T10:00:00Z' },
  ];
  storage.hydrateFromRemoteAttempts(mixedRows, 'user_A');
  const scores = storage.getSkillScores();
  assert.equal(scores.listening?.band, 8.0, 'Only user_A attempts are accepted; user_B attempts are rejected');
});

await t('hydration: saveCompletedLessonsBulk merges lessons cleanly without duplicates', () => {
  storage.saveCompletedLessonsBulk(['wr-1', 'wr-2', 'wr-3']);
  storage.saveCompletedLessonsBulk(['wr-2', 'wr-3', 'wr-4']);
  const list = storage.getCompletedLessons();
  assert.deepEqual(list.sort(), ['wr-1', 'wr-2', 'wr-3', 'wr-4']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
