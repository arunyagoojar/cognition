/**
 * Phase 5 — Hybrid objective-answer evaluation tests.
 * The official answer key stays authoritative; the deterministic tier handles
 * exact + variant matches, plural/number-format differences route to AI.
 */
import assert from 'node:assert/strict';
import { evaluateDeterministic, officialAnswerVariants, DETERMINISTIC } from '../src/utils/bandCalculator.js';

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}

console.log('== Deterministic evaluation tier ==');

t('exact match is MATCH', () => {
  assert.equal(evaluateDeterministic('church', 'church').result, DETERMINISTIC.MATCH);
});
t('case + punctuation differences are MATCH', () => {
  assert.equal(evaluateDeterministic('Queen Street', 'queen street').result, DETERMINISTIC.MATCH);
});
t('slash alternatives: "11" matches "11 / eleven (am)"', () => {
  const r = evaluateDeterministic('11', '11 / eleven (am)');
  assert.equal(r.result, DETERMINISTIC.MATCH);
  assert.equal(r.matchedAnswer, '11');
});
t('parenthetical tail optional: "eleven (am)" variant accepts "eleven am" as UNCERTAIN for AI', () => {
  // "eleven" vs "eleven am" differs by a word — not deterministic-safe → AI
  assert.equal(evaluateDeterministic('eleven', '11 / eleven (am)').result, DETERMINISTIC.UNCERTAIN);
});
t('word-vs-digit number → UNCERTAIN (AI verifies with question context)', () => {
  assert.equal(evaluateDeterministic('eleven', '11').result, DETERMINISTIC.UNCERTAIN);
});
t('digit vs word → UNCERTAIN', () => {
  assert.equal(evaluateDeterministic('30', 'thirty').result, DETERMINISTIC.UNCERTAIN);
});
t('singular vs plural → UNCERTAIN (AI decides with context, never auto-accept)', () => {
  assert.equal(evaluateDeterministic('beginner', 'Beginners').result, DETERMINISTIC.UNCERTAIN);
});
t('plural mismatch direction: "Beginners" vs "beginner" → UNCERTAIN', () => {
  assert.equal(evaluateDeterministic('Beginners', 'beginner').result, DETERMINISTIC.UNCERTAIN);
});
t('am/pm swap is MISMATCH — never accepted', () => {
  assert.equal(evaluateDeterministic('11 pm', '11 am').result, DETERMINISTIC.MISMATCH);
});
t('university vs college is MISMATCH (no synonym auto-accept)', () => {
  assert.equal(evaluateDeterministic('university', 'college').result, DETERMINISTIC.MISMATCH);
});
t('carbon monoxide vs carbon dioxide is MISMATCH', () => {
  assert.equal(evaluateDeterministic('carbon monoxide', 'carbon dioxide').result, DETERMINISTIC.MISMATCH);
});
t('blank answer is MISMATCH without AI', () => {
  assert.equal(evaluateDeterministic('', 'Beginners').result, DETERMINISTIC.MISMATCH);
  assert.equal(evaluateDeterministic(null, '11').result, DETERMINISTIC.MISMATCH);
});
t('obviously different words are MISMATCH', () => {
  assert.equal(evaluateDeterministic('three months', 'three weeks').result, DETERMINISTIC.MISMATCH);
});

console.log('== officialAnswerVariants parsing ==');
t('slash split + parenthetical expansion', () => {
  const v = officialAnswerVariants('11 / eleven (am)');
  assert.deepEqual(v, ['11 / eleven (am)', '11', 'eleven (am)', 'eleven']);
});
t('no slash → single variant', () => {
  assert.deepEqual(officialAnswerVariants('Beginners'), ['Beginners']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
