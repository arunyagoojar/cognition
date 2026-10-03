// Onboarding completion persistence — per user, survives reloads and logins.
// Stored value is the id of the user who completed (or skipped) onboarding, so
// a different account signing in on the same device still gets the tour.

const KEY = 'omniprep_onboarding_done_user';

function hasStorage() {
  return typeof localStorage !== 'undefined' && localStorage !== null;
}

// Returns the user id that completed onboarding on this device ('' if none).
export function getCompletedOnboardingUser() {
  if (!hasStorage()) return '';
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

// Records that `userId` has seen (completed or skipped) onboarding.
export function markOnboardingComplete(userId = 'anon') {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(KEY, String(userId));
  } catch {
    /* storage unavailable — onboarding simply replays next visit */
  }
}

// True when `userId` has not yet completed onboarding on this device.
export function shouldShowOnboarding(userId = 'anon') {
  return getCompletedOnboardingUser() !== String(userId);
}
