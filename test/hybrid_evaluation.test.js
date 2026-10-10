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
t('omitted or included leading articles are MATCH in IELTS', () => {
  assert.equal(evaluateDeterministic('bicycle', 'a bicycle').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('a bicycle', 'bicycle').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('the library', 'library').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('appointment', 'an appointment').result, DETERMINISTIC.MATCH);
});
t('slash alternatives: "11" matches "11 / eleven (am)"', () => {
  const r = evaluateDeterministic('11', '11 / eleven (am)');
  assert.equal(r.result, DETERMINISTIC.MATCH);
  assert.equal(r.matchedAnswer, '11');
});
t('parenthetical tail optional: "eleven (am)" variant accepts "eleven" deterministically', () => {
  // "eleven" vs "eleven am" differs by a word — not deterministic-safe → AI
  assert.equal(evaluateDeterministic('eleven', '11 / eleven (am)').result, DETERMINISTIC.MATCH);
});
t('word-vs-digit number → MATCH (same number, different spelling)', () => {
  assert.equal(evaluateDeterministic('eleven', '11').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('twenty-five', '25').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('one hundred and fifty', '150').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('3,000,000', 'Three million/ 3 million').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('twenty five', '35/ thirty five').result === DETERMINISTIC.MATCH, false);
  assert.equal(evaluateDeterministic('seventeen', '70').result === DETERMINISTIC.MATCH, false);
});
t('digit vs word, ordinals, dates, currency, times → MATCH', () => {
  assert.equal(evaluateDeterministic('30', 'thirty').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('third', 'Third/3rd').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('June 8', '8th June').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('the 8th of June', '8th June').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('9 June', '8th June').result === DETERMINISTIC.MATCH, false);
  assert.equal(evaluateDeterministic('25', '£25/ 25 pounds').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('40 percent', '40%').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('9:30am', '9.30 am').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('11am', '11/ eleven (am)').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('6676665497431251', '6676 6654 9743 1251').result, DETERMINISTIC.MATCH);
});
t('a fraction key "1/3" is not split into "1" and "3"', () => {
  assert.equal(evaluateDeterministic('3', 'One third/ 1/3').result === DETERMINISTIC.MATCH, false);
  assert.equal(evaluateDeterministic('1/3', 'One third/ 1/3').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('one third', 'One third/ 1/3').result, DETERMINISTIC.MATCH);
});
t('an added article over the word limit is not accepted', () => {
  assert.equal(evaluateDeterministic('an egg', 'Egg', { wordLimit: 'Write ONE WORD AND/ OR A NUMBER' }).result === DETERMINISTIC.MATCH, false);
  assert.equal(evaluateDeterministic('a bicycle', 'bicycle', { wordLimit: 'NO MORE THAN TWO WORDS' }).result, DETERMINISTIC.MATCH);
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
  assert.deepEqual(v, ['11 / eleven (am)', '11', 'eleven (am)', 'eleven am', 'eleven']);
});
t('parenthesised words are optional even without a slash', () => {
  assert.deepEqual(officialAnswerVariants('ratio (of fuel)'), ['ratio (of fuel)', 'ratio of fuel', 'ratio']);
});
t('an accepted-answer list is expanded element by element', () => {
  assert.deepEqual(officialAnswerVariants(['slow turning', 'slow']), ['slow turning', 'slow']);
});
t('no slash → single variant', () => {
  assert.deepEqual(officialAnswerVariants('Beginners'), ['Beginners']);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
