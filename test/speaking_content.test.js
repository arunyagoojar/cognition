/**
 * Production Speaking contract tests — every package follows the IELTS format
 * and is labelled honestly.
 */
import assert from 'node:assert/strict';
import { PRODUCTION_SPEAKING } from '../src/data/production/productionContent.js';
import { adaptProductionSpeaking } from '../src/data/production/adapters.js';

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}
const ARTIFACT = /<[a-z/][^>]*>|&[a-z]+;|␦|�|Show Answers|undefined|null/i;
const clean = (s) => typeof s === 'string' && s.trim().length > 2 && !ARTIFACT.test(s);

console.log('== Production Speaking ==');
t(`${PRODUCTION_SPEAKING.length} packages (≥175)`, () => assert.ok(PRODUCTION_SPEAKING.length >= 175));

t('Part 1: 3 familiar topics × 4 questions, never the Part 2 topic', () => {
  for (const p of PRODUCTION_SPEAKING) {
    const topics = p.part1.topics;
    assert.equal(topics.length, 3, p.slug);
    assert.equal(new Set(topics.map(x => x.topic)).size, 3, `${p.slug} distinct topics`);
    for (const x of topics) {
      assert.equal(x.questions.length, 4, `${p.slug} ${x.topic}`);
      for (const q of x.questions) assert.ok(clean(q) && q.trim().endsWith('?'), `${p.slug} part1 "${q}"`);
    }
  }
});

t('Part 2: source topic, 3–4 prompts, an "and explain" line', () => {
  for (const p of PRODUCTION_SPEAKING) {
    assert.ok(clean(p.cueCard.topic), p.slug);
    assert.ok(p.cueCard.bulletPrompts.length >= 3 && p.cueCard.bulletPrompts.length <= 4, p.slug);
    for (const b of p.cueCard.bulletPrompts) assert.ok(clean(b), `${p.slug} prompt "${b}"`);
    assert.ok(/^and explain\b/.test(p.cueCard.finalInstruction), p.slug);
  }
});

t('cue-card prompts are tailored: no two cards share the same prompts', () => {
  const seen = new Map();
  for (const p of PRODUCTION_SPEAKING) {
    const k = JSON.stringify(p.cueCard.bulletPrompts);
    assert.ok(!seen.has(k), `${p.slug} repeats ${seen.get(k)}`);
    seen.set(k, p.slug);
  }
});

t('Part 3: 2 discussion themes × 3 questions', () => {
  for (const p of PRODUCTION_SPEAKING) {
    assert.equal(p.part3.themes.length, 2, p.slug);
    for (const th of p.part3.themes) {
      assert.ok(clean(th.theme), p.slug);
      assert.equal(th.questions.length, 3, `${p.slug} ${th.theme}`);
      for (const q of th.questions) assert.ok(clean(q) && q.trim().endsWith('?'), `${p.slug} part3 "${q}"`);
    }
  }
});

t('provenance is per part and never claims official/authentic material', () => {
  for (const p of PRODUCTION_SPEAKING) {
    assert.deepEqual(p.provenance, { part1: 'COGNITION_AUTHORED_PRACTICE', part2Topic: 'SOURCE_PRACTICE_TOPIC',
      part2Prompts: 'COGNITION_AUTHORED_PRACTICE', part3: 'COGNITION_AUTHORED_PRACTICE' }, p.slug);
    assert.ok(!/official|authentic/i.test(JSON.stringify(p.provenance) + JSON.stringify(p.coverage)), p.slug);
  }
});

t('the adapter serves a 3-part interview with a topic label per question', () => {
  for (const pkg of PRODUCTION_SPEAKING) {
    const a = adaptProductionSpeaking(pkg);
    assert.deepEqual(a.parts.map(x => x.partNumber), [1, 2, 3], pkg.slug);
    const [p1, , p3] = a.parts;
    assert.equal(p1.questions.length, 12); assert.equal(p1.questionTopics.length, 12);
    assert.equal(p3.questions.length, 6); assert.equal(p3.questionTopics.length, 6);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
