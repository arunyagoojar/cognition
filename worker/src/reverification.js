/**
 * Clerk-compatible reverification check for the Worker.
 *
 * Clerk session tokens (v2) carry `fva: [firstFactorAgeMin, secondFactorAgeMin]`
 * (-1 = never verified in this session). This mirrors the logic of Clerk's own
 * `has({ reverification: 'strict' })` so the browser-side `useReverification()`
 * hook can drive the standard Clerk modal when it is needed.
 */

const LEVELS = {
  strict: { afterMinutes: 10, level: 'second_factor' },
  moderate: { afterMinutes: 60, level: 'second_factor' },
  lax: { afterMinutes: 1440, level: 'second_factor' },
};

function validAge(x) {
  return typeof x === 'number' && Number.isFinite(x) && (x === -1 || x >= 0);
}

/** @returns {boolean} true when the session is fresh enough for `type`. */
export function isReverificationSatisfied(fva, type = 'strict') {
  const cfg = LEVELS[type];
  if (!cfg) return false;
  if (!Array.isArray(fva) || fva.length !== 2 || !validAge(fva[0]) || !validAge(fva[1])) return false;
  const [f1, f2] = fva;
  if (f1 === -1 && f2 === -1) return false;
  const f1Fresh = f1 !== -1 && cfg.afterMinutes > f1;
  const f2Fresh = f2 !== -1 && cfg.afterMinutes > f2;
  if (f2 === -1) return f1Fresh;
  if (f1 === -1) return f2Fresh;
  return f2Fresh;
}

/** Response body the Clerk `useReverification()` hook recognises. */
export function reverificationErrorBody(type = 'strict') {
  return {
    clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: type } },
  };
}
