/**
 * Guards against Whisper's known failure modes on recorded answers, without
 * "cleaning up" what the candidate actually said:
 *
 *  - Silence / room noise makes Whisper invent text ("Thank you.", "you").
 *    An energy-based voice-activity check trims leading and trailing silence
 *    and skips segments that hold no speech at all, so the model never sees them.
 *  - Long decoding loops repeat one phrase over and over. Runs of a multi-word
 *    phrase repeated 4+ times in a row are collapsed to two occurrences; a
 *    speaker's own short repetitions ("I I think", "the the") are left alone.
 *
 * Pure functions (no DOM / worker APIs) so they run in the worker, on the main
 * thread and in Node tests.
 */

const FRAME_S = 0.03;
/** Below about -49 dBFS RMS a frame is treated as silence whatever the noise floor. */
const ABS_MIN_RMS = 0.0035;

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}

/** RMS of consecutive 30 ms frames. */
export function frameRms(pcm, rate = 16000) {
  const len = Math.max(1, Math.round(rate * FRAME_S));
  const n = Math.floor(pcm.length / len);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0;
    const base = f * len;
    for (let i = 0; i < len; i++) {
      const v = pcm[base + i];
      e += v * v;
    }
    out[f] = Math.sqrt(e / len);
  }
  return out;
}

/**
 * Speech threshold for one recording, adapted to its noise floor:
 * 3x the quiet-frame level, never below ABS_MIN_RMS, and never so high that
 * the loudest frames (the speech) would fall under it in a noisy room.
 */
export function speechThreshold(rms) {
  if (!rms.length) return ABS_MIN_RMS;
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const floor = percentile(sorted, 0.15);
  const p95 = percentile(sorted, 0.95);
  const thr = Math.max(ABS_MIN_RMS, floor * 3);
  return Math.min(thr, Math.max(ABS_MIN_RMS, p95 * 0.35));
}

/** Seconds of audio above the speech threshold. */
export function speechSeconds(pcm, threshold, rate = 16000) {
  const rms = frameRms(pcm, rate);
  const thr = threshold ?? speechThreshold(rms);
  let n = 0;
  for (let i = 0; i < rms.length; i++) if (rms[i] > thr) n++;
  return n * FRAME_S;
}

/**
 * Trims leading and trailing silence, keeping a small margin so soft word
 * onsets and endings stay intact.
 * Returns { pcm, startSec, threshold, speechSec } — pcm is a subarray (no copy),
 * empty when the recording holds no speech.
 */
export function trimSilence(pcm, rate = 16000, { padBeforeS = 0.3, padAfterS = 0.45, minSpeechS = 0.2 } = {}) {
  const rms = frameRms(pcm, rate);
  const threshold = speechThreshold(rms);
  let first = -1;
  let last = -1;
  let voiced = 0;
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] > threshold) {
      if (first < 0) first = i;
      last = i;
      voiced++;
    }
  }
  const speechSec = voiced * FRAME_S;
  if (first < 0 || speechSec < minSpeechS) {
    return { pcm: pcm.subarray(0, 0), startSec: 0, threshold, speechSec };
  }
  const frameLen = Math.round(rate * FRAME_S);
  const start = Math.max(0, first * frameLen - Math.round(padBeforeS * rate));
  const end = Math.min(pcm.length, (last + 1) * frameLen + Math.round(padAfterS * rate));
  return { pcm: pcm.subarray(start, end), startSec: start / rate, threshold, speechSec };
}

/** Phrases Whisper is known to emit on (near-)silent audio. */
const SILENCE_PHANTOMS = new Set([
  'you',
  'thank you',
  'thanks',
  'thank you very much',
  'thanks for watching',
  'thank you for watching',
  'bye',
  'okay',
]);

function wordsOf(text) {
  return String(text || '').split(/\s+/).filter(Boolean);
}

function bare(word) {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '');
}

/**
 * Collapses decoding loops: a phrase of 2–10 words repeated 4+ times in a row
 * is kept twice. Natural repetitions (stutters, restarts) are never that long.
 */
export function collapseRepetitionLoops(text) {
  const words = wordsOf(text);
  if (words.length < 8) return words.join(' ');
  const keys = words.map(bare);
  const out = [];
  let i = 0;
  while (i < words.length) {
    let collapsed = false;
    for (let n = 2; n <= 10 && i + n * 4 <= words.length; n++) {
      let reps = 1;
      while (i + (reps + 1) * n <= words.length) {
        let same = true;
        for (let k = 0; k < n; k++) {
          if (keys[i + k] !== keys[i + reps * n + k]) {
            same = false;
            break;
          }
        }
        if (!same) break;
        reps++;
      }
      if (reps >= 4) {
        out.push(...words.slice(i, i + 2 * n));
        i += reps * n;
        collapsed = true;
        break;
      }
    }
    if (!collapsed) {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(' ');
}

/**
 * Final guard for one segment's text. `speechSec` is how much of the segment
 * was actually voiced: a stock "Thank you." over a mostly silent segment is
 * the model's silence artefact, not the candidate.
 */
export function guardSegmentText(text, speechSec = Infinity) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  // Whisper's non-speech annotations ("[BLANK_AUDIO]", "(music)") are not words.
  t = t.replace(/\[[^\]]*\]|\((?:music|applause|laughs?|laughter|silence|inaudible|noise)\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  const key = t.toLowerCase().replace(/[^a-z' ]/g, '').trim();
  if (speechSec < 1.0 && SILENCE_PHANTOMS.has(key)) return '';
  return collapseRepetitionLoops(t);
}

/** Generation cap per segment: generous for fast speech, short enough to stop runaway loops. */
export function maxNewTokensFor(durationSec) {
  return Math.max(24, Math.min(440, Math.ceil(durationSec * 7) + 16));
}
