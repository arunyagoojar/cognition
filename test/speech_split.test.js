/**
 * On-device transcription: long answers are split at pauses into segments the
 * speech model handles well, without dropping or duplicating audio.
 */
import assert from 'node:assert/strict';
import { splitAtPauses } from '../src/utils/speech/localStt.js';

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const RATE = 16000;
const tone = (secs, silenceAt = []) => {
  const a = new Float32Array(Math.round(secs * RATE));
  for (let i = 0; i < a.length; i++) a[i] = 0.4 * Math.sin(i / 7);
  for (const [s, e] of silenceAt) a.fill(0, Math.round(s * RATE), Math.round(e * RATE));
  return a;
};

console.log('== On-device speech: segmenting ==');
t('short answers are not split', () => {
  const segs = splitAtPauses(tone(27));
  assert.equal(segs.length, 1);
});
t('a 2-minute answer becomes segments of at most 28 s (inside Whisper\'s 30 s window) covering all audio', () => {
  const pcm = tone(120);
  const segs = splitAtPauses(pcm);
  assert.ok(segs.every(s => s.length <= 28 * RATE));
  assert.ok(segs.length >= 5 && segs.length <= 7, `${segs.length} segments`);
  assert.equal(segs.reduce((n, s) => n + s.length, 0), pcm.length);
});
t('cuts land in the pause, not mid-word', () => {
  const segs = splitAtPauses(tone(40, [[22, 22.6]]));
  const cut = segs[0].length / RATE;
  assert.ok(cut >= 22 && cut <= 22.6, `cut at ${cut.toFixed(2)} s`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
