/**
 * Reading render + scoring tests (contract v2).
 * Compiles the real React components and renders EVERY production question
 * group to static markup, then proves what the candidate sees:
 *  - each question number renders exactly once (one badge or one range badge)
 *  - the control matches the type (3 judgement radios, A–D radio cards,
 *    one picker/letter set per matching question, one text field per blank,
 *    checkbox cards for "choose N")
 *  - no source artifacts reach the DOM
 * Then exercises deterministic scoring end to end on real tests.
 */
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PRODUCTION_READING } from '../src/data/production/productionContent.js';
import { adaptProductionReading } from '../src/data/production/adapters.js';
import { evaluateReadingResponses, alignUnorderedAnswers, isCandidateAnswerCorrect } from '../src/utils/evaluation/evaluationEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// compiled inside the repo so 'react' resolves from node_modules
const out = path.join(__dirname, '../node_modules/.cache/cognition-test/ReadingQuestionGroup.mjs');
await build({
  entryPoints: [path.join(__dirname, '../src/components/reading/ReadingQuestionGroup.jsx')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'], logLevel: 'silent',
});
const { default: ReadingQuestionGroup } = await import(pathToFileURL(out).href);

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const count = (html, re) => (html.match(re) || []).length;
const render = (g, answers = {}) => renderToStaticMarkup(
  React.createElement(ReadingQuestionGroup, { group: g, answers, onAnswer: () => {} }));

console.log('== Reading render + scoring (contract v2) ==');

const tests = PRODUCTION_READING.map(r => adaptProductionReading(r, false));
const groups = tests.flatMap(t => t.passages.flatMap(p => p.questionGroups.map(g => ({ slug: t.slug, g }))));

await t(`every question number renders exactly once (${groups.length} groups)`, () => {
  const bad = [];
  for (const { slug, g } of groups) {
    const html = render(g);
    if (g.answerControl === 'multi_choice') {
      if (count(html, new RegExp(`>${g.startQ}–${g.endQ}<`, 'g')) !== 1) bad.push(`${slug} ${g.groupId}`);
      continue;
    }
    for (const q of g.questions) {
      const n = count(html, new RegExp(`class="rd-badge[^"]*"[^>]*>${q.questionNumber}<`, 'g'));
      if (n !== 1) bad.push(`${slug} q${q.questionNumber}×${n}`);
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join(', '));
});

await t('controls match the answer type', () => {
  const bad = [];
  for (const { slug, g } of groups) {
    const html = render(g);
    const n = g.questions.length;
    const radios = count(html, /type="radio"/g);
    const texts = count(html, /type="text"/g);
    const selects = count(html, /<select/g);
    const boxes = count(html, /type="checkbox"/g);
    let ok = true;
    switch (g.answerControl) {
      case 'tfng': case 'ynng': ok = radios === 3 * n && texts === 0 && selects === 0; break;
      case 'single_choice': ok = radios === g.questions.reduce((s, q) => s + q.options.length, 0) && texts === 0; break;
      case 'multi_choice': ok = boxes === g.optionPool.options.length && radios === 0 && texts === 0; break;
      case 'pool_select': ok = (selects + radios / g.optionPool.options.length) === n && texts === 0; break;
      case 'text': ok = texts === n && selects === 0 && radios === 0; break;
      default: ok = false;
    }
    if (!ok) bad.push(`${slug} ${g.groupId} ${g.answerControl} r=${radios} t=${texts} s=${selects} c=${boxes}`);
  }
  assert.equal(bad.length, 0, bad.slice(0, 6).join(' | '));
});

await t('no source artifacts or raw blank tokens reach the DOM', () => {
  const bad = [];
  for (const { slug, g } of groups) {
    const html = render(g);
    if (/Show Answers|Cambridge IELTS Tests?\s+\d|\[IMG|\[object Object\]|(?:[.…]\s?){4,}|_{3,}|undefined|null</.test(html)) bad.push(`${slug} ${g.groupId}`);
  }
  assert.equal(bad.length, 0, bad.slice(0, 8).join(', '));
});

await t('answers are never shipped to the candidate view', () => {
  for (const t2 of tests) for (const p of t2.passages) for (const q of p.questions) {
    assert.equal(q.answer, null); assert.equal(q.acceptedAnswers, null);
  }
});

await t('multi-select renders as checkboxes limited to the select count', () => {
  const { g } = groups.find(x => x.g.answerControl === 'multi_choice');
  const ids = g.optionPool.options.map(o => o.id);
  const answers = Object.fromEntries(g.questions.map((q, i) => [q.id, ids[i]]));
  const html = render(g, answers);
  assert.equal(count(html, /type="checkbox"[^>]*checked/g), g.questions.length);
  assert.equal(count(html, /disabled=""/g), ids.length - g.questions.length, 'unchosen options lock at the limit');
});

await t('a perfect answer sheet scores 40/40 on every test', async () => {
  for (const r of PRODUCTION_READING) {
    const graded = adaptProductionReading(r, true);
    const answers = {};
    // a candidate types one accepted form ("University/ college" means either word)
    for (const p of graded.passages) for (const q of p.questions) answers[q.id] = q.acceptedAnswers?.[0] ?? q.answer;
    const res = await evaluateReadingResponses({ passages: graded.passages, answers });
    assert.equal(res.raw, 40, `${r.slug} scored ${res.raw}`);
  }
});

await t('"Choose TWO/THREE" is marked in any order', async () => {
  const r = PRODUCTION_READING.find(x => x.passages.some(p => p.questionGroups.some(g => g.answerControl === 'multi_choice')));
  const graded = adaptProductionReading(r, true);
  const g = graded.passages.flatMap(p => p.questionGroups).find(x => x.answerControl === 'multi_choice');
  const keys = g.questions.map(q => q.answer);
  const reversed = Object.fromEntries(g.questions.map((q, i) => [q.id, keys[keys.length - 1 - i]]));
  const aligned = alignUnorderedAnswers(g.questions, reversed);
  for (const q of g.questions) assert.equal(aligned[q.id], q.answer);
  const oneWrong = { ...reversed, [g.questions[0].id]: 'Z' };
  const aligned2 = alignUnorderedAnswers(g.questions, oneWrong);
  const right = g.questions.filter(q => isCandidateAnswerCorrect(aligned2[q.id], q.answer)).length;
  assert.equal(right, g.questions.length - 1, 'one wrong letter costs exactly one mark');
});

await t('official key notation: "/" alternatives and optional (words)', () => {
  assert.ok(isCandidateAnswerCorrect('ratio', 'ratio (of fuel)'));
  assert.ok(isCandidateAnswerCorrect('ratio of fuel', 'ratio (of fuel)'));
  assert.ok(isCandidateAnswerCorrect('oxygen', 'air/ oxygen'));
  assert.ok(isCandidateAnswerCorrect('Slow', ['slow turning', 'slow']));
  assert.ok(!isCandidateAnswerCorrect('fast', 'slow (turning)'));
  assert.ok(isCandidateAnswerCorrect('not given', 'NOT GIVEN'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
