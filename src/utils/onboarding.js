// Onboarding completion — the SERVER (D1 `users.onboarding_completed_at`) is the
// source of truth, so onboarding appears exactly once per account, immediately
// after the first successful sign-in, on any browser/device.
//
// This module is only the on-device cache: a per-user set of ids that have
// completed/skipped onboarding. It guards against a failed server write and
// against flashing the tour while the server state is still loading. It is
// NOT used on its own to decide that a user is "new".

const KEY = 'omniprep_onboarding_done_users';
const MAX_IDS = 50;

function hasStorage() {
  return typeof localStorage !== 'undefined' && localStorage !== null;
}

function readIds() {
  if (!hasStorage()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Returns the most recently completed user id on this device ('' if none).
export function getCompletedOnboardingUser() {
  if (!hasStorage()) return '';
  try {
    const list = readIds();
    return list[list.length - 1] || '';
  } catch {
    return '';
  }
}

// True when this device already knows `userId` completed (or skipped) onboarding.
export function hasCompletedOnboardingLocally(userId) {
  if (!userId) return false;
  return readIds().includes(String(userId));
}

// Records that `userId` has completed (or skipped) onboarding on this device.
export function markOnboardingComplete(userId) {
  if (!hasStorage() || !userId) return;
  try {
    const ids = readIds().filter(id => id !== String(userId));
    ids.push(String(userId));
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-MAX_IDS)));
  } catch {
    /* storage unavailable — the server record still prevents a replay */
  }
}

/**
 * Pure decision: should the first-run onboarding be shown?
 * Overload 1: shouldShowOnboarding(userIdString) — unit-test / local-only check
 * Overload 2: shouldShowOnboarding(userRow, userIdString) — production server-backed check
 *
 * @param {object|string|null|undefined} userOrId  The server user row OR a raw userId string.
 * @param {string} [maybeUserId]                   Clerk user id if first param was a user row.
 */
export function shouldShowOnboarding(userOrId, maybeUserId) {
  if (!userOrId) return false;

  // Single-argument string call (unit tests / local fallback)
  if (typeof userOrId === 'string') {
    if (userOrId === 'anon') return false;
    return !hasCompletedOnboardingLocally(userOrId);
  }

  // Two-argument server user row call
  const user = userOrId;
  const userId = maybeUserId;
  if (!user || !userId || userId === 'anon') return false;
  if (user.clerk_user_id && user.clerk_user_id !== userId) return false; // stale row from another account
  if (!('onboarding_completed_at' in user)) return false;
  if (user.onboarding_completed_at) return false;
  return !hasCompletedOnboardingLocally(userId);
}
