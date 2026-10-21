/**
 * Delivery measures for one spoken answer, computed from the verbatim
 * transcript and the timing of its lines (one line per stretch of speech).
 * Timing is measured; text counts are possible markers, not acoustic facts or
 * confirmed errors. Pure functions (no DOM).
 */

const HESITATIONS = new Set(['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm', 'mhm']);
const DISCOURSE_FILLERS = ['you know', 'i mean', 'kind of', 'sort of'];
const CORRECTION_MARKERS = /\b(i mean|no wait|or rather|let me rephrase|what i mean is|actually no)\b/g;

/** Long-pause threshold: a gap this long between lines is a noticeable pause. */
export const LONG_PAUSE_S = 2;
/** A gap this long between lines counts as a pause at all. */
export const PAUSE_S = 0.7;

function tokens(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Word-level and phrase-level repetitions: "I I think", "the the", "I think I think". */
function countRepetitions(toks) {
  let reps = 0;
  for (let i = 0; i < toks.length;) {
    // Consume repeated pairs once instead of counting overlapping pairs again.
    if (i + 3 < toks.length && toks[i] !== toks[i + 1] && toks[i] === toks[i + 2] && toks[i + 1] === toks[i + 3]) {
      const first = toks[i], second = toks[i + 1];
      i += 2;
      while (toks[i] === first && toks[i + 1] === second) { reps++; i += 2; }
    } else {
      if (i > 0 && toks[i] === toks[i - 1] && !HESITATIONS.has(toks[i])) reps++;
      i++;
    }
  }
  return reps;
}

/** Explicit possible repair markers only; repeated pronouns are normal grammar. */
function countSelfCorrections(text) {
  return (String(text || '').toLowerCase().match(CORRECTION_MARKERS) || []).length;
}

/**
 * @param {{ text: string, segments?: Array<{text,start,end}>, durationSec?: number }} answer
 * @returns measures, or null when there is no speech
 */
export function computeSpeechMetrics({ text = '', segments = [], durationSec = 0 } = {}) {
  const toks = tokens(text);
  if (!toks.length) return null;
  const words = toks.length;

  const segs = (Array.isArray(segments) ? segments : []).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  let speakingSec = 0;
  const gaps = [];
  segs.forEach((s, i) => {
    speakingSec += s.end - s.start;
    if (i > 0) gaps.push(Math.max(0, s.start - segs[i - 1].end));
  });
  // Without timing, fall back to the recording length (includes pauses).
  const spanSec = segs.length ? segs[segs.length - 1].end - segs[0].start : Number(durationSec) || 0;
  const pauses = gaps.filter((g) => g >= PAUSE_S);
  const longPauses = gaps.filter((g) => g >= LONG_PAUSE_S);

  const hesitations = toks.filter((t) => HESITATIONS.has(t)).length;
  const joined = ` ${toks.join(' ')} `;
  const discourseFillers = DISCOURSE_FILLERS.reduce((n, f) => n + (joined.split(` ${f} `).length - 1), 0);

  return {
    words,
    durationSec: Math.round((spanSec || Number(durationSec) || 0) * 10) / 10,
    wordsPerMinute: spanSec > 3 ? Math.round((words / spanSec) * 60) : null,
    pauses: pauses.length,
    longPauses: longPauses.length,
    longestPauseSec: gaps.length ? Math.round(Math.max(...gaps) * 10) / 10 : 0,
    pauseTimingAvailable: segs.length >= 2,
    hesitations,
    discourseFillers,
    repetitions: countRepetitions(toks),
    selfCorrections: countSelfCorrections(text),
    speakingSec: Math.round(speakingSec * 10) / 10,
  };
}

/**
 * The answer as a script: one line per stretch of speech, with noticeable
 * pauses marked. Uses the timed lines when they still match the (possibly
 * edited) transcript; otherwise the transcript's own lines.
 */
export function formatSpeechScript({ text = '', segments = [] } = {}) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const segs = Array.isArray(segments) ? segments : [];
  if (segs.length !== lines.length || !segs.length) return lines.join('\n');
  const out = [];
  lines.forEach((line, i) => {
    if (i > 0) {
      const gap = segs[i].start - segs[i - 1].end;
      if (gap >= LONG_PAUSE_S) out.push(`[pause ${gap.toFixed(1)}s]`);
    }
    out.push(line);
  });
  return out.join('\n');
}

/** One compact line of measures for the examiner prompt. */
export function describeMetrics(m) {
  if (!m) return '';
  const parts = [
    `${m.words} words in ${m.durationSec}s`,
    m.wordsPerMinute ? `${m.wordsPerMinute} words/min` : null,
    m.pauseTimingAvailable ? `${m.pauses} timed gaps (${m.longPauses} over ${LONG_PAUSE_S}s, longest ${m.longestPauseSec}s)` : 'Pause timing unavailable',
    `${m.hesitations} um/uh`,
    `${m.discourseFillers} possible discourse markers`,
    `${m.repetitions} possible repeated spans`,
    `${m.selfCorrections} possible repair markers`,
  ].filter(Boolean);
  return parts.join(' · ');
}
