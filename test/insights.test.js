/**
 * Phase 6 — Dashboard intelligence tests: weakness aggregation,
 * insufficient-data handling, recommendation mapping to REAL content.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deriveWeaknesses, aggregateQuestionTypeAccuracy, deriveResultAnalysis } from '../src/utils/insights.js';
import { resolveRecommendations } from '../src/data/recommendations.js';
import { LEARNING_SKILLS } from '../src/data/learningCatalog.js';
import { TIPS_SKILLS_ORDERED } from '../src/data/tips/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const t = (label, fn) => {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
};

const lessonIds = new Set(LEARNING_SKILLS.flatMap(s => s.lessons.map(l => l.id)));
const tipCategoryIds = new Set(TIPS_SKILLS_ORDERED.flatMap(s => s.categories.map(c => c.id)));

console.log('== Weakness engine ==');

t('insufficient data → no focus areas, sufficientData false', () => {
  const attempts = [{ id: 'a1', status: 'completed', reading: { band: 5.0, itemResults: { q1: { questionType: 'tfng', candidateAnswer: 'x', deterministicCorrect: false } } } }];
  const { focusAreas, sufficientData } = deriveWeaknesses(attempts, 7.5);
  assert.equal(focusAreas.length, 0);
  assert.equal(sufficientData, false);
});

t('repeated weak question type becomes a focus area', () => {
  const itemResults = {};
  for (let i = 1; i <= 8; i++) itemResults['q' + i] = { questionType: 'tfng', candidateAnswer: 'true', deterministicCorrect: i <= 2, finalResult: i <= 2 ? 'CORRECT' : 'INCORRECT' };
  for (let i = 9; i <= 14; i++) itemResults['q' + i] = { questionType: 'mcq_single', candidateAnswer: 'A', deterministicCorrect: true, finalResult: 'CORRECT' };
  const attempts = [
    { id: 'a1', status: 'completed', reading: { band: 5.5, itemResults } },
    { id: 'a2', status: 'completed', reading: { band: 5.5, itemResults } },
  ];
  const { focusAreas } = deriveWeaknesses(attempts, 7.5);
  assert.ok(focusAreas.some(f => f.key === 'reading.tfng'), 'tfng should surface: ' + JSON.stringify(focusAreas.map(f => f.key)));
});

t('strong accuracy does NOT surface a weakness', () => {
  const itemResults = {};
  for (let i = 1; i <= 10; i++) itemResults['q' + i] = { questionType: 'tfng', candidateAnswer: 'true', deterministicCorrect: true, finalResult: 'CORRECT' };
  const attempts = [
    { id: 'a1', status: 'completed', reading: { band: 8.0, itemResults } },
    { id: 'a2', status: 'completed', reading: { band: 8.0, itemResults } },
  ];
  const { focusAreas } = deriveWeaknesses(attempts, 7.5);
  assert.equal(focusAreas.filter(f => f.key === 'reading.tfng').length, 0);
});

t('writing criterion gap becomes a focus area', () => {
  const attempts = [
    { id: 'w1', status: 'completed', writing: { band: 6.5, criteria: {
      taskAchievement: { band: 7.0 }, coherenceAndCohesion: { band: 7.0 },
      lexicalResource: { band: 6.5 }, grammaticalRangeAndAccuracy: { band: 5.5 },
    } } },
    { id: 'w2', status: 'completed', writing: { band: 6.5, criteria: {
      taskAchievement: { band: 7.0 }, coherenceAndCohesion: { band: 7.0 },
      lexicalResource: { band: 6.5 }, grammaticalRangeAndAccuracy: { band: 5.5 },
    } } },
  ];
  const { focusAreas } = deriveWeaknesses(attempts, 7.5);
  assert.ok(focusAreas.some(f => f.key === 'writing.grammaticalRangeAndAccuracy'));
});

t('no attempts → empty focus areas (no fabrication)', () => {
  const { focusAreas, sufficientData } = deriveWeaknesses([], 7.5);
  assert.equal(focusAreas.length, 0);
  assert.equal(sufficientData, false);
});

t('capped at 3 focus areas', () => {
  const itemResults = {};
  let n = 1;
  for (const type of ['tfng', 'mcq_single', 'matching_headings', 'completion']) {
    for (let i = 0; i < 8; i++) itemResults['q' + (n++)] = { questionType: type, candidateAnswer: 'x', deterministicCorrect: false, finalResult: 'INCORRECT' };
  }
  const attempts = [
    { id: 'r1', status: 'completed', reading: { band: 4.5, itemResults } },
    { id: 'r2', status: 'completed', reading: { band: 4.5, itemResults } },
    { id: 'w1', status: 'completed', writing: { band: 5.0, criteria: { taskAchievement: {band: 5.5}, coherenceAndCohesion: {band: 5.5}, lexicalResource: {band: 5.5}, grammaticalRangeAndAccuracy: {band: 4.0} } } },
    { id: 'w2', status: 'completed', writing: { band: 5.0, criteria: { taskAchievement: {band: 5.5}, coherenceAndCohesion: {band: 5.5}, lexicalResource: {band: 5.5}, grammaticalRangeAndAccuracy: {band: 4.0} } } },
  ];
  const { focusAreas } = deriveWeaknesses(attempts, 8.0);
  assert.ok(focusAreas.length <= 3, 'got ' + focusAreas.length);
});

console.log('== Recommendation mapping ==');

t('every mapped lesson id exists in the learning catalog', () => {
  // sweep: resolve every mapping key shape used by the engine
  const keys = [
    'reading.tfng', 'reading.mcq_single', 'reading.completion', 'reading.overall',
    'listening.fill_in_blank', 'listening.mcq_single', 'listening.map_labeling', 'listening.overall',
    'writing.taskAchievement', 'writing.coherenceAndCohesion', 'writing.lexicalResource', 'writing.grammaticalRangeAndAccuracy',
    'speaking.fluencyAndCoherence', 'speaking.lexicalResource', 'speaking.grammaticalRangeAndAccuracy', 'speaking.developing_answers',
  ];
  for (const key of keys) {
    const recs = resolveRecommendations({ key, skill: key.split('.')[0] });
    if (recs?.lesson) assert.ok(lessonIds.has(recs.lesson.id), `${key} → unknown lesson ${recs.lesson.id}`);
    if (recs?.tip) assert.ok(tipCategoryIds.has(recs.tip.categoryId), `${key} → unknown tip category ${recs.tip.categoryId}`);
    if (recs?.practice) assert.ok(['reading','listening','writing','speaking'].includes(recs.practice.view));
  }
});

t('unknown keys fall back to practice-only recommendations', () => {
  const recs = resolveRecommendations({ key: 'reading.something_new', skill: 'reading' });
  assert.ok(recs && recs.practice && recs.practice.view === 'reading');
});

console.log('== Result analysis transforms ==');

t('deriveResultAnalysis aggregates per-type accuracy', () => {
  const record = { reading: { band: 6.0, raw: 5, total: 8, itemResults: {
    q1: { questionType: 'tfng', candidateAnswer: 'x', deterministicCorrect: true },
    q2: { questionType: 'tfng', candidateAnswer: 'x', deterministicCorrect: true },
    q3: { questionType: 'tfng', candidateAnswer: 'x', deterministicCorrect: true },
    q4: { questionType: 'mcq_single', candidateAnswer: 'x', deterministicCorrect: false },
  } } };
  const a = deriveResultAnalysis('reading', record);
  assert.equal(a.perType.length, 2);
  assert.ok(a.strong.some(s => s.startsWith('True / False / Not Given')));
});

t('writing analysis carries criteria + sentence improvements', () => {
  const record = { writing: { band: 6.5, task1Band: 6, task2Band: 7, criteria: {
    taskAchievement: { band: 7 }, coherenceAndCohesion: { band: 6 },
    lexicalResource: { band: 6.5 }, grammaticalRangeAndAccuracy: { band: 6 },
  }, sentenceImprovements: [{ original: 'a', suggestion: 'b', reason: 'r' }] } };
  const a = deriveResultAnalysis('writing', record);
  assert.equal(a.criteria.length, 4);
  assert.equal(a.sentenceImprovements.length, 1);
});

t('speaking pronunciation stays honest (null band reported as unassessed)', () => {
  const record = { speaking: { band: 7.0, criteria: {
    fluencyAndCoherence: { band: 7 }, lexicalResource: { band: 7 },
    grammaticalRangeAndAccuracy: { band: 7 },
    pronunciation: { status: 'insufficient_audio_evidence', band: null },
  } } };
  const a = deriveResultAnalysis('speaking', record);
  assert.equal(a.pronunciation.band, null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
