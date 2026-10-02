/**
 * Cognition API client — syncs user data between localStorage and the Cloudflare Worker.
 * Sends Clerk session tokens for authentication; falls back to localStorage when offline.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let clerkAuth = null;

export function setClerkAuth(auth) {
  clerkAuth = auth;
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
