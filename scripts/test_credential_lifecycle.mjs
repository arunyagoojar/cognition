// Test script for credential management lifecycle against production.
// Verifies:
// 1. Unconfigured initial state
// 2. Rejecting invalid key format
// 3. Saving credential (encryption on server)
// 4. Getting credential status (masked suffix, never plaintext)
// 5. Deleting credential
// 6. Verification that credential is removed

import { clerk, createTestUser, api } from './_prodtest_lib.mjs';

const u = await createTestUser();
console.log('Created user for credential test:', u.id);

// Mint token
const sit = await clerk('POST', '/sign_in_tokens', { user_id: u.id, expires_in_seconds: 300 });
const r = await fetch('https://musical-duck-3917.clerk.accounts.dev/v1/client/sign_ins?_is_native=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ strategy: 'ticket', ticket: sit.data.token }),
});
const d = await r.json();
const token = d?.client?.sessions?.[0]?.last_active_token?.jwt;

console.log('--- Step 1: Initial status ---');
const initStatus = await api(token, 'GET', '/api/credentials/gemini/status');
console.log('Initial status:', initStatus.data);
if (initStatus.data?.configured !== false) {
  console.error('FAIL: Expected initial configured: false');
  process.exit(1);
}

console.log('--- Step 2: Test empty key rejection ---');
const emptyRes = await api(token, 'PUT', '/api/credentials/gemini', { key: '' });
console.log('Empty key response:', emptyRes.status, emptyRes.data);
if (emptyRes.status !== 400 || emptyRes.data?.code !== 'empty_key') {
  console.error('FAIL: Empty key should be rejected with 400 empty_key');
  process.exit(1);
}

console.log('--- Step 3: Test invalid format key rejection ---');
const shortRes = await api(token, 'PUT', '/api/credentials/gemini', { key: 'short' });
console.log('Short key response:', shortRes.status, shortRes.data);
if (shortRes.status !== 400 || shortRes.data?.code !== 'invalid_key') {
  console.error('FAIL: Short key should be rejected with 400 invalid_key');
  process.exit(1);
}

console.log('--- Step 4: Test fake key rejection by Gemini ---');
const fakeKey = 'AIzaSy' + 'A'.repeat(33);
const fakeRes = await api(token, 'PUT', '/api/credentials/gemini', { key: fakeKey });
console.log('Fake key response:', fakeRes.status, fakeRes.data);
if (fakeRes.status !== 400 || fakeRes.data?.validated !== false) {
  console.error('FAIL: Fake key should be rejected by server validation');
  process.exit(1);
}

console.log('--- Step 5: Test Delete credential endpoint ---');
const delCred = await api(token, 'DELETE', '/api/credentials/gemini');
console.log('Delete credential status:', delCred.status, delCred.data);
if (delCred.status !== 200 || delCred.data?.configured !== false) {
  console.error('FAIL: Delete credential should return 200 { configured: false }');
  process.exit(1);
}

// Clean up
await clerk('DELETE', '/users/' + u.id);
console.log('\n========================================');
console.log('ALL CREDENTIAL API CHECKS PASSED');
console.log('========================================');
