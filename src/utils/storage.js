// LocalStorage persistence for OmniPrep sessions, skill scores, and Mock tests
// Routed through canonical performanceStore.js as single source of truth.
import {
  recordAttempt,
  derivePerformanceSummary,
  resetPerformanceData,
  createAttemptId,
  getPerformanceStore,
  getAttemptById as getCanonicalAttemptById,
  subscribePerformanceStore
} from './performanceStore.js';

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

export function getAiCacheItem(hash) {
  if (!hash) return null;
  const cache = getAiCache();
  return cache[hash] || null;
}

export function setAiCacheItem(hash, data) {
  if (!hash || !data) return;
  try {
    const cache = getAiCache();
    cache[hash] = {
      ...data,
      cachedAt: new Date().toISOString()
    };
    // Keep up to 100 evaluation cache entries
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
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

export function saveApiKey(key) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}gemini_key`, (key || '').trim());
  } catch (e) {
    console.warn('Failed to save API key', e);
  }
}

export function getApiKey() {
  try {
    if (typeof window !== 'undefined') {
      const urlKey = new URLSearchParams(window.location.search).get('aiKey');
      if (urlKey) return urlKey.trim();
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}gemini_key`);
    if (saved && saved.trim()) return saved.trim();
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY.trim();
    }
    return '';
  } catch (e) {
    return '';
  }
}

export function saveGroqApiKey(key) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}groq_key`, (key || '').trim());
  } catch (e) {
    console.warn('Failed to save Groq API key', e);
  }
}

export function getGroqApiKey() {
  try {
    if (typeof window !== 'undefined') {
      const urlKey = new URLSearchParams(window.location.search).get('groqKey');
      if (urlKey) return urlKey.trim();
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}groq_key`);
    if (saved && saved.trim()) return saved.trim();
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GROQ_API_KEY) {
      return import.meta.env.VITE_GROQ_API_KEY.trim();
    }
    return '';
  } catch (e) {
    return '';
  }
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

// ── Standalone Global App Preferences (Font Scale, Theme & API Key) ────────
export function getAppSettings() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}app_settings`);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      theme: parsed.theme || 'light',
      fontSize: parsed.fontSize || '100%',
      apiKey: getApiKey()
    };
  } catch (e) {
    return { theme: 'light', fontSize: '100%', apiKey: getApiKey() };
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
    if (settings.apiKey !== undefined) {
      saveApiKey(settings.apiKey);
    }
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
