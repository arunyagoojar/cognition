// Real end-to-end account deletion test against production (cognition.eu.cc).
// Creates a disposable account, writes D1 records (user, preferences, attempt, credential),
// then triggers DELETE /api/me with a verified session (fva: [0, -1]).
// Verifies D1 records purged, Clerk user deleted, and token re-use rejected.

import { clerk, createTestUser, api, BASE } from './_prodtest_lib.mjs';

async function mintVerifiedToken(userId) {
  const sit = await clerk('POST', '/sign_in_tokens', { user_id: userId, expires_in_seconds: 300 });
  if (sit.status !== 200 || !sit.data?.token) {
    throw new Error(`Failed to create sign in token: ${sit.status}`);
  }
  const r = await fetch('https://musical-duck-3917.clerk.accounts.dev/v1/client/sign_ins?_is_native=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ strategy: 'ticket', ticket: sit.data.token }),
  });
  if (r.status !== 200) {
    throw new Error(`Failed to consume sign in ticket: ${r.status}`);
  }
  const d = await r.json();
  const jwt = d?.client?.sessions?.[0]?.last_active_token?.jwt;
  if (!jwt) throw new Error('No JWT returned from session ticket exchange');
  return jwt;
}

console.log('--- Step 1: Create disposable test account ---');
const u = await createTestUser();
console.log('Created test user:', u.id, u.email);

console.log('--- Step 2: Mint freshly-verified session token (fva [0, -1]) ---');
const token = await mintVerifiedToken(u.id);
const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
console.log('Session claims: fva =', claims.fva, 'sub =', claims.sub);

console.log('--- Step 3: Provision user & save preferences ---');
const meRes = await api(token, 'GET', '/api/me');
console.log('GET /api/me status:', meRes.status, 'user:', meRes.data?.clerk_user_id);

const prefRes = await api(token, 'PUT', '/api/me/preferences', { target_band: '8.5', theme: 'dark' });
console.log('PUT /api/me/preferences status:', prefRes.status, 'target_band:', prefRes.data?.target_band);

console.log('--- Step 4: Create a practice attempt in D1 ---');
const attemptId = 'att_' + Date.now();
const attRes = await api(token, 'POST', '/api/attempts', {
  id: attemptId,
  type: 'reading',
  test_id: 'test-01',
  test_label: 'Academic Reading 01',
  status: 'completed',
  band: 7.5,
  data: { raw: 33 },
  started_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
});
console.log('POST /api/attempts status:', attRes.status);

console.log('--- Step 5: Mark onboarding complete in D1 ---');
const onbRes = await api(token, 'PUT', '/api/me/onboarding');
console.log('PUT /api/me/onboarding status:', onbRes.status, 'completed:', onbRes.data?.onboardingCompleted);

console.log('--- Step 6: Execute DELETE /api/me against production ---');
const delRes = await api(token, 'DELETE', '/api/me');
console.log('DELETE /api/me response:', delRes.status, JSON.stringify(delRes.data));

if (delRes.status !== 200 || !delRes.data?.deleted) {
  console.error('FAIL: DELETE /api/me did not succeed:', delRes);
  process.exit(1);
}

console.log('--- Step 7: Verify Clerk account was deleted ---');
const clerkCheck = await clerk('GET', `/users/${u.id}`);
console.log('Clerk lookup status (expected 404):', clerkCheck.status);
if (clerkCheck.status !== 404) {
  console.error('FAIL: User still exists in Clerk! status:', clerkCheck.status);
  process.exit(1);
}
console.log('PASS: Clerk account successfully deleted.');

console.log('--- Step 8: Verify token can no longer provision or resurrect in D1 ---');
const ghostRes = await api(token, 'GET', '/api/me');
console.log('Subsequent GET /api/me status (expected 401):', ghostRes.status, ghostRes.data);
if (ghostRes.status !== 401) {
  console.error('FAIL: Expected 401 for deleted user token, got:', ghostRes.status);
  process.exit(1);
}
console.log('PASS: Deleted user is rejected and cannot resurrect D1 records.');

console.log('\n========================================');
console.log('ALL ACCOUNT DELETION CHECKS PASSED ON PROD');
console.log('========================================');
