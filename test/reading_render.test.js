/**
 * Phase 5 — Reading rendering data-contract tests.
 * Proves at the data layer what the renderer will draw:
 *  - question numbers render exactly once (injected blanks carry data-qid,
 *    stems carry no leading number, group ranges appear once)
 *  - no duplicated passage images
 *  - question-type → interaction mapping follows the model, not test IDs
 *  - every image reference resolves into the R2 media manifest
 */
import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';
import { PRODUCTION_READING } from '../src/data/production/productionContent.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'media_manifest.json'), 'utf8'));
const manifestKeys = new Set(manifest.media.map(f => f.r2Key));

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}

console.log('== Reading rendering data contract ==');

const KNOWN_INPUT_TYPES = new Set(['text', 'single_select', 'multi_select', 'map_select']);

t('no question stem duplicates its own number', () => {
  let bad = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      for (const q of p.questions || []) {
        // stem must not start with its own number ("18. whales disappear…")
        if (/^\s*\d{1,2}\s*[\.\)]\s/.test(q.questionText || '')) bad++;
      }
    }
  }
  assert.equal(bad, 0, `${bad} stems carry a leading number that would duplicate the badge`);
});

t('no group stimulus repeats the "Questions N–M" range (header owns it)', () => {
  let bad = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      for (const g of p.questionGroups || []) {
        if (/Questions?\s+\d{1,2}\s*[–-]\s*\d{1,2}/.test(g.htmlContent || '')) bad++;
      }
    }
  }
  assert.equal(bad, 0, `${bad} group stimuli duplicate the question-range header`);
});

t('no passage renders the same image twice', () => {
  let bad = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      const srcs = [...(p.htmlContent || '').matchAll(/src=\\?"([^"\\]+?\.(?:png|webp|jpg|jpeg))/g)].map(m => m[1]);
      const uniq = new Set(srcs.map(s => s.split('/').pop()));
      if (srcs.length > uniq.size) bad++;
    }
  }
  assert.equal(bad, 0, `${bad} passages render a duplicate image`);
});

t('every question inputType is a known interaction', () => {
  let bad = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      for (const q of p.questions || []) {
        if (!KNOWN_INPUT_TYPES.has(q.inputType)) bad++;
        // tfng/ynng must be typed or pill-rendered — never a select with long options
        if (q.questionType === 'true_false_not_given' && q.inputType === 'single_select') bad++;
      }
    }
  }
  assert.equal(bad, 0, `${bad} questions carry an unknown/invalid interaction type`);
});

t('single_select questions always have ≥2 real options (no lone-choice dropdowns)', () => {
  let bad = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      for (const q of p.questions || []) {
        if (q.inputType === 'single_select' && (!q.options || q.options.length < 2)) bad++;
      }
    }
  }
  assert.equal(bad, 0, `${bad} single_select questions would render a choice-less dropdown`);
});

t('every reading image reference resolves into the R2 manifest', () => {
  let missing = 0;
  for (const r of PRODUCTION_READING) {
    for (const p of r.passages) {
      for (const a of p.assets || []) {
        const key = `cognition/images/reading/${a.projectPath.split('/').pop()}`;
        if (!manifestKeys.has(key)) missing++;
      }
      for (const m of (p.htmlContent || '').matchAll(/src=\\?"([^"\\]+?(?:lis-test[^"\\]+|reading-assets[^"\\]+))\\?"/g)) {
        const key = `cognition/images/reading/${m[1].split('/').pop()}`;
        if (!manifestKeys.has(key)) missing++;
      }
    }
  }
  assert.equal(missing, 0, `${missing} image references have no manifest entry`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
