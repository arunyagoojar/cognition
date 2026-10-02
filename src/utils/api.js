/**
 * Cognition API client — syncs user data between localStorage and the Cloudflare Worker.
 * Sends Clerk session tokens for authentication; falls back to localStorage when offline.
 */

// import.meta.env only exists under Vite — fall back to process.env in Node tests.
const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
// Callers pass paths that already start with /api — the base is a prefix only.
// Same-origin builds leave this empty; dev .env sets the absolute Worker URL.
const API_BASE = viteEnv.VITE_API_BASE_URL ?? '';
const PUBLISHABLE_KEY = viteEnv.VITE_CLERK_PUBLISHABLE_KEY;

let clerkAuth = null;

export function setClerkAuth(auth) {
  clerkAuth = auth;
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
  const token = await clerkAuth.getToken();
  if (!token) return { ok: false, unauthenticated: true };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
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

export async function saveCredential(provider, key) {
  const res = await apiFetchDetail(`/api/credentials/${provider}`, {
    method: 'PUT',
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    return { ok: false, message: res.data?.error || 'Could not save the key. Please try again.' };
  }
  return { ok: true, ...res.data };
}

export async function fetchCredentialStatus(provider) {
  const res = await apiFetchDetail(`/api/credentials/${provider}/status`, { method: 'GET' });
  if (!res.ok) return { configured: false, provider };
  return res.data;
}

export async function deleteCredential(provider) {
  const res = await apiFetchDetail(`/api/credentials/${provider}`, { method: 'DELETE' });
  return { ok: res.ok, ...(res.data || {}) };
}

// ── Server-side AI evaluation (Phase 4) ─────────────────────────────────────
// The Worker decrypts the credential in memory, calls Gemini, and returns the
// validated evaluation JSON. The key never reaches the browser.

export async function evaluateWritingServer({ task1Text, task2Text, prompts }) {
  const res = await apiFetchDetail('/api/ai/evaluate-writing', {
    method: 'POST',
    body: JSON.stringify({ task1Text, task2Text, prompts }),
  });
  if (!res.ok) {
    return { status: 'failed', message: 'AI evaluation service error. Please try again.' };
  }
  return res.data;
}

export async function evaluateSpeakingServer({ transcripts, testMeta }) {
  const res = await apiFetchDetail('/api/ai/evaluate-speaking', {
    method: 'POST',
    body: JSON.stringify({ transcripts, testMeta }),
  });
  if (!res.ok) {
    return { status: 'failed', message: 'AI evaluation service error. Please try again.' };
  }
  return res.data;
}
