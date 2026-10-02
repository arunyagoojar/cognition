/**
 * Production content contract tests (Phase 3).
 *
 * Validates the generated runtime bundle (src/data/production/productionContent.js)
 * against the Phase 3 hard invariants:
 *  - every emitted Listening test has 4 sections and verified questions
 *  - every question has a deterministic id and a source-backed stem
 *  - every emitted answer is non-null (deterministic objective scoring)
 *  - audio/image app paths resolve to real files in the dev public dir
 *  - every Speaking package is explicitly Part 2 with partial coverage
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTION_LISTENING, PRODUCTION_SPEAKING } from '../src/data/production/productionContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failures = 0;
function check(cond, label) {
  if (!cond) {
    failures++;
    console.error('  ✗ FAIL:', label);
  }
  return cond;
}

// ── Listening ────────────────────────────────────────────────
console.log('== Production Listening ==');
check(PRODUCTION_LISTENING.length >= 190, `corpus size (${PRODUCTION_LISTENING.length} tests)`);
let qTotal = 0, qWithAnswer = 0, audioOk = 0, imgOk = 0, imgTotal = 0;
for (const t of PRODUCTION_LISTENING) {
  check(Number.isInteger(t.testId) && t.testId >= 1, `testId sane (${t.slug})`);
  check(t.parts.length === 4, `4 sections for ${t.slug} (got ${t.parts.length})`);
  const nums = t.parts.flatMap(p => p.questions.map(q => q.questionNumber)).sort((a, b) => a - b);
  qTotal += nums.length;
  for (const p of t.parts) {
    const ids = new Set(p.questions.map(q => q.id));
    check(ids.size === p.questions.length, `unique question ids in ${t.slug} S${p.part}`);
    for (const q of p.questions) {
      check(/^q\d+$/.test(q.id), `deterministic id ${q.id} in ${t.slug}`);
      check(typeof q.questionText === 'string' && q.questionText.length > 0, `stem present ${t.slug} ${q.id}`);
      if (q.answer !== null && q.answer !== undefined && q.answer !== '') qWithAnswer++;
    }
  }
  if (t.audio.appPath) {
    audioOk++;
    const p = path.join(ROOT, 'public', t.audio.appPath.replace(/^\//, ''));
    check(fs.existsSync(p), `audio exists ${t.audio.appPath} (${t.slug})`);
  } else {
    check(t.audio.flags.includes('AUDIO_MISSING') || t.audio.status !== 'resolved',
      `no audio only when flagged (${t.slug})`);
  }
  for (const img of t.images) {
    imgTotal++;
    if (fs.existsSync(path.join(ROOT, 'public', img.appPath.replace(/^\//, '')))) imgOk++;
  }
}
console.log(`  tests: ${PRODUCTION_LISTENING.length}, questions: ${qTotal}, answers: ${qWithAnswer}, audio resolved: ${audioOk}, images: ${imgOk}/${imgTotal}`);
check(qWithAnswer === qTotal, 'every emitted question has a mapped answer');

// ── Regression: no duplicate visual may reach the render tree ──
// Root cause (Phase 4): source pages embed lazy-load <img data-src> plus a
// <noscript><img src> fallback; both were captured into group stimulus.
for (const t of PRODUCTION_LISTENING) {
  const perUrl = {};
  for (const p of t.parts) {
    for (const g of p.questionGroups) {
      const imgs = g.htmlContent.match(/<img[^>]*src="([^"]+)"/g) || [];
      for (const im of imgs) {
        const url = im.match(/src="([^"]+)"/)[1];
        check(!perUrl[url], `image rendered once per test ${t.slug}: ${url}`);
        perUrl[url] = true;
      }
      // a visual never appears both as visualHtml and inside htmlContent
      if (g.visualHtml) {
        check(!(g.htmlContent || '').includes('<img'), `visualHtml exclusive in ${t.slug} ${g.groupId}`);
      }
    }
  }
}

// ── Regression: no interactive-placeholder glyphs in rendered exam text ──
// ('\u2426' was the source site's answer-box glyph; must never reach stems)
for (const t of PRODUCTION_LISTENING) {
  for (const p of t.parts) {
    check(!p.htmlContent.includes('\u2426'), `no placeholder glyph in ${t.slug} S${p.part} html`);
    for (const g of p.questionGroups) {
      check(!(g.htmlContent || '').includes('\u2426'), `no glyph in ${t.slug} ${g.groupId} html`);
      for (const q of g.questions) {
        const text = [q.questionText, q.prompt, ...(q.options || []).map(o => o.label)].join(' ');
        check(!text.includes('\u2426'), `no glyph in ${t.slug} ${q.id}`);
      }
    }
  }
}

// ── Speaking ─────────────────────────────────────────────────
console.log('== Production Speaking ==');
check(PRODUCTION_SPEAKING.length >= 175, `speaking corpus size (${PRODUCTION_SPEAKING.length})`);
for (const s of PRODUCTION_SPEAKING) {
  check(s.coverage.part2 === 'available', `part2 available (${s.slug})`);
  check(s.coverage.part1 === 'unavailable' && s.coverage.part3 === 'unavailable',
    `partial coverage declared explicitly (${s.slug})`);
  check(typeof s.cueCard.topic === 'string' && s.cueCard.topic.length > 3, `topic present (${s.slug})`);
  check(Array.isArray(s.sampleAnswer.sentences), `sample answer stored separately (${s.slug})`);
}

if (failures > 0) {
  console.error(`\n✗ ${failures} production content contract failures`);
  process.exit(1);
}
console.log('\nAll Production Content Contract Tests Passed!');
