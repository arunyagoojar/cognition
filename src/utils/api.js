/**
 * Cognition API client — syncs user data between localStorage and the Cloudflare Worker.
 * Sends Clerk session tokens for authentication; falls back to localStorage when offline.
 */

import { CLERK_PUBLISHABLE_KEY } from '../config.js';
import {
  setLocalKeyScope,
  saveLocalGeminiKey,
  getLocalGeminiKey,
  removeLocalGeminiKey,
  hasLocalGeminiKey,
  getActiveAiProvider,
  saveLocalGroqKey,
  getLocalGroqKey,
  removeLocalGroqKey,
  hasLocalGroqKey
} from './storage.js';

// import.meta.env only exists under Vite — fall back to process.env in Node tests.
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
// Callers pass paths that already start with /api — the base is a prefix only.
// Same-origin builds leave this empty; dev .env sets the absolute Worker URL.
const API_BASE = viteEnv.VITE_API_BASE_URL ?? '';
// Same source as the sign-in UI (src/config.js bakes the publishable key as the
// default), so a build without .env can never ship a signed-in UI whose API
// client thinks nobody is signed in.
const PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;



let clerkAuth = null;

export function setClerkAuth(auth) {
  clerkAuth = auth;
  // Bind any on-device Gemini key to the signed-in account.
  setLocalKeyScope(auth?.isSignedIn ? auth.userId : '');
}

// True when a Clerk session can issue tokens for API calls.
export function hasApiAuth() {
  return Boolean(PUBLISHABLE_KEY && clerkAuth);
}

async function apiFetch(path, options = {}) {
  if (!PUBLISHABLE_KEY || !clerkAuth) return null;
  const token = await clerkAuth.getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Variant that surfaces server error messages (for credential/AI endpoints).
async function apiFetchDetail(path, options = {}) {
  if (!PUBLISHABLE_KEY || !clerkAuth) return { ok: false, unauthenticated: true };
  let token;
  try {
    token = await clerkAuth.getToken();
  } catch {
    return { ok: false, networkError: true };
  }
  if (!token) return { ok: false, unauthenticated: true };
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    // Reachability/CORS failure — surfaced as networkError, never a raw browser message.
    return { ok: false, networkError: true };
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  return { ok: res.ok, status: res.status, data };
}

// ── User provisioning + preferences ──

export async function syncUserProvision() {
  return apiFetch('/api/me', { method: 'GET' });
}

export async function syncPreferences(data) {
  return apiFetch('/api/me/preferences', { method: 'PUT', body: JSON.stringify(data) });
}

export async function fetchPreferences() {
  return apiFetch('/api/me', { method: 'GET' });
}

// Marks onboarding as completed/skipped for this account (server-persisted, so
// it never reappears on another browser/device). Returns true on success.
export async function syncOnboardingComplete() {
  const res = await apiFetch('/api/me/onboarding', { method: 'PUT' });
  return Boolean(res?.onboardingCompleted);
}

// Issues the account-deletion request. Returns the raw Response so Clerk's
// useReverification() can detect a reverification challenge (403) and open its
// modal, then retry. A fresh token is always fetched so the retry carries the
// re-verified session. The Worker purges D1 first, then deletes the Clerk user.
export async function requestAccountDeletion() {
  if (!PUBLISHABLE_KEY || !clerkAuth) throw new Error('You need to be signed in to delete your account.');
  const token = await clerkAuth.getToken({ skipCache: true });
  if (!token) throw new Error('Your session has expired. Please sign in again.');
  return fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
}

// ── Attempts ──

export async function syncAttempt(attempt) {
  const body = {
    id: attempt.id,
    type: attempt.type,
    test_id: attempt.testId,
    test_label: attempt.testLabel,
    status: attempt.status || 'completed',
    band: attempt.band,
    data: {
      criteria: attempt.criteria,
      overallSummary: attempt.overallSummary,
      strengths: attempt.strengths,
      areasForImprovement: attempt.areasForImprovement,
      responses: attempt.transcripts || attempt.t1 !== undefined ? {
        t1: attempt.t1, t2: attempt.t2,
        task1Words: attempt.task1Words, task2Words: attempt.task2Words,
        recordings: attempt.recordings ? Object.keys(attempt.recordings) : [],
      } : undefined,
    },
    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
  };
  // Try PUT first (update), fallback to POST (create)
  const updated = await apiFetch(`/api/attempts/${attempt.id}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
  if (updated) return updated;
  return apiFetch('/api/attempts', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchAttempts() {
  return apiFetch('/api/attempts', { method: 'GET' });
}

// ── Lessons ──

export async function syncLessonComplete(lessonId) {
  return apiFetch('/api/lessons', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId }) });
}

export async function fetchCompletedLessons() {
  return apiFetch('/api/lessons', { method: 'GET' });
}

// ── Secure AI credentials (Phase 4) ────────────────────────────────────────
// Raw keys travel once to the Worker and are encrypted (AES-256-GCM) before
// D1 storage. No endpoint ever returns the stored credential.

// Server codes meaning "Cognition's cloud storage can't be used right now, but
// the key itself may be fine" — these (and network/5xx failures) allow the
// on-device fallback. Anything else (bad key, expired session) is surfaced as-is.
const CLOUD_UNUSABLE_CODES = new Set([
  'storage_unavailable', 'storage_failed', 'provider_region', 'key_restricted', 'provider_unreachable',
]);

/**
 * Validates a Gemini key directly from the browser (models-list ping). The key
 * goes only to Google, in a header — never to Cognition.
 */
export async function validateGeminiKeyDirect(key) {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': key },
    });
    if (res.ok || res.status === 429) return { valid: true };
    if (res.status === 400 || res.status === 403) {
      return { valid: false, message: 'Gemini rejected this API key. Check that you copied the whole key and try again.' };
    }
    return { valid: false, message: 'Could not verify the key with Google right now. Please try again shortly.' };
  } catch {
    return { valid: false, message: 'Could not reach Google to verify the key. Check your connection and try again.' };
  }
}

/**
 * Validates a Groq key directly from the browser (models-list ping).
 */
export async function validateGroqKeyDirect(key) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok || res.status === 429) return { valid: true };
    if (res.status === 401 || res.status === 403) {
      return { valid: false, message: 'Groq rejected this API key. Check that you copied the complete key from console.groq.com and try again.' };
    }
    return { valid: false, message: 'Could not verify the key with Groq right now. Please try again shortly.' };
  } catch {
    return { valid: false, message: 'Could not reach Groq to verify the key. Check your connection and try again.' };
  }
}

export async function saveCredential(provider, key) {
  const res = await apiFetchDetail(`/api/credentials/${provider}`, {
    method: 'PUT',
    body: JSON.stringify({ key }),
  });

  if (res.ok) {
    // A successful cloud save supersedes any stale local copy.
    if (provider === 'gemini') removeLocalGeminiKey();
    if (provider === 'groq') removeLocalGroqKey();
    return { ok: true, ...res.data };
  }

  const serverMessage = res.data?.error;
  if (provider !== 'gemini' && provider !== 'groq') {
    return { ok: false, message: serverMessage || 'Could not save the key. Please try again.' };
  }
  if (res.unauthenticated || res.status === 401) {
    return { ok: false, message: 'Your session has expired. Please sign in again, then retry.' };
  }

  const cloudUnusable = Boolean(res.networkError)
    || res.status >= 500
    || CLOUD_UNUSABLE_CODES.has(res.data?.code);
  if (!cloudUnusable) {
    return { ok: false, message: serverMessage || 'Could not save the key. Please try again.' };
  }

  // Privacy fallback: Cognition's secure storage can't take the key right now.
  // Verify it directly with provider first, then keep it on THIS DEVICE only.
  if (provider === 'gemini') {
    const direct = await validateGeminiKeyDirect(key);
    if (!direct.valid) return { ok: false, message: direct.message };
    if (!saveLocalGeminiKey(key)) {
      return { ok: false, message: 'Could not store the key on this device \u2014 browser storage is blocked or full.' };
    }
  } else if (provider === 'groq') {
    const direct = await validateGroqKeyDirect(key);
    if (!direct.valid) return { ok: false, message: direct.message };
    if (!saveLocalGroqKey(key)) {
      return { ok: false, message: 'Could not store the key on this device \u2014 browser storage is blocked or full.' };
    }
  }

  return {
    ok: true,
    local: true,
    maskedSuffix: `\u2022\u2022\u2022\u2022${key.slice(-4)}`,
    message: 'Secure cloud storage is unavailable right now, so your key was saved on this device only. It is never stored on Cognition’s servers.',
  };
}

export async function fetchCredentialStatus(provider) {
  const res = await apiFetchDetail(`/api/credentials/${provider}/status`, { method: 'GET' });
  // A failed check (no session token yet, expired token, network) is UNKNOWN,
  // never "not configured" — callers must not tell a user with a stored key to add one.
  const cloud = res.ok ? res.data
    : { configured: false, provider, unknown: true, reason: res.unauthenticated ? 'unauthenticated' : res.networkError ? 'network' : `http_${res.status}` };
  if (cloud.configured) return cloud;
  // Local fallback: a device-stored key (privacy mode) counts as configured.
  if (provider === 'gemini' && hasLocalGeminiKey()) {
    return { configured: true, provider, local: true, maskedSuffix: `\u2022\u2022\u2022\u2022${getLocalGeminiKey().slice(-4)}` };
  }
  if (provider === 'groq' && hasLocalGroqKey()) {
    return { configured: true, provider, local: true, maskedSuffix: `\u2022\u2022\u2022\u2022${getLocalGroqKey().slice(-4)}` };
  }
  return cloud.unknown ? cloud : { configured: false, provider };
}

export async function deleteCredential(provider) {
  if (provider === 'gemini') removeLocalGeminiKey();
  if (provider === 'groq') removeLocalGroqKey();
  const res = await apiFetchDetail(`/api/credentials/${provider}`, { method: 'DELETE' });
  return { ok: res.ok, ...(res.data || {}) };
}

// ── Server-side AI evaluation (Phase 4) ─────────────────────────────────────
// The Worker decrypts the credential in memory, calls Gemini/Groq, and returns the
// validated evaluation JSON. The key never reaches the browser.

// One clear message per failure kind for AI evaluation requests. The candidate's
// answers stay on the results screen, so every message ends in "retry".
function aiFailure(res) {
  if (res.unauthenticated || res.status === 401) {
    return { status: 'failed', reason: 'session',
      message: 'We could not confirm your sign-in session. Refresh the page (you stay signed in), then press Retry evaluation.' };
  }
  if (res.networkError) {
    return { status: 'failed', reason: 'network', message: 'Could not reach the AI examiner. Check your connection and press Retry evaluation.' };
  }
  return { status: 'failed', reason: `http_${res.status || 'error'}`,
    message: (res.data && (res.data.message || res.data.error)) || 'The AI examiner returned an error. Press Retry evaluation.' };
}

export async function evaluateWritingServer({ task1Text, task2Text, prompts, task1Words, task2Words }) {
  const provider = getActiveAiProvider();
  const localKey = provider === 'groq' ? getLocalGroqKey() : getLocalGeminiKey();
  const res = await apiFetchDetail('/api/ai/evaluate-writing', {
    method: 'POST',
    body: JSON.stringify({ task1Text, task2Text, prompts, task1Words, task2Words, provider, key: localKey || undefined }),
  });
  if (!res.ok) return aiFailure(res);
  return res.data;
}

export async function evaluateSpeakingServer({ transcripts, testMeta, durations }) {
  const provider = getActiveAiProvider();
  const localKey = provider === 'groq' ? getLocalGroqKey() : getLocalGeminiKey();
  const res = await apiFetchDetail('/api/ai/evaluate-speaking', {
    method: 'POST',
    body: JSON.stringify({ transcripts, testMeta, durations, provider, key: localKey || undefined }),
  });
  if (!res.ok) return aiFailure(res);
  return res.data;
}

// ── Hybrid objective-answer verification (Phase 5) ──────────────────────────
// One batched request per completed test: only deterministic-UNCERTAIN items
// go to the Worker, which verifies them against Gemini/Groq using the user's
// encrypted credential. The official answer key remains authoritative.

export async function verifyAnswersViaWorker(items) {
  if (!items || items.length === 0) return { results: [] };
  const provider = getActiveAiProvider();
  const localKey = provider === 'groq' ? getLocalGroqKey() : getLocalGeminiKey();
  const res = await apiFetchDetail('/api/ai/verify-answers', {
    method: 'POST',
    body: JSON.stringify({ items, provider, key: localKey || undefined }),
  });
  if (!res.ok) return { results: [] };
  return res.data;
}
