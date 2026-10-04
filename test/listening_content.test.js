/**
 * Production Listening contract tests.
 * Only complete, fully verified 40-question tests ship; every question has a
 * control a candidate can answer and a key that control can produce.
 */
import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { PRODUCTION_LISTENING } from '../src/data/production/productionContent.js';
import { adaptProductionListening, getProductionListeningTest } from '../src/data/production/adapters.js';
import { getListeningTest } from '../src/data/listening/index.js';
import { evaluateListeningResponses } from '../src/utils/evaluation/evaluationEngine.js';
import { resolveMediaUrl } from '../src/utils/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const manifestKeys = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db/media_manifest.json'), 'utf8')).media.map(m => m.r2Key));
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db/listening/index.json'), 'utf8'));
const frozen = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db/listening/id-map.json'), 'utf8')).ids;
const r2Key = (p) => decodeURIComponent(resolveMediaUrl(p).replace(/^https?:\/\/[^/]+\//, ''));

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const ARTIFACT = /\[orphan|Show Answers?|␦|_{4,}|(?:[.…·]\s?){5,}/;
const SELECT = new Set(['single_select', 'multi_select']);

console.log('== Production Listening ==');
const eligible = new Set(index.tests.filter(r => r.status === 'verified' && r.fullTestEligible).map(r => r.slug));

await t(`≥80 full tests ship (${PRODUCTION_LISTENING.length}) and only verified ones`, () => {
  assert.ok(PRODUCTION_LISTENING.length >= 80);
  for (const r of PRODUCTION_LISTENING) assert.ok(eligible.has(r.slug), `${r.slug} is not a verified full test`);
});

await t('ids are frozen to the committed values', () => {
  for (const r of PRODUCTION_LISTENING) if (frozen[r.slug]) assert.equal(r.id, frozen[r.slug], r.slug);
});

await t('questions 1–40 exactly once, 10 per part, every one keyed', () => {
  for (const r of PRODUCTION_LISTENING) {
    const nums = r.parts.flatMap(p => p.questions.map(q => q.questionNumber));
    assert.deepEqual(nums.slice().sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1), r.slug);
    for (const p of r.parts) for (const q of p.questions) {
      assert.ok((p.part - 1) * 10 < q.questionNumber && q.questionNumber <= p.part * 10, `${r.slug} q${q.questionNumber} in part ${p.part}`);
      assert.ok(q.answer !== null && String(q.answer).trim() !== '', `${r.slug} q${q.questionNumber} key`);
    }
  }
});

await t('selection questions have an option list containing the key', () => {
  for (const r of PRODUCTION_LISTENING) for (const p of r.parts) for (const q of p.questions) {
    if (!SELECT.has(q.inputType)) continue;
    const ids = (q.options || []).map(o => o.id);
    assert.ok(ids.length >= 2 && new Set(ids).size === ids.length, `${r.slug} q${q.questionNumber} options`);
    assert.ok(ids.includes(String(q.answer).trim()), `${r.slug} q${q.questionNumber} key ${q.answer} in options`);
  }
});

await t('"choose N" groups: one selection, distinct letters, count = slots', () => {
  let groups = 0;
  for (const r of PRODUCTION_LISTENING) for (const p of r.parts) for (const g of p.questionGroups) {
    if (!g.selection) { assert.ok(g.questions.every(q => q.inputType !== 'multi_select'), `${r.slug} stray multi_select`); continue; }
    groups++;
    const vals = g.questions.map(q => q.answer);
    assert.equal(g.selection.selectCount, g.questions.length);
    assert.equal(new Set(vals).size, vals.length);
    assert.ok(g.questions.every(q => q.unorderedGroup === g.selection.unorderedGroup));
  }
  assert.ok(groups > 0, 'bundle has multi-select groups');
});

await t('every typed answer has an input: inline blank or a standalone question', () => {
  for (const r of PRODUCTION_LISTENING) for (const p of r.parts) {
    const inline = new Set([...p.questionGroups.map(g => g.htmlContent || '').join(' ').matchAll(/data-qid="(q\d+)"/g)].map(m => m[1]));
    for (const g of p.questionGroups) for (const q of g.questions) {
      if (SELECT.has(q.inputType) || inline.has(q.id)) continue;
      assert.ok(/[A-Za-z]{2,}/.test((q.questionText || '').replace(/_{3,}|\(answer in the stimulus\)/g, ' ')), `${r.slug} q${q.questionNumber} has no visible question`);
    }
  }
});

await t('no source artifacts in stimulus, questions or options', () => {
  for (const r of PRODUCTION_LISTENING) for (const p of r.parts) for (const g of p.questionGroups) {
    assert.ok(!ARTIFACT.test(g.htmlContent || ''), `${r.slug} ${g.groupId} stimulus`);
    for (const q of g.questions) for (const o of q.options || []) assert.ok(!ARTIFACT.test(o.label || ''), `${r.slug} q${q.questionNumber} option`);
  }
});

await t('audio and images resolve to objects in the R2 media manifest', () => {
  for (const r of PRODUCTION_LISTENING) {
    assert.ok(manifestKeys.has(r2Key(r.audio.appPath)), `${r.slug} audio ${r.audio.appPath}`);
    const adapted = adaptProductionListening(r);
    for (const p of adapted.parts) for (const g of p.questionGroups) {
      for (const m of (g.visualHtml || '').matchAll(/src="([^"]+)"/g)) {
        assert.ok(m[1].startsWith('http'), `${r.slug} image not resolved to R2: ${m[1]}`);
        assert.ok(manifestKeys.has(decodeURIComponent(m[1].replace(/^https?:\/\/[^/]+\//, ''))), `${r.slug} image ${m[1]}`);
      }
    }
  }
});

await t('answers are gated; unknown ids fall back through the adapter', () => {
  const t1 = getProductionListeningTest(PRODUCTION_LISTENING[0].testId, false);
  assert.ok(t1.parts.every(p => p.questions.every(q => q.answer === null)));
  const fb = getListeningTest('no-such-test');
  assert.ok(fb.parts.every(p => p.questions.every(q => q.answer === null)), 'fallback hides answers');
});

await t('a perfect answer sheet scores 40/40 on every test', async () => {
  for (const r of PRODUCTION_LISTENING) {
    const graded = adaptProductionListening(r, true);
    const answers = {};
    for (const p of graded.parts) for (const q of p.questions) answers[q.id] = String(q.answer).split('/')[0].trim();
    const res = await evaluateListeningResponses({ sections: graded.parts, answers });
    assert.equal(res.raw, 40, `${r.slug} scored ${res.raw}`);
  }
});

await t('"choose N" letters score in any order', async () => {
  const r = PRODUCTION_LISTENING.find(x => x.parts.some(p => p.questionGroups.some(g => g.selection)));
  const graded = adaptProductionListening(r, true);
  const g = graded.parts.flatMap(p => p.questionGroups).find(x => x.selection);
  const keys = g.questions.map(q => q.answer);
  const answers = Object.fromEntries(g.questions.map((q, i) => [q.id, keys[keys.length - 1 - i]]));
  const res = await evaluateListeningResponses({ sections: graded.parts, answers });
  assert.equal(res.raw, g.questions.length);
});

await t('owner-reviewed key corrections are applied (source value kept)', () => {
  const t164 = PRODUCTION_LISTENING.find(r => r.slug === 'ielts-listening-test-164');
  assert.equal(t164.parts.flatMap(p => p.questions).find(q => q.questionNumber === 19).answer, 'send newsletter');
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db/listening/tests/ielts-listening-test-164.json'), 'utf8'));
  assert.equal(rec.answerKey.corrections[0].source, 'end newsletter');
});

await t('typed answers carry their sentence/row for the AI answer check', () => {
  const missing = [];
  for (const r of PRODUCTION_LISTENING) for (const p of r.parts) for (const g of p.questionGroups) {
    if (g.visualHtml) continue; // the figure carries the context
    for (const q of g.questions) {
      if (q.inputType !== 'text') continue;
      if (!q.context || !/[A-Za-z0-9]{2}/.test(q.context.replace(/____/g, ''))) missing.push(`${r.slug} q${q.questionNumber}`);
      assert.ok(q.instruction, `${r.slug} q${q.questionNumber} instruction`);
    }
  }
  assert.equal(missing.length, 0, missing.slice(0, 5).join(', '));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
