// LocalStorage persistence for OmniPrep sessions, skill scores, and Mock tests
// Routed through canonical performanceStore.js as single source of truth.
import {
  recordAttempt,
  derivePerformanceSummary,
  resetPerformanceData,
  createAttemptId,
  getPerformanceStore,
  subscribePerformanceStore
} from './performanceStore.js';
import { clearAudioRecordings } from './audio/audioStore.js';

export {
  recordAttempt,
  derivePerformanceSummary,
  resetPerformanceData,
  createAttemptId,
  subscribePerformanceStore
};

const STORAGE_KEY_PREFIX = 'omniprep_';

export function saveTestState(testId, state) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${testId}`, JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

export function loadTestState(testId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${testId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
    return null;
  }
}

export function saveSkillScore(skill, scoreData) {
  try {
    const attemptId = scoreData?.attemptId || createAttemptId(skill);
    const band = typeof scoreData?.band === 'number' ? scoreData.band : (parseFloat(scoreData?.band) || null);
    
    // Save to canonical performance store
    recordAttempt({
      id: attemptId,
      type: skill,
      testId: scoreData?.testId || 'practice',
      testLabel: scoreData?.testLabel || `${skill.toUpperCase()} Practice`,
      startedAt: scoreData?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: scoreData?.status || (typeof band === 'number' ? 'completed' : 'partial'),
      overallBand: band,
      [skill]: {
        ...scoreData,
        band
      }
    });

    // Also mirror to legacy key for any direct callers
    const all = getSkillScores();
    all[skill] = {
      ...scoreData,
      band,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}skill_scores`, JSON.stringify(all));
  } catch (e) {
    console.warn('Failed to save skill score', e);
  }
}

export function getSkillScores() {
  try {
    const summary = derivePerformanceSummary();
    if (summary && summary.latestScores) {
      return summary.latestScores;
    }
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}skill_scores`);
    return raw ? JSON.parse(raw) : {
      listening: null,
      reading: null,
      writing: null,
      speaking: null
    };
  } catch (e) {
    return { listening: null, reading: null, writing: null, speaking: null };
  }
}

export function resetAllPerformanceData() {
  return resetPerformanceData();
}

export function resetSkillScores() {
  return resetPerformanceData();
}

/**
 * Removes user scores, attempts, and active exam sessions from localStorage
 * and sessionStorage on sign-out or account switch.
 */
export function clearUserScoresOnSignOut() {
  // Also removes omniprep_* in-progress state, the AI cache and any
  // device-only API keys (everything not on resetPerformanceData's keep list).
  resetPerformanceData();
  try {
    sessionStorage.removeItem('cognition_writing_active_session');
    sessionStorage.removeItem('cognition_speaking_active_session');
  } catch (_) {}
  // Per-person data that resetPerformanceData deliberately keeps for the
  // "reset scores" button but must not carry over to the next account.
  try {
    [
      `${STORAGE_KEY_PREFIX}user_profile`,
      `${STORAGE_KEY_PREFIX}completed_lessons`,
      `${STORAGE_KEY_PREFIX}last_watched_lesson`,
      'cognition_recent_writing_v1',
      'cognition_recent_speaking_v1',
    ].forEach(k => localStorage.removeItem(k));
    const videoKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEY_PREFIX}last_video_`)) videoKeys.push(k);
    }
    videoKeys.forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  clearAudioRecordings().catch(() => {});
}

// Remembers which account the locally stored data belongs to, so data left
// behind by a sign-out in another tab (or an expired session) is still wiped
// before a different account sees it. Uses a cognition_ key so the omniprep_
// sweep in resetPerformanceData() does not erase it.
const DATA_OWNER_KEY = 'cognition_data_owner';

/** Returns 'same' | 'claimed' (first owner) | 'foreign' (belonged to someone else). */
export function claimLocalDataOwner(userId) {
  if (!userId || userId === 'anon') return 'same';
  try {
    const owner = localStorage.getItem(DATA_OWNER_KEY);
    localStorage.setItem(DATA_OWNER_KEY, userId);
    if (!owner) return 'claimed';
    return owner === userId ? 'same' : 'foreign';
  } catch {
    return 'same';
  }
}

// ── Persistent Full Mock Exam Session State ────────────────────────────────
export function saveActiveMockSession(sessionData) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}active_mock_session`, JSON.stringify({
      ...sessionData,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Failed to save active mock session', e);
  }
}

export function getActiveMockSession() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}active_mock_session`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearActiveMockSession() {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}active_mock_session`);
  } catch (e) {
    console.warn('Failed to clear active mock session', e);
  }
}

// ── AI Evaluation Hash-Based Cache ─────────────────────────────────────────
export function getAiCache() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}ai_cache`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// Cached evaluations hold the candidate's own essays/transcripts, so they are
// bounded by age as well as count.
const AI_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const AI_CACHE_MAX_ENTRIES = 100;

function isAiCacheEntryFresh(entry, now = Date.now()) {
  const ts = Date.parse(entry?.cachedAt);
  return Number.isFinite(ts) && now - ts <= AI_CACHE_MAX_AGE_MS;
}

/** Drops expired AI cache entries (and the key itself when empty). */
export function pruneAiCache() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}ai_cache`);
    if (!raw) return;
    const cache = getAiCache();
    const kept = {};
    Object.entries(cache).forEach(([k, v]) => { if (isAiCacheEntryFresh(v)) kept[k] = v; });
    const keys = Object.keys(kept);
    if (keys.length === 0) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}ai_cache`);
    } else if (keys.length !== Object.keys(cache).length) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}ai_cache`, JSON.stringify(kept));
    }
  } catch { /* storage unavailable */ }
}

export function getAiCacheItem(hash) {
  if (!hash) return null;
  const entry = getAiCache()[hash];
  return entry && isAiCacheEntryFresh(entry) ? entry : null;
}

export function setAiCacheItem(hash, data) {
  if (!hash || !data) return;
  try {
    const now = Date.now();
    const cache = {};
    Object.entries(getAiCache()).forEach(([k, v]) => {
      if (k !== hash && isAiCacheEntryFresh(v, now)) cache[k] = v;
    });
    cache[hash] = {
      ...data,
      cachedAt: new Date(now).toISOString()
    };
    // Keep the newest AI_CACHE_MAX_ENTRIES (insertion order = oldest first)
    const keys = Object.keys(cache);
    keys.slice(0, Math.max(0, keys.length - AI_CACHE_MAX_ENTRIES)).forEach(k => delete cache[k]);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}ai_cache`, JSON.stringify(cache));
  } catch (e) {
    console.warn('Failed to set AI cache item', e);
  }
}

export function clearAiCache() {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}ai_cache`);
  } catch (e) {
    console.warn('Failed to clear AI cache', e);
  }
}

export function markLessonCompleted(lessonId) {
  saveCompletedLesson(lessonId);
}

export function saveCompletedResult(result) {
  try {
    const attemptId = result.id || createAttemptId('mock');
    const canonicalAttempt = {
      id: attemptId,
      type: result.type || 'full_mock',
      testId: result.testId,
      testLabel: result.testLabel || result.testId,
      startedAt: result.startedAt || new Date().toISOString(),
      completedAt: result.completedAt || new Date().toISOString(),
      status: 'completed',
      overallBand: result.overallBand ?? null,
      listening: result.listening || null,
      reading: result.reading || null,
      writing: result.writing || null,
      speaking: result.speaking || null,
      ...result
    };
    recordAttempt(canonicalAttempt);

    // Keep legacy history key in sync for backwards compatibility
    const history = getCompletedResults();
    history.unshift({
      id: attemptId,
      completedAt: canonicalAttempt.completedAt,
      ...result
    });
    localStorage.setItem(`${STORAGE_KEY_PREFIX}history`, JSON.stringify(history.slice(0, 50)));
  } catch (e) {
    console.warn('Failed to save history', e);
  }
}

export function getCompletedResults() {
  try {
    const store = getPerformanceStore();
    if (store && Array.isArray(store.attempts) && store.attempts.length > 0) {
      return store.attempts.filter(a => a.status === 'completed');
    }
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}history`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getResultById(id) {
  const store = getPerformanceStore();
  if (store && Array.isArray(store.attempts)) {
    const found = store.attempts.find(r => r.id === id || r.testId === id);
    if (found) return found;
  }
  const history = getCompletedResults();
  if (!id || id === 'latest') return history[0] || null;
  return history.find(r => r.id === id || r.testId === id) || history[0] || null;
}

export function getLatestResult() {
  const history = getCompletedResults();
  return history[0] || null;
}

export function getCompletedLessons() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}completed_lessons`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveCompletedLesson(lessonId) {
  try {
    const list = getCompletedLessons();
    if (!list.includes(lessonId)) {
      list.push(lessonId);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}completed_lessons`, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Failed to save completed lesson', e);
  }
}

// ── AI credentials (Phase 4) ────────────────────────────────────────────────
// Raw API keys are NEVER stored in localStorage/sessionStorage/env. They are
// sent once to the Worker (PUT /api/credentials/gemini) and stored encrypted.
// These helpers only handle legacy plaintext keys for one-time migration.

const LEGACY_GEMINI_KEY = `${STORAGE_KEY_PREFIX}gemini_key`;
const LEGACY_GROQ_KEY = `${STORAGE_KEY_PREFIX}groq_key`;

export function getLegacyLocalKeys() {
  try {
    return {
      gemini: localStorage.getItem(LEGACY_GEMINI_KEY) || '',
      groq: localStorage.getItem(LEGACY_GROQ_KEY) || '',
    };
  } catch {
    return { gemini: '', groq: '' };
  }
}

export function removeLegacyLocalKeys() {
  try {
    localStorage.removeItem(LEGACY_GEMINI_KEY);
    localStorage.removeItem(LEGACY_GROQ_KEY);
  } catch { /* best-effort */ }
}

// Cached "is AI configured" probe backed by the Worker credential status.
let credentialStatusCache = {};

export function invalidateCredentialStatusCache() {
  credentialStatusCache = {};
}

const ACTIVE_PROVIDER_KEY = `${STORAGE_KEY_PREFIX}active_ai_provider`;

export function getActiveAiProvider() {
  try {
    const val = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    return val === 'groq' ? 'groq' : 'gemini';
  } catch {
    return 'gemini';
  }
}

export function setActiveAiProvider(provider) {
  try {
    const p = provider === 'groq' ? 'groq' : 'gemini';
    localStorage.setItem(ACTIVE_PROVIDER_KEY, p);
    invalidateCredentialStatusCache();
    return p;
  } catch {
    return 'gemini';
  }
}

/**
 * 'configured' | 'not_configured' | 'unknown'. Checks active provider first,
 * or either provider if none specified.
 */
export async function getAiConfigState(checkProvider = null) {
  const provider = checkProvider || getActiveAiProvider();
  if (provider === 'gemini' && hasLocalGeminiKey()) return 'configured';
  if (provider === 'groq' && hasLocalGroqKey()) return 'configured';
  if (credentialStatusCache[provider] !== undefined) {
    return credentialStatusCache[provider]?.configured ? 'configured' : 'not_configured';
  }
  try {
    const { fetchCredentialStatus } = await import('./api.js');
    const status = await fetchCredentialStatus(provider);
    if (status?.unknown) return 'unknown';
    credentialStatusCache[provider] = status;
    return status?.configured ? 'configured' : 'not_configured';
  } catch {
    return 'unknown';
  }
}

export async function isAiConfigured(provider = null) {
  return (await getAiConfigState(provider)) === 'configured';
}

// ── Local Gemini key fallback (privacy mode) ───────────────────────────────
// When Cognition's secure cloud storage cannot be used, the key can be kept
// ONLY on this device. It is never stored on Cognition's servers: it is sent
// over HTTPS with each evaluation request (used in memory, never persisted or
// logged by the Worker), and the browser falls back to calling the provider
// directly. It is bound to the signed-in account, so another user on the same
// browser never sees or uses it, and it is wiped on sign-out.

const LOCAL_GEMINI_KEY = `${STORAGE_KEY_PREFIX}local_gemini_key`;
const LOCAL_GROQ_KEY = `${STORAGE_KEY_PREFIX}local_groq_key`;
let localKeyScope = '';

// Called by the API layer whenever the Clerk session (user id) is known.
export function setLocalKeyScope(userId) {
  localKeyScope = userId || '';
}

function readLocalKeyRecord(storageKey = LOCAL_GEMINI_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const rec = JSON.parse(raw);
    return rec && typeof rec.key === 'string' ? rec : null;
  } catch {
    return null;
  }
}

export function saveLocalGeminiKey(key) {
  try {
    const scope = localKeyScope || 'device';
    localStorage.setItem(LOCAL_GEMINI_KEY, JSON.stringify({ uid: scope, key: (key || '').trim() }));
    return true;
  } catch {
    return false; // storage unavailable (private mode / quota)
  }
}

export function getLocalGeminiKey() {
  const rec = readLocalKeyRecord(LOCAL_GEMINI_KEY);
  if (!rec) return '';
  if (!localKeyScope || rec.uid === localKeyScope || rec.uid === 'device') return rec.key;
  return '';
}

export function removeLocalGeminiKey() {
  try {
    const rec = readLocalKeyRecord(LOCAL_GEMINI_KEY);
    if (!rec || !localKeyScope || rec.uid === localKeyScope || rec.uid === 'device') localStorage.removeItem(LOCAL_GEMINI_KEY);
  } catch { /* best-effort */ }
}

export function hasLocalGeminiKey() {
  return Boolean(getLocalGeminiKey());
}

export function saveLocalGroqKey(key) {
  try {
    const scope = localKeyScope || 'device';
    localStorage.setItem(LOCAL_GROQ_KEY, JSON.stringify({ uid: scope, key: (key || '').trim() }));
    return true;
  } catch {
    return false;
  }
}

export function getLocalGroqKey() {
  const rec = readLocalKeyRecord(LOCAL_GROQ_KEY);
  if (!rec) return '';
  if (!localKeyScope || rec.uid === localKeyScope || rec.uid === 'device') return rec.key;
  return '';
}

export function removeLocalGroqKey() {
  try {
    const rec = readLocalKeyRecord(LOCAL_GROQ_KEY);
    if (!rec || !localKeyScope || rec.uid === localKeyScope || rec.uid === 'device') localStorage.removeItem(LOCAL_GROQ_KEY);
  } catch { /* best-effort */ }
}

export function hasLocalGroqKey() {
  return Boolean(getLocalGroqKey());
}

export function getTargetBand() {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}target_band`) || '7.5';
  } catch {
    return '7.5';
  }
}

export function saveTargetBand(band) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}target_band`, String(band));
    return String(band);
  } catch {
    return band;
  }
}

export function getLastPlayedVideo(skill) {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}last_video_${skill}`) || null;
  } catch {
    return null;
  }
}

export function saveLastPlayedVideo(skill, lessonId) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}last_video_${skill}`, lessonId);
  } catch (e) {
    console.warn('Failed to save last played video', e);
  }
}

export function getLastWatchedLesson() {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}last_watched_lesson`) || null;
  } catch {
    return null;
  }
}

export function saveLastWatchedLesson(lessonId) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}last_watched_lesson`, lessonId);
  } catch (e) {
    console.warn('Failed to save last watched lesson', e);
  }
}

// ── Standalone Global App Preferences (Font Scale & Theme) ─────────────────
export function getAppSettings() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}app_settings`);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      theme: parsed.theme || 'light',
      fontSize: parsed.fontSize || '100%'
    };
  } catch (e) {
    return { theme: 'light', fontSize: '100%' };
  }
}

export function saveAppSettings(settings) {
  try {
    const current = getAppSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}app_settings`, JSON.stringify({
      theme: updated.theme,
      fontSize: updated.fontSize
    }));
    applyAppSettings(updated);
    return updated;
  } catch (e) {
    console.warn('Failed to save app settings', e);
    return settings;
  }
}

export function applyAppSettings(settings) {
  if (typeof document === 'undefined') return;
  try {
    const root = document.documentElement;
    const theme = settings?.theme || 'light';
    root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');

    const fontScaleMap = {
      '100%': { px: '16px', scale: '1' },
      '115%': { px: '18.4px', scale: '1.15' },
      '130%': { px: '20.8px', scale: '1.30' },
      '145%': { px: '23.2px', scale: '1.45' }
    };
    const f = fontScaleMap[settings?.fontSize] || fontScaleMap['100%'];
    root.style.setProperty('--app-font-size', f.px);
    root.style.setProperty('--app-font-scale', f.scale);
  } catch (e) {
    console.warn('Failed to apply app settings to DOM', e);
  }
}

// History-based Question Pool Management (Unattempted vs Attempted Pools)
export function getAttemptedQuestionSets(skill) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function recordAttemptedQuestionSet(skill, setId) {
  try {
    if (!setId) return;
    const attempted = getAttemptedQuestionSets(skill);
    if (!attempted.includes(setId)) {
      attempted.push(setId);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`, JSON.stringify(attempted));
    }
  } catch (e) {
    console.warn('Failed to record attempted question set', e);
  }
}

export function clearAttemptedQuestionSets(skill) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`);
  } catch (e) {
    console.warn('Failed to clear attempted question sets', e);
  }
}

export function getQuestionPoolStats(skill, totalCount) {
  const attempted = getAttemptedQuestionSets(skill);
  const attemptedCount = attempted.length;
  const remainingInPool = Math.max(0, totalCount - attemptedCount);
  return {
    attemptedCount,
    totalCount,
    remainingInPool,
    isExhausted: remainingInPool === 0
  };
}

// ── User Profile & Onboarding Storage ─────────────────────────────────────
export function getUserProfile() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}user_profile`);
    if (!raw) {
      return {
        name: '',
        targetExams: ['IELTS'],
        onboarded: false
      };
    }
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || '',
      targetExams: ['IELTS'],
      onboarded: Boolean(parsed.onboarded)
    };
  } catch (e) {
    return { name: '', targetExams: ['IELTS'], onboarded: false };
  }
}

export function saveUserProfile(profile) {
  try {
    const current = getUserProfile();
    const updated = {
      ...current,
      ...profile,
      targetExams: ['IELTS'],
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user_profile`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save user profile', e);
    return profile;
  }
}
