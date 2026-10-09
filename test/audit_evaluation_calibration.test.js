/**
 * Comprehensive IELTS Evaluation System Audit & Calibration Test Suite
 *
 * Validates calibrated examination judgment, descriptor fidelity (Bands 1–9),
 * independent criteria assessment, transcript-only speaking honesty,
 * hybrid objective-answer verification, pipeline error handling, and stability.
 */
import assert from 'node:assert/strict';
import {
  roundIeltsBand, countWords, normalizeWritingEvaluation, normalizeSpeakingEvaluation,
  buildWritingUserPrompt, buildSpeakingUserPrompt, buildAnswerVerifierUserPrompt,
  ANSWER_VERIFIER_SYSTEM_PROMPT, WRITING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_V2
} from '../src/utils/ieltsRubric.js';
import {
  evaluateDeterministic, officialAnswerVariants, DETERMINISTIC, calculateOverallBand,
  calculateListeningBand, calculateReadingBand, stripLeadingArticle, differByArticle, parseWordLimit
} from '../src/utils/bandCalculator.js';
import {
  isCandidateAnswerCorrect, alignUnorderedAnswers, evaluateFullMockExam,
  evaluateReadingResponses, evaluateListeningResponses
} from '../src/utils/evaluation/evaluationEngine.js';

let passed = 0;
let failed = 0;

function test(category, name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [${category}] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL [${category}] ${name}:`, err.message);
  }
}

async function asyncTest(category, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ [${category}] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ FAIL [${category}] ${name}:`, err.message);
  }
}

const crit = (band, evidence = 'Sample quote', rationale = 'Descriptor match', improvementFocus = 'Next step') => ({
  band, evidence, rationale, improvementFocus
});

const sampleWriting = ({ t1, t2, t1Extra = {}, t2Extra = {}, confidence = 'high' }) => ({
  task1: {
    criteria: {
      taskAchievement: crit(t1[0]),
      coherenceAndCohesion: crit(t1[1]),
      lexicalResource: crit(t1[2]),
      grammaticalRangeAndAccuracy: crit(t1[3])
    },
    hasOverview: true,
    overviewStatus: 'clear_and_relevant',
    feedback: 'Task 1 Examiner feedback',
    ...t1Extra
  },
  task2: {
    criteria: {
      taskResponse: crit(t2[0]),
      coherenceAndCohesion: crit(t2[1]),
      lexicalResource: crit(t2[2]),
      grammaticalRangeAndAccuracy: crit(t2[3])
    },
    positionClear: true,
    feedback: 'Task 2 Examiner feedback',
    ...t2Extra
  },
  overallSummary: 'Overall writing evaluation summary',
  strengths: 'Demonstrated strengths',
  areasForImprovement: 'Key improvement areas',
  confidence
});

console.log('============================================================');
console.log('IELTS EVALUATION SYSTEM: CALIBRATION & REGRESSION AUDIT');
console.log('============================================================\n');

// ─────────────────────────────────────────────────────────────
// 1. WRITING EVALUATION CALIBRATION
// ─────────────────────────────────────────────────────────────
console.log('--- 1. WRITING EVALUATION CALIBRATION ---');

test('WRITING', '1. Strong response with minor errors (Band 8 profile)', () => {
  const raw = sampleWriting({ t1: [8, 8, 8, 8], t2: [8, 8, 8, 8] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 190, task2Words: 295 });
  assert.equal(res.task1Band, 8);
  assert.equal(res.task2Band, 8);
  assert.equal(res.overallBand, 8.0);
  assert.equal(res.criteria.taskAchievement.band, 8);
});

test('WRITING', '2. Genuinely weak response with frequent errors (Band 3–4 profile)', () => {
  const raw = sampleWriting({ t1: [3, 4, 3, 3], t2: [4, 4, 3, 4] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 110, task2Words: 180 });
  assert.equal(res.task1Band, 3.5); // mean(3,4,3,3) = 3.25 -> 3.5
  assert.equal(res.task2Band, 4.0); // mean(4,4,3,4) = 3.75 -> 4.0
  // overall: (3.25 + 2 * 3.75) / 3 = 10.75 / 3 = 3.583 -> 3.5
  assert.equal(res.overallBand, 3.5);
});

test('WRITING', '3. Borderline response between adjacent bands', () => {
  // Task 1: 6.0, Task 2: 7.0 -> (6 + 2*7)/3 = 20/3 = 6.666 -> rounds to 6.5
  const raw1 = sampleWriting({ t1: [6, 6, 6, 6], t2: [7, 7, 7, 7] });
  const res1 = normalizeWritingEvaluation(raw1, { task1Words: 160, task2Words: 260 });
  assert.equal(res1.overallBand, 6.5);

  // Task 1: 7.0, Task 2: 7.0 -> (7 + 14)/3 = 7.0
  const raw2 = sampleWriting({ t1: [7, 7, 7, 7], t2: [7, 7, 7, 7] });
  const res2 = normalizeWritingEvaluation(raw2, { task1Words: 160, task2Words: 260 });
  assert.equal(res2.overallBand, 7.0);
});

test('WRITING', '4. Task 1 response with a clear overview (TA not capped)', () => {
  const raw = sampleWriting({
    t1: [7, 7, 7, 7],
    t2: [7, 7, 7, 7],
    t1Extra: { hasOverview: true, overviewStatus: 'clear_and_relevant' }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 175, task2Words: 280 });
  assert.equal(res.taskCriteria.task1.taskAchievement.band, 7);
  assert.equal(res.task1Band, 7.0);
  assert.equal(res.hasOverview, true);
  assert.equal(res.overviewStatus, 'clear_and_relevant');
});

test('WRITING', '5. Task 1 response with no meaningful overview (capped at Band 5 TA)', () => {
  const raw = sampleWriting({
    t1: [8, 7, 7, 7],
    t2: [7, 7, 7, 7],
    t1Extra: { hasOverview: false, overviewStatus: 'absent' }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 170, task2Words: 280 });
  assert.equal(res.taskCriteria.task1.taskAchievement.band, 5); // Capped from 8 to 5
  assert.ok(res.scoringNotes.some(n => n.includes('capped at Band 5')));
  assert.equal(res.hasOverview, false);
});

test('WRITING', '6. Task 1 response containing inaccurate figures (evidence preserved)', () => {
  const raw = sampleWriting({
    t1: [5, 6, 6, 6],
    t2: [6, 6, 6, 6],
    t1Extra: {
      criteria: {
        taskAchievement: crit(5, 'Inaccurate reported value 75% instead of 25%', 'Factual inaccuracy in key feature', 'Verify figures against chart'),
        coherenceAndCohesion: crit(6),
        lexicalResource: crit(6),
        grammaticalRangeAndAccuracy: crit(6)
      }
    }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 155, task2Words: 260 });
  assert.equal(res.taskCriteria.task1.taskAchievement.band, 5);
  assert.ok(res.taskCriteria.task1.taskAchievement.evidence.includes('Inaccurate reported value'));
});

test('WRITING', '7. Task 2 response that addresses every part of the question', () => {
  const raw = sampleWriting({
    t1: [7, 7, 7, 7],
    t2: [8, 7, 7, 7],
    t2Extra: { positionClear: true }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 165, task2Words: 310 });
  assert.equal(res.taskCriteria.task2.taskResponse.band, 8);
  assert.equal(res.positionClear, true);
});

test('WRITING', '8. Task 2 response that misses an important prompt part (TR limited)', () => {
  const raw = sampleWriting({
    t1: [7, 7, 7, 7],
    t2: [5, 7, 7, 7], // TR is limited to 5 due to missing prompt element
    t2Extra: {
      criteria: {
        taskResponse: crit(5, 'Only discussed advantages, ignored requested second prompt part on disadvantages', 'Addresses task only partially', 'Fully answer both parts of two-part question'),
        coherenceAndCohesion: crit(7),
        lexicalResource: crit(7),
        grammaticalRangeAndAccuracy: crit(7)
      }
    }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 260 });
  assert.equal(res.taskCriteria.task2.taskResponse.band, 5);
  // Other criteria remain high (independent criteria principle)
  assert.equal(res.taskCriteria.task2.grammaticalRangeAndAccuracy.band, 7);
});

test('WRITING', '9. Response with sophisticated but unnatural vocabulary (LR differentiated)', () => {
  const raw = sampleWriting({
    t1: [7, 7, 6, 7],
    t2: [7, 7, 6, 7],
    t2Extra: {
      criteria: {
        taskResponse: crit(7),
        coherenceAndCohesion: crit(7),
        lexicalResource: crit(6, 'Used "invidious calamity" unnaturally for simple problem', 'Unnatural collocation and style strain', 'Prefer natural, precise academic phrasing'),
        grammaticalRangeAndAccuracy: crit(7)
      }
    }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 270 });
  assert.equal(res.taskCriteria.task2.lexicalResource.band, 6);
  assert.equal(res.taskCriteria.task2.grammaticalRangeAndAccuracy.band, 7);
});

test('WRITING', '10. Clear organisation but few overt linking expressions (CC not unfairly penalised)', () => {
  const raw = sampleWriting({
    t1: [7, 7, 7, 7],
    t2: [7, 7, 7, 7],
    t2Extra: {
      criteria: {
        taskResponse: crit(7),
        coherenceAndCohesion: crit(7, 'Natural thematic progression between paragraphs without mechanical transition formula', 'Clear progression and central topic per paragraph', 'Maintain variety in cohesive referencing'),
        lexicalResource: crit(7),
        grammaticalRangeAndAccuracy: crit(7)
      }
    }
  });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 265 });
  assert.equal(res.taskCriteria.task2.coherenceAndCohesion.band, 7);
});

test('WRITING', '11. Under-length response evaluated by descriptors without artificial deduction', () => {
  // Candidate wrote 130 words in T1 and 220 words in T2; examiner assigned Band 6 based on actual development
  const raw = sampleWriting({ t1: [6, 6, 6, 6], t2: [6, 6, 6, 6] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 130, task2Words: 220 });
  assert.equal(res.task1Band, 6);
  assert.equal(res.task2Band, 6);
  assert.equal(res.overallBand, 6);
});

test('WRITING', '12. Extremely short response (≤20 words rated Band 1 per official 2023 descriptors)', () => {
  // 18 words produced: official 2023 IELTS descriptor assigns Band 1 to all criteria for ≤20 words.
  // Task 2 has 25 words (>20 words), evaluated on descriptor merits (Band 2).
  const raw = sampleWriting({ t1: [2, 2, 2, 2], t2: [2, 2, 2, 2] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 18, task2Words: 25 });
  assert.equal(res.task1Band, 1); // Task 1 (18 words) is Band 1 per official rule
  assert.equal(res.task2Band, 2); // Task 2 (25 words) evaluates descriptor evidence
  assert.equal(res.overallBand, 1.5); // Weighted: (1 + 2*2)/3 = 5/3 = 1.666... rounds to 1.5
  assert.ok(res.scoringNotes.some(n => n.includes('20 words or fewer: rated Band 1')));
});

test('WRITING', '13. Strong grammar but weak task fulfilment (independent criteria)', () => {
  const raw = sampleWriting({ t1: [4, 6, 7, 8], t2: [4, 6, 7, 8] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 270 });
  assert.equal(res.taskCriteria.task2.taskResponse.band, 4);
  assert.equal(res.taskCriteria.task2.grammaticalRangeAndAccuracy.band, 8);
});

test('WRITING', '14. Strong ideas but significant language errors (independent criteria)', () => {
  const raw = sampleWriting({ t1: [8, 7, 5, 4], t2: [8, 7, 5, 4] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 170, task2Words: 280 });
  assert.equal(res.taskCriteria.task2.taskResponse.band, 8);
  assert.equal(res.taskCriteria.task2.grammaticalRangeAndAccuracy.band, 4);
});

test('WRITING', '15. Missing task (unsubmitted task is strictly Band 0)', () => {
  const raw = sampleWriting({ t1: [7, 7, 7, 7], t2: [7, 7, 7, 7] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 170, task2Words: 0 });
  assert.equal(res.task1Band, 7.0);
  assert.equal(res.task2Band, 0); // Task 2 unsubmitted
  // (7 + 2 * 0) / 3 = 2.33 -> 2.5
  assert.equal(res.overallBand, 2.5);
  assert.equal(res.taskCriteria.task2.taskResponse.band, 0);
});

// ─────────────────────────────────────────────────────────────
// 2. SPEAKING EVALUATION CALIBRATION
// ─────────────────────────────────────────────────────────────
console.log('\n--- 2. SPEAKING EVALUATION CALIBRATION ---');

const sampleSpeaking = (fc, lr, gra, pr = null) => ({
  criteria: {
    fluencyAndCoherence: crit(fc, 'Speaks at length', 'Coherent flow', 'Connectives'),
    lexicalResource: crit(lr, 'Precise vocabulary', 'Varied range', 'Collocations'),
    grammaticalRangeAndAccuracy: crit(gra, 'Complex clauses', 'High accuracy', 'Variety'),
    pronunciation: pr === null
      ? { status: 'not_assessed', band: null, evidence: '', rationale: 'Pronunciation requires audio.', improvementFocus: 'Practice rhythm' }
      : { status: 'assessed', band: pr, evidence: 'Clear intonation', rationale: 'Intelligible phonemes', improvementFocus: 'Stress patterns' }
  },
  partFeedback: { part1: 'Clear', part2: 'Sustained', part3: 'Nuanced' },
  overallSummary: 'Speaking summary',
  strengths: 'Fluency',
  areasForImprovement: 'Vocabulary precision',
  confidence: 'high'
});

test('SPEAKING', '1. Strong transcript with varied vocabulary and accurate grammar (Band 8)', () => {
  const raw = sampleSpeaking(8, 8, 8);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.fluencyAndCoherence.band, 8);
  assert.equal(res.criteria.lexicalResource.band, 8);
  assert.equal(res.criteria.grammaticalRangeAndAccuracy.band, 8);
  assert.equal(res.overallBand, 8.0);
  assert.equal(res.provisional, true);
});

test('SPEAKING', '2. Weak transcript with persistent language problems (Band 4)', () => {
  const raw = sampleSpeaking(4, 4, 4);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.overallBand, 4.0);
  assert.equal(res.provisional, true);
});

test('SPEAKING', '3. Coherent transcript whose audio is unavailable (pronunciation null, provisional)', () => {
  const raw = sampleSpeaking(7, 7, 7);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.pronunciation.status, 'not_assessed');
  assert.equal(res.criteria.pronunciation.band, null);
  assert.equal(res.provisional, true);
  assert.equal(res.overallBand, 7.0);
});

test('SPEAKING', '4. Very short Part 2 answer (FC limited, grammar/vocab independent)', () => {
  // Candidate spoke only 30s in Part 2: FC is 5, but LR is 7 and GRA is 7
  const raw = sampleSpeaking(5, 7, 7);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.fluencyAndCoherence.band, 5);
  assert.equal(res.criteria.lexicalResource.band, 7);
  assert.equal(res.criteria.grammaticalRangeAndAccuracy.band, 7);
  // mean(5, 7, 7) = 19/3 = 6.33 -> 6.5
  assert.equal(res.overallBand, 6.5);
});

test('SPEAKING', '5. Truncated or incomplete transcript handling', () => {
  const raw = sampleSpeaking(5, 5, 5);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.overallBand, 5.0);
  assert.equal(res.provisional, true);
});

test('SPEAKING', '6. Transcript containing STT artefacts (model does not penalise)', () => {
  // Evidence cites genuine vocabulary while noting STT homophones are ignored
  const raw = {
    ...sampleSpeaking(7, 7, 7),
    criteria: {
      ...sampleSpeaking(7, 7, 7).criteria,
      lexicalResource: crit(7, 'Effective topic vocabulary used; transcript "there" vs "their" treated as STT artifact', 'Good range with natural paraphrase', 'Develop idiomatic expressions')
    }
  };
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.lexicalResource.band, 7);
});

test('SPEAKING', '7. Response with repeated but relevant ideas', () => {
  const raw = sampleSpeaking(6, 6, 6);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.overallBand, 6.0);
});

test('SPEAKING', '8. Response that does not address question', () => {
  const raw = sampleSpeaking(4, 6, 6);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.fluencyAndCoherence.band, 4);
  assert.equal(res.criteria.lexicalResource.band, 6);
});

test('SPEAKING', '9. Assessment where pronunciation must remain unassessed', () => {
  // Even if model accidentally supplied a pronunciation band, audioAssessed: false strips it
  const raw = sampleSpeaking(7, 7, 7, 8);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: false });
  assert.equal(res.criteria.pronunciation.status, 'not_assessed');
  assert.equal(res.criteria.pronunciation.band, null);
  assert.equal(res.provisional, true);
});

test('SPEAKING', '10. Assessment with actual audio-derived evidence', () => {
  const raw = sampleSpeaking(7, 7, 7, 7);
  const res = normalizeSpeakingEvaluation(raw, { audioAssessed: true });
  assert.equal(res.criteria.pronunciation.status, 'assessed');
  assert.equal(res.criteria.pronunciation.band, 7);
  assert.equal(res.provisional, false);
  assert.equal(res.overallBand, 7.0);
});

// ─────────────────────────────────────────────────────────────
// 3. LISTENING AND READING ANSWER VERIFICATION
// ─────────────────────────────────────────────────────────────
console.log('\n--- 3. LISTENING AND READING ANSWER VERIFICATION ---');

test('VERIFICATION', '1. Exact correct answer (deterministic MATCH)', () => {
  const res = evaluateDeterministic('library', 'library');
  assert.equal(res.result, DETERMINISTIC.MATCH);
  assert.equal(isCandidateAnswerCorrect('library', 'library'), true);
});

test('VERIFICATION', '2. Acceptable alternative spelling format', () => {
  const res = evaluateDeterministic('theatre', 'theater / theatre');
  assert.equal(res.result, DETERMINISTIC.MATCH);
  assert.equal(isCandidateAnswerCorrect('theatre', 'theater / theatre'), true);
});

test('VERIFICATION', '3. Valid date and article variants', () => {
  assert.equal(evaluateDeterministic('a bicycle', 'bicycle').result, DETERMINISTIC.MATCH);
  assert.equal(evaluateDeterministic('bicycle', 'the bicycle').result, DETERMINISTIC.MATCH);
  assert.equal(isCandidateAnswerCorrect('bicycle', 'a bicycle'), true);
});

test('VERIFICATION', '4. Genuinely misspelled answer is MISMATCH', () => {
  const res = evaluateDeterministic('prises', 'prizes');
  assert.equal(res.result, DETERMINISTIC.MISMATCH);
  assert.equal(isCandidateAnswerCorrect('prises', 'prizes'), false);
});

test('VERIFICATION', '5. Missing/blank answer is MISMATCH', () => {
  assert.equal(evaluateDeterministic('', 'prizes').result, DETERMINISTIC.MISMATCH);
  assert.equal(evaluateDeterministic(null, 'prizes').result, DETERMINISTIC.MISMATCH);
  assert.equal(isCandidateAnswerCorrect('', 'prizes'), false);
});

test('VERIFICATION', '6. Semantically related but incorrect answer is MISMATCH', () => {
  const res = evaluateDeterministic('college', 'university');
  assert.equal(res.result, DETERMINISTIC.MISMATCH);
  assert.equal(isCandidateAnswerCorrect('college', 'university'), false);
});

test('VERIFICATION', '7. Meaning-changing time unit is MISMATCH', () => {
  const res = evaluateDeterministic('11 pm', '11 am');
  assert.equal(res.result, DETERMINISTIC.MISMATCH);
});

test('VERIFICATION', '8. Singular vs plural routes to UNCERTAIN for semantic check', () => {
  const res = evaluateDeterministic('beginner', 'Beginners');
  assert.equal(res.result, DETERMINISTIC.UNCERTAIN);
});

test('VERIFICATION', '9. Word-vs-digit number routes to UNCERTAIN for context check', () => {
  const res = evaluateDeterministic('fifteen', '15');
  assert.equal(res.result, DETERMINISTIC.UNCERTAIN);
});

test('VERIFICATION', '10. officialAnswerVariants handles slash alternatives and optional brackets', () => {
  const variants = officialAnswerVariants('11 / eleven (am)');
  assert.ok(variants.includes('11'));
  assert.ok(variants.includes('eleven'));
  assert.ok(variants.includes('eleven am'));
});

test('VERIFICATION', '11. Article handling strictly respects question word limit (e.g. "the gym" vs "gym" under ONE WORD ONLY)', () => {
  // Candidate writes "the gym" (2 words) when instruction is ONE WORD ONLY (limit: 1)
  assert.equal(differByArticle('the gym', 'gym', 1), false);
  assert.equal(differByArticle('the gym', 'gym', 'ONE WORD ONLY'), false);
  assert.equal(stripLeadingArticle('the gym', 1), 'the gym');
  assert.equal(evaluateDeterministic('the gym', 'gym', { wordLimit: 1 }).result, DETERMINISTIC.MISMATCH);
  assert.equal(isCandidateAnswerCorrect('the gym', 'gym', { wordLimit: 1 }), false);
  assert.equal(isCandidateAnswerCorrect('the gym', 'gym', { wordLimit: 'ONE WORD ONLY' }), false);

  // Candidate writes "gym" (1 word) when key is "the gym" under ONE WORD ONLY (limit: 1) -> fits limit
  assert.equal(differByArticle('gym', 'the gym', 1), true);
  assert.equal(evaluateDeterministic('gym', 'the gym', { wordLimit: 1 }).result, DETERMINISTIC.MATCH);
  assert.equal(isCandidateAnswerCorrect('gym', 'the gym', { wordLimit: 1 }), true);

  // When word limit is 2 ("NO MORE THAN TWO WORDS"), "the gym" is 2 words -> fits limit
  assert.equal(differByArticle('the gym', 'gym', 2), true);
  assert.equal(stripLeadingArticle('the gym', 2), 'gym');
  assert.equal(evaluateDeterministic('the gym', 'gym', { wordLimit: 2 }).result, DETERMINISTIC.MATCH);
  assert.equal(isCandidateAnswerCorrect('the gym', 'gym', { wordLimit: 'NO MORE THAN TWO WORDS' }), true);
});

// ─────────────────────────────────────────────────────────────
// 4. PIPELINE INTEGRITY & ROBUSTNESS
// ─────────────────────────────────────────────────────────────
console.log('\n--- 4. PIPELINE INTEGRITY & ROBUSTNESS ---');

test('PIPELINE', '1. Valid evaluator output normalisation', () => {
  const raw = sampleWriting({ t1: [7, 7, 7, 7], t2: [7, 7, 7, 7] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 270 });
  assert.equal(res.overallBand, 7.0);
  assert.equal(res.task1Band, 7.0);
  assert.equal(res.task2Band, 7.0);
  assert.equal(res.confidence, 'high');
});

test('PIPELINE', '2. Malformed JSON returns null (no synthetic score)', () => {
  assert.equal(normalizeWritingEvaluation(null), null);
  assert.equal(normalizeWritingEvaluation('invalid string'), null);
  assert.equal(normalizeWritingEvaluation({ task1: {} }, { task1Words: 160, task2Words: 260 }), null);
  assert.equal(normalizeSpeakingEvaluation({ criteria: { fluencyAndCoherence: null } }), null);
});

test('PIPELINE', '3. Missing criterion fields returns null', () => {
  const incomplete = {
    task1: { criteria: { taskAchievement: crit(6) } }, // missing 3 criteria
    task2: { criteria: { taskResponse: crit(6) } }
  };
  assert.equal(normalizeWritingEvaluation(incomplete, { task1Words: 160, task2Words: 260 }), null);
});

test('PIPELINE', '4. Out-of-range band values clamped properly (0–9)', () => {
  const raw = sampleWriting({ t1: [11, 7, 7, 7], t2: [7, 7, 7, 7] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 260 });
  // Band 11 is clamped to 9
  assert.equal(res.taskCriteria.task1.taskAchievement.band, 9);
});

test('PIPELINE', '5. Half-band criterion outputs rounded to integer criteria per IELTS rules', () => {
  const raw = sampleWriting({ t1: [6.5, 6, 6, 6], t2: [7, 7, 7, 6.5] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 160, task2Words: 260 });
  assert.equal(res.taskCriteria.task1.taskAchievement.band, 7); // 6.5 rounded to 7
  assert.equal(res.taskCriteria.task2.grammaticalRangeAndAccuracy.band, 7); // 6.5 rounded to 7
});

test('PIPELINE', '6. Stability: repeated evaluation of identical inputs produces identical scores', () => {
  const raw = sampleWriting({ t1: [6, 7, 6, 7], t2: [7, 7, 7, 7] });
  const res1 = normalizeWritingEvaluation(raw, { task1Words: 165, task2Words: 275 });
  const res2 = normalizeWritingEvaluation(raw, { task1Words: 165, task2Words: 275 });
  assert.deepEqual(res1.overallBand, res2.overallBand);
  assert.deepEqual(res1.task1Band, res2.task1Band);
  assert.deepEqual(res1.task2Band, res2.task2Band);
  assert.deepEqual(res1.criteria, res2.criteria);
});

test('PIPELINE', '7. Overall band calculation strictly requires all 4 skills', () => {
  assert.equal(calculateOverallBand(7.0, 7.0, 7.0, 7.0), 7.0);
  assert.equal(calculateOverallBand(6.5, 7.0, 7.5, 8.0), 7.5); // avg 7.25 -> 7.5
  assert.equal(calculateOverallBand(6.5, 6.5, 6.5, 7.0), 6.5); // avg 6.625 -> 6.5
  assert.equal(calculateOverallBand(6.5, 6.5, 7.0, 7.0), 7.0); // avg 6.75 -> 7.0
  assert.equal(calculateOverallBand(7.0, null, 7.0, 7.0), null);
  assert.equal(calculateOverallBand(7.0, 7.0, null, 7.0), null);
});

test('PIPELINE', '8. Reading and Listening raw-to-band conversions follow Cambridge standards', () => {
  assert.equal(calculateReadingBand(40), 9.0);
  assert.equal(calculateReadingBand(30), 7.0);
  assert.equal(calculateReadingBand(23), 6.0);
  assert.equal(calculateReadingBand(15), 5.0);
  assert.equal(calculateReadingBand(0), 0.0);

  assert.equal(calculateListeningBand(40), 9.0);
  assert.equal(calculateListeningBand(30), 7.0);
  assert.equal(calculateListeningBand(23), 6.0);
  assert.equal(calculateListeningBand(16), 5.0);
  assert.equal(calculateListeningBand(0), 0.0);
});

test('PIPELINE', '9. Unordered multi-select letters aligned order-independently', () => {
  const questions = [
    { id: 'q1', unorderedGroup: 'grpA', answer: 'B' },
    { id: 'q2', unorderedGroup: 'grpA', answer: 'D' }
  ];
  const answers = { q1: 'D', q2: 'B' };
  const aligned = alignUnorderedAnswers(questions, answers);
  assert.equal(aligned.q1, 'B');
  assert.equal(aligned.q2, 'D');
});

test('PIPELINE', '10. Official IELTS overall band rounding on all mathematical eighth boundaries (.000, .125, .250, .375, .500, .625, .750, .875)', () => {
  // .000: 6.0, 6.0, 6.0, 6.0 -> 24/4 = 6.000 -> 6.0
  assert.equal(calculateOverallBand(6.0, 6.0, 6.0, 6.0), 6.0);
  assert.equal(roundIeltsBand(6.0), 6.0);

  // .125: 6.5, 6.0, 6.0, 6.0 -> 24.5/4 = 6.125 -> rounds down to 6.0
  assert.equal(calculateOverallBand(6.5, 6.0, 6.0, 6.0), 6.0);
  assert.equal(roundIeltsBand(6.125), 6.0);

  // .250: 6.5, 6.5, 6.0, 6.0 -> 25.0/4 = 6.250 -> rounds up to 6.5
  assert.equal(calculateOverallBand(6.5, 6.5, 6.0, 6.0), 6.5);
  assert.equal(roundIeltsBand(6.25), 6.5);

  // .375: 6.5, 6.5, 6.5, 6.0 -> 25.5/4 = 6.375 -> rounds up to 6.5
  assert.equal(calculateOverallBand(6.5, 6.5, 6.5, 6.0), 6.5);
  assert.equal(roundIeltsBand(6.375), 6.5);

  // .500: 6.5, 6.5, 6.5, 6.5 -> 26.0/4 = 6.500 -> 6.5
  assert.equal(calculateOverallBand(6.5, 6.5, 6.5, 6.5), 6.5);
  assert.equal(roundIeltsBand(6.5), 6.5);

  // .625: 7.0, 6.5, 6.5, 6.5 -> 26.5/4 = 6.625 -> rounds down to 6.5
  assert.equal(calculateOverallBand(7.0, 6.5, 6.5, 6.5), 6.5);
  assert.equal(roundIeltsBand(6.625), 6.5);

  // .750: 7.0, 7.0, 6.5, 6.5 -> 27.0/4 = 6.750 -> rounds up to 7.0
  assert.equal(calculateOverallBand(7.0, 7.0, 6.5, 6.5), 7.0);
  assert.equal(roundIeltsBand(6.75), 7.0);

  // .875: 7.0, 7.0, 7.0, 6.5 -> 27.5/4 = 6.875 -> rounds up to 7.0
  assert.equal(calculateOverallBand(7.0, 7.0, 7.0, 6.5), 7.0);
  assert.equal(roundIeltsBand(6.875), 7.0);
});

test('PIPELINE', '11. Writing overall calculation preserves exact task fractions without premature intermediate rounding', () => {
  // Task 1: 6, 6, 6, 7 -> unrounded mean = 6.25 (would round to 6.5 if isolated)
  // Task 2: 7, 7, 7, 6 -> unrounded mean = 6.75 (would round to 7.0 if isolated)
  // Official unrounded combination: (6.25 + 2 * 6.75) / 3 = 19.75 / 3 = 6.5833... -> rounds to 6.5
  // Premature intermediate rounding would give: (6.5 + 2 * 7.0) / 3 = 20.5 / 3 = 6.8333... -> 7.0 (half-band inflation)
  const raw = sampleWriting({ t1: [6, 6, 6, 7], t2: [7, 7, 7, 6] });
  const res = normalizeWritingEvaluation(raw, { task1Words: 165, task2Words: 275 });
  assert.equal(res.task1Band, 6.5);
  assert.equal(res.task2Band, 7.0);
  assert.equal(res.overallBand, 6.5);
});

await asyncTest('PIPELINE', '12. Reading & Listening evaluation returns explicit provisional ranges for unresolved items', async () => {
  const passages = [{
    id: 'p1',
    title: 'Test Passage',
    questions: [
      { id: 'q1', answer: 'library', questionType: 'sentence_completion' },
      { id: 'q2', answer: 'Beginners', questionType: 'sentence_completion' }
    ]
  }];
  const answers = {
    q1: 'library',
    q2: 'beginner'
  };
  const res = await evaluateReadingResponses({ passages, answers, attemptId: 'test-run' });
  assert.equal(res.raw, 1);
  assert.equal(res.rawMin, 1);
  assert.equal(res.rawMax, 2);
  assert.equal(res.hasUnresolved, true);
  assert.equal(res.unresolvedCount, 1);
  assert.equal(res.isProvisional, true);
  assert.ok(res.scoreRange);
  assert.equal(res.scoreRange.rawMin, 1);
  assert.equal(res.scoreRange.rawMax, 2);
  assert.equal(res.itemResults.q2.finalResult, 'UNCERTAIN');
  assert.equal(res.itemResults.q2.unresolved, true);
});

console.log('\n============================================================');
console.log(`ALL AUDIT TESTS COMPLETED: ${passed} passed, ${failed} failed`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}
