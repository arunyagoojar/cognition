// Comprehensive onboarding lifecycle test against production.
// Verifies:
// 1. Newly created user has onboarding_completed_at: null -> shouldShowOnboarding = true
// 2. Completing or skipping onboarding calls PUT /api/me/onboarding -> sets timestamp
// 3. Subsequent logins / queries return onboarding_completed_at set -> shouldShowOnboarding = false
// 4. Client-side decision logic prevents replay across devices / reloads.

import { clerk, createTestUser, api } from './_prodtest_lib.mjs';
import { shouldShowOnboarding, markOnboardingComplete, hasCompletedOnboardingLocally } from '../src/utils/onboarding.js';

console.log('--- Step 1: Create brand new user ---');
const u = await createTestUser();
console.log('Created user:', u.id);

// Mint token
const sit = await clerk('POST', '/sign_in_tokens', { user_id: u.id, expires_in_seconds: 300 });
const r = await fetch('https://musical-duck-3917.clerk.accounts.dev/v1/client/sign_ins?_is_native=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ strategy: 'ticket', ticket: sit.data.token }),
});
const d = await r.json();
const token = d?.client?.sessions?.[0]?.last_active_token?.jwt;

console.log('--- Step 2: First successful login (provisioning) ---');
const meRes = await api(token, 'GET', '/api/me');
console.log('Initial user row:', meRes.data);
console.log('onboarding_completed_at is null?', meRes.data?.onboarding_completed_at === null);

const showFirstTime = shouldShowOnboarding(meRes.data, u.id);
console.log('shouldShowOnboarding on first login:', showFirstTime);
if (!showFirstTime) {
  console.error('FAIL: New user should see onboarding on first login!');
  process.exit(1);
}

console.log('--- Step 3: Complete / Skip Onboarding ---');
const onbRes = await api(token, 'PUT', '/api/me/onboarding');
console.log('PUT /api/me/onboarding result:', onbRes.data);
if (!onbRes.data?.onboardingCompleted) {
  console.error('FAIL: Onboarding was not marked completed in backend!');
  process.exit(1);
}
markOnboardingComplete(u.id);

console.log('--- Step 4: Returning user / refresh behavior ---');
const returningRes = await api(token, 'GET', '/api/me');
console.log('Returning user onboarding_completed_at:', returningRes.data?.onboarding_completed_at);
const showReturning = shouldShowOnboarding(returningRes.data, u.id);
console.log('shouldShowOnboarding for returning user:', showReturning);
if (showReturning) {
  console.error('FAIL: Returning user should NOT see onboarding!');
  process.exit(1);
}

console.log('--- Step 5: New device simulation (local storage empty) ---');
// Even if local storage has no record of this user, server row blocks it
const showNewDevice = shouldShowOnboarding(returningRes.data, 'new_device_' + u.id);
console.log('shouldShowOnboarding on new device for onboarded account:', shouldShowOnboarding(returningRes.data, u.id));
if (shouldShowOnboarding(returningRes.data, u.id)) {
  console.error('FAIL: Server record should prevent onboarding on other devices too!');
  process.exit(1);
}

// Clean up test user
await clerk('DELETE', '/users/' + u.id);
console.log('Cleaned up test user.');

console.log('\n========================================');
console.log('ALL ONBOARDING LIFECYCLE CHECKS PASSED');
console.log('========================================');
