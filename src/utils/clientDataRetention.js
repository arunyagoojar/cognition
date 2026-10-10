// Startup retention sweep for browser-side data.
//
// Long-lived data (scores, settings, lesson progress, the on-device speech
// model) is kept. Short-lived data that should never outlive its purpose is
// removed here once per page load:
//   - abandoned in-progress test state (omniprep_<testId>)     > 24 h
//   - an abandoned full-mock session                            > 24 h
//   - AI evaluation cache entries                               > 7 days
//   - orphaned speaking recordings in IndexedDB                 > 1 h
// The STT model download (Cache Storage) is intentionally NOT touched.

import { pruneAiCache } from './storage.js';
import { pruneAudioRecordingsOlderThan } from './audio/audioStore.js';

const HOUR = 60 * 60 * 1000;
export const IN_PROGRESS_MAX_AGE_MS = 24 * HOUR;
export const AUDIO_MAX_AGE_MS = 1 * HOUR;

// omniprep_* keys that are long-lived by design and must never be swept,
// even if their payload happens to carry an `updatedAt` field.
const KEEP_KEYS = new Set([
  'omniprep_performance_store_v1',
  'omniprep_skill_scores',
  'omniprep_history',
  'omniprep_ai_cache', // pruned per-entry by pruneAiCache()
  'omniprep_completed_lessons',
  'omniprep_app_settings',
  'omniprep_target_band',
  'omniprep_theme',
  'omniprep_user_profile',
  'omniprep_last_watched_lesson',
  'omniprep_onboarding_done_users',
  'omniprep_active_ai_provider',
  'omniprep_local_gemini_key',
  'omniprep_local_groq_key',
  'omniprep_recent_tests_v1',
]);
const KEEP_PREFIXES = ['omniprep_last_video_', 'omniprep_attempted_', 'omniprep_test_rotation_queue_'];

function isLongLived(key) {
  return KEEP_KEYS.has(key) || KEEP_PREFIXES.some(p => key.startsWith(p));
}

/** Removes stale in-progress test state from localStorage. Returns removed keys. */
export function pruneStaleTestState(now = Date.now(), storage = globalThis.localStorage) {
  const removed = [];
  if (!storage) return removed;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith('omniprep_') && !isLongLived(k)) keys.push(k);
    }
    for (const k of keys) {
      let parsed = null;
      try { parsed = JSON.parse(storage.getItem(k)); } catch { continue; }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      // saveTestState / saveActiveMockSession stamp every write with updatedAt
      if (!('updatedAt' in parsed)) continue;
      const ts = Date.parse(parsed.updatedAt);
      if (!Number.isFinite(ts) || now - ts > IN_PROGRESS_MAX_AGE_MS) {
        storage.removeItem(k);
        removed.push(k);
      }
    }
  } catch { /* storage unavailable */ }
  return removed;
}

let pruned = false;

/**
 * One-shot startup sweep. Synchronous localStorage work runs before the app
 * reads any state; the IndexedDB sweep runs in the background.
 */
export function pruneStaleClientData() {
  if (pruned) return;
  pruned = true;
  pruneStaleTestState();
  pruneAiCache();
  pruneAudioRecordingsOlderThan(AUDIO_MAX_AGE_MS).catch(() => {});
}
