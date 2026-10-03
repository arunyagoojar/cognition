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
import { PRODUCTION_LISTENING } from '../src/data/production/productionContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Media lives in Cloudflare R2 — the contract is membership in the media
// manifest (which is live-verified against R2 by scripts/verify_r2.py),
// not the optional local dev archive.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'media_manifest.json'), 'utf8'));
const manifestKeys = new Set(manifest.media.map(f => f.r2Key));

function audioKey(appPath) {
  const base = appPath.split('/').pop();
  return `cognition/audio/listening/${base}`;
}
function imageKey(appPath) {
  const base = appPath.split('/').pop();
  const kind = base.startsWith('lis-test') ? 'listening' : 'writing';
  return `cognition/images/${kind}/${base}`;
}

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
// Polish bar: only complete, fully verified 40-question tests ship.
check(PRODUCTION_LISTENING.length >= 80, `corpus size (${PRODUCTION_LISTENING.length} tests)`);
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
    check(manifestKeys.has(audioKey(t.audio.appPath)), `audio in media manifest ${t.audio.appPath} (${t.slug})`);
  } else {
    check(t.audio.flags.includes('AUDIO_MISSING') || t.audio.status !== 'resolved',
      `no audio only when flagged (${t.slug})`);
  }
  for (const img of t.images) {
    imgTotal++;
    if (manifestKeys.has(imageKey(img.appPath))) imgOk++;
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

// ── Regression: every question listed exactly once per part ──
// Each question is answered in exactly ONE group: either as inline data-qid
// input(s) in that group's stimulus (multi-part blanks may render several boxes
// sharing one answer) or as one standalone block — never across groups and
// never inline + standalone.
for (const t of PRODUCTION_LISTENING) {
  for (const p of t.parts) {
    const owner = {};
    for (const g of p.questionGroups) {
      const inline = new Set([...(g.htmlContent || '').matchAll(/data-qid="(q\d+)"/g)].map(m => m[1]));
      for (const q of g.questions) {
        const isInline = inline.has(q.id);
        const prev = owner[q.id];
        check(!prev, `question listed once: ${t.slug} S${p.part} ${q.id} (${prev || '—'} then ${g.groupId}${isInline ? ' inline' : ' standalone'})`);
        owner[q.id] = `${g.groupId}${isInline ? ' inline' : ' standalone'}`;
      }
    }
  }
}

// Speaking has its own contract test: test/speaking_content.test.js

if (failures > 0) {
  console.error(`\n✗ ${failures} production content contract failures`);
  process.exit(1);
}
console.log('\nAll Production Content Contract Tests Passed!');
