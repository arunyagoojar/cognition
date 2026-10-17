import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildAnswerReviewItems } from '../src/utils/answerReview.js';

const out = path.resolve('node_modules/.cache/cognition-test/AnswerReviewFixture.mjs');
await build({
  stdin: {
    contents: `export { default as ReadingModule } from './src/components/modules/ReadingModule.jsx';
      export { default as ListeningModule } from './src/components/modules/ListeningModule.jsx';
      export { default as AnswerReviewPage } from './src/components/common/AnswerReviewPage.jsx';`,
    resolveDir: process.cwd(),
    loader: 'jsx',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'], logLevel: 'silent',
});
const { ReadingModule, ListeningModule, AnswerReviewPage } = await import(pathToFileURL(out).href);
const questions = [
  { id: 'q1', questionNumber: 1, questionText: 'Stevenson’s was founded in', answer: 'C', acceptedAnswers: [], options: [{ id: 'B', label: '1924' }, { id: 'C', label: '1926' }] },
  { id: 'q2', questionNumber: 2, questionText: 'The repair will cost ____ pounds.', answer: '50' },
  { id: 'q3', questionNumber: 3, questionText: 'A place to wait is the ____', answer: 'reception' },
  { id: 'q4', questionNumber: 4, questionText: 'The meeting is in ____', answer: 'October' },
];
const result = {
  testId: 100, band: 5, raw: 1, total: 4, percentage: 25,
  answers: { q1: 'B', q2: '', q3: 'reception area', q4: 'October' },
  itemResults: {
    q1: { finalResult: 'INCORRECT' },
    q2: { finalResult: 'INCORRECT', candidateAnswer: null },
    q3: { finalResult: 'UNCERTAIN', candidateAnswer: 'reception area', officialAnswer: 'reception', unresolved: true },
    q4: { finalResult: 'CORRECT', candidateAnswer: 'October', officialAnswer: 'October' },
  },
};
const original = JSON.stringify(result);
for (const [skill, Module] of [['reading', ReadingModule], ['listening', ListeningModule]]) {
  const section = { part: 1, passageNumber: 1, questions };
  const test = { testId: 100, passages: [section], parts: [section] };
  const summary = () => renderToStaticMarkup(React.createElement(Module, { initialResult: result, initialTest: test }));
  const before = summary();
  assert.match(before, /<button[^>]*>.*?Review answers<\/button>/s);
  assert.match(before, /1 \/ <!-- -->4|1 \/ 4/);
  assert(!before.includes('Your answers, question by question'), 'summary does not bury the answer list below other cards');

  const items = buildAnswerReviewItems(result, test, skill);
  assert.equal(items.q1.officialAnswer, 'C', 'old item details recover the correct key');
  assert.equal(items.q1.candidateAnswer, 'B', 'old item details recover the candidate answer');
  assert.equal(items.q3.finalResult, 'UNCERTAIN', 'saved uncertain decision is never regraded as wrong');
  const review = renderToStaticMarkup(React.createElement(AnswerReviewPage, { skill, itemResults: items, onBack: () => {} }));
  assert.match(review, /Back to summary/);
  assert.match(review, /Incorrect/);
  assert.match(review, /No answer given/);
  assert.match(review, /Pending review/);
  assert.match(review, /Stevenson/);
  assert.match(review, /B · 1924/);
  assert.match(review, /C · 1926/);
  assert.match(review, /Your answer/);
  assert.match(review, /Correct answer/);
  assert.equal(JSON.stringify(result), original, 'review leaves the saved score and verdicts unchanged');
  assert.equal(summary(), before, 'returning to summary retains the exact score and feedback');
  console.log(`✓ ${skill}: summary Review button, saved verdicts, wrong/skipped/pending rows, option meanings, unchanged summary`);
}
const legacy = { answers: { q1: 'C', q2: '', q3: 'wrong', q4: 'October' } };
const reconstructed = buildAnswerReviewItems(legacy, { sections: [{ questions }] }, 'listening');
assert.equal(reconstructed.q1.finalResult, 'CORRECT', 'empty accepted-answer list falls back to the official key');
assert.equal(reconstructed.q2.candidateAnswer, '');
assert.equal(reconstructed.q3.finalResult, 'INCORRECT');
assert.deepEqual(buildAnswerReviewItems({ band: 5 }, { parts: [{ questions }] }, 'listening'), {}, 'aggregate scores never invent past answers');
console.log('✓ legacy: deterministic answer-sheet recovery and honest unavailable details for aggregate-only history');
