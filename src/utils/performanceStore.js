// Canonical Authoritative Performance Store for Cognition
// Single source of truth for attempts, skill bands, AI evaluations, and derived metrics.
import { calculateOverallBand } from './bandCalculator.js';

export const PERFORMANCE_STORAGE_KEY = 'omniprep_performance_store_v1';
export const PERFORMANCE_EVENT_NAME = 'omniprep:performance_updated';

/**
 * Creates a unique attempt ID guaranteed to avoid collisions.
 */
export function createAttemptId(type = 'test') {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 7);
  return `attempt_${type}_${ts}_${rand}`;
}

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/**
 * Reads the canonical performance store from localStorage.
 */
export function getPerformanceStore() {
  const storage = getStorage();
  if (!storage) {
    return { version: 1, attempts: [] };
  }
  try {
    const raw = storage.getItem(PERFORMANCE_STORAGE_KEY);
    if (!raw) return { version: 1, attempts: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.attempts)) {
      return { version: 1, attempts: [] };
    }
    return parsed;
  } catch (e) {
    console.warn('Failed to parse canonical performance store:', e);
    return { version: 1, attempts: [] };
  }
}

/**
 * Saves the canonical performance store to localStorage and broadcasts the update.
 */
function savePerformanceStore(store) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(store));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(PERFORMANCE_EVENT_NAME, { detail: store }));
    }
  } catch (e) {
    console.warn('Failed to save canonical performance store:', e);
  }
}

/**
 * Saves or updates a canonical test attempt.
 */
export function recordAttempt(attempt) {
  if (!attempt || !attempt.id) return null;

  const store = getPerformanceStore();
  const existingIdx = store.attempts.findIndex(a => a.id === attempt.id);

  const normalized = {
    ...attempt,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    store.attempts[existingIdx] = { ...store.attempts[existingIdx], ...normalized };
  } else {
    store.attempts.unshift(normalized);
  }

  // Keep up to 100 historical attempts
  if (store.attempts.length > 100) {
    store.attempts = store.attempts.slice(0, 100);
  }

  savePerformanceStore(store);
  return normalized;
}

/**
 * Retrieves a single attempt by ID.
 */
export function getAttemptById(id) {
  if (!id) return null;
  const store = getPerformanceStore();
  return store.attempts.find(a => a.id === id) || null;
}

/**
 * Authoritative Derivation Engine:
 * All dashboard metrics, best scores, latest skill bands, and trends are derived
 * strictly from completed attempts in the canonical store.
 */
export function derivePerformanceSummary() {
  const store = getPerformanceStore();
  const completed = (store.attempts || []).filter(a => a.status === 'completed');

  if (completed.length === 0) {
    return {
      hasScores: false,
      overallBand: null,
      latestScores: {
        listening: null,
        reading: null,
        writing: null,
        speaking: null,
      },
      bestScores: {
        listening: null,
        reading: null,
        writing: null,
        speaking: null,
      },
      skillHistory: {
        listening: [],
        reading: [],
        writing: [],
        speaking: [],
      },
      completedCount: 0,
      recentAttempts: [],
    };
  }

  // 1. Latest valid attempt for each skill
  const latestScores = {
    listening: null,
    reading: null,
    writing: null,
    speaking: null,
  };

  // 2. Best valid band for each skill
  const bestScores = {
    listening: null,
    reading: null,
    writing: null,
    speaking: null,
  };

  // 3. Historical series for trend charts
  const skillHistory = {
    listening: [],
    reading: [],
    writing: [],
    speaking: [],
  };

  const skills = ['listening', 'reading', 'writing', 'speaking'];

  // Iterate chronologically from newest to oldest
  for (const attempt of completed) {
    for (const skill of skills) {
      const data = attempt.skills?.[skill] || attempt[skill];
      if (data && data.status !== 'not_attempted' && typeof data.band === 'number' && !isNaN(data.band)) {
        // Record latest if not yet found
        if (!latestScores[skill]) {
          latestScores[skill] = {
            ...data,
            attemptId: attempt.id,
            testId: attempt.testId,
            testLabel: attempt.testLabel,
            completedAt: attempt.completedAt,
          };
        }

        // Record best
        if (bestScores[skill] === null || data.band > bestScores[skill]) {
          bestScores[skill] = data.band;
        }

        // Append to history
        skillHistory[skill].push({
          attemptId: attempt.id,
          band: data.band,
          completedAt: attempt.completedAt,
        });
      }
    }
  }

  // 4. Calculate Overall Band from latest skill scores
  const L = latestScores.listening?.band ?? null;
  const R = latestScores.reading?.band ?? null;
  const W = latestScores.writing?.band ?? null;
  const S = latestScores.speaking?.band ?? null;

  const overall = calculateOverallBand(L, R, W, S);
  const hasScores = overall !== null;

  return {
    hasScores,
    overallBand: overall,
    latestScores,
    bestScores,
    skillHistory,
    completedCount: completed.length,
    recentAttempts: completed.slice(0, 10),
  };
}

/**
 * Complete Reset: Resets all performance data, attempts, scores, and evaluation caches.
 * Preserves user settings, lessons, theme, Gemini key, Groq key, and rotation queue.
 */
export function resetPerformanceData() {
  const storage = getStorage();
  if (!storage) return true;

  try {
    // 1. Wipe canonical performance store
    storage.removeItem(PERFORMANCE_STORAGE_KEY);

    // 2. Wipe legacy score/history keys
    const legacyKeys = [
      'omniprep_skill_scores',
      'omniprep_history',
      'omniprep_active_mock_session',
      'omniprep_ai_cache',
      'omniprep_attempted_listening',
      'omniprep_attempted_reading',
      'omniprep_attempted_writing',
      'omniprep_attempted_speaking',
    ];
    legacyKeys.forEach(k => storage.removeItem(k));

    // 3. Clear any dynamic test state keys while preserving config
    const preserveKeys = new Set([
      'omniprep_gemini_key',
      'omniprep_groq_key',
      'omniprep_completed_lessons',
      'omniprep_app_settings',
      'omniprep_target_band',
      'omniprep_theme',
      'omniprep_user_profile',
      'omniprep_test_rotation_queue_v1',
      'omniprep_last_watched_lesson',
    ]);

    const toRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('omniprep_') && !preserveKeys.has(key)) {
        if (!key.startsWith('omniprep_last_video_')) {
          toRemove.push(key);
        }
      }
    }
    toRemove.forEach(k => storage.removeItem(k));

    // Broadcast reset event to all subscribed components
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(PERFORMANCE_EVENT_NAME, {
        detail: { version: 1, attempts: [] }
      }));
    }

    return true;
  } catch (e) {
    console.warn('Failed to reset canonical performance data:', e);
    return false;
  }
}

/**
 * Subscribes to performance store changes for reactive UI updates across the app.
 */
export function subscribePerformanceStore(listener) {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handler = () => {
    try {
      listener(derivePerformanceSummary());
    } catch (e) {
      console.warn('Error in performance store listener:', e);
    }
  };

  window.addEventListener(PERFORMANCE_EVENT_NAME, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(PERFORMANCE_EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}
