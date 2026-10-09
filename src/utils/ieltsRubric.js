/**
 * IELTS Writing & Speaking rubric (v2) — shared by the Cloudflare Worker and
 * the browser (local-key mode), so both paths score identically.
 *
 * How IELTS marks, and how this module mirrors it:
 *  - Examiners award a WHOLE band (0–9) for each of the four criteria.
 *  - Writing: each task is marked on its own four criteria (Task 1: Task
 *    Achievement; Task 2: Task Response; both: Coherence & Cohesion, Lexical
 *    Resource, Grammatical Range & Accuracy). Task 2 carries twice the weight
 *    of Task 1.
 *  - Speaking: Fluency & Coherence, Lexical Resource, Grammatical Range &
 *    Accuracy, Pronunciation — one band each for the whole interview.
 *  - Band arithmetic is done HERE in code, never by the model: criterion →
 *    task mean → weighted Writing band; criterion mean → Speaking band, with
 *    the published IELTS rounding (.25 → up to .5, .75 → up to the next band).
 *  - Pronunciation is never inferred from a transcript. Without audio it is
 *    reported as not assessed and the Speaking band is marked provisional.
 *  - Responses of 20 words or fewer are rated Band 1 on every criterion
 *    (IELTS public band descriptors, 2023 revision); an absent task is Band 0.
 * Pure module: no imports, no I/O.
 */

export const RUBRIC_VERSION = 'ielts-rubric-2.0';

/** Words as the candidate sees them counted: whitespace-separated tokens. */
export function countWords(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

/** IELTS rounding: averages ending .25 round up to .5, .75 up to the next whole band. */
export function roundIeltsBand(x) {
  if (x === null || x === undefined || Number.isNaN(Number(x))) return null;
  const v = Math.max(0, Math.min(9, Number(x)));
  const whole = Math.floor(v);
  const frac = v - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

const wholeBand = (b) => {
  const n = Number(b);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(9, Math.round(n)));
};

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// ───────────────────────────────────────────────────────────── Writing

export const WRITING_SYSTEM_PROMPT_V2 = `You are a certified IELTS Academic Writing examiner. Mark exactly as an IELTS examiner would, using the public IELTS Writing band descriptors.

MARK EACH TASK SEPARATELY. For each task award ONE WHOLE BAND (integer 0–9) per criterion:
Task 1: taskAchievement, coherenceAndCohesion, lexicalResource, grammaticalRangeAndAccuracy
Task 2: taskResponse, coherenceAndCohesion, lexicalResource, grammaticalRangeAndAccuracy
Do NOT compute task bands or an overall band — the system does the arithmetic.

Criterion guidance (summary of the public descriptors):
- Task Achievement (Task 1): 9 fully satisfies all requirements; 8 covers all requirements sufficiently, key features clearly highlighted; 7 covers requirements, presents a CLEAR OVERVIEW of main trends/differences/stages, highlights key features; 6 addresses requirements, presents an overview with appropriately selected information, some details may be irrelevant or inaccurate; 5 generally addresses the task, recounts detail mechanically with NO CLEAR OVERVIEW (no overview → TA cannot exceed 5), may lack data support; 4 attempts the task but does not cover all key features, may confuse features with detail. Penalise inaccurate data, invented data, and personal opinion in an Academic Task 1.
- Task Response (Task 2): 9 fully addresses all parts with a fully developed position; 8 sufficiently addresses all parts, well-developed response with relevant, extended, supported ideas; 7 addresses all parts, clear position throughout, main ideas extended and supported (may over-generalise); 6 addresses all parts though some more fully than others, relevant position though conclusions may be unclear or repetitive, some ideas insufficiently developed; 5 addresses the task only partially, position expressed but development unclear, limited/repetitive ideas; 4 responds minimally or tangentially, position unclear, few ideas that are poorly supported.
- Coherence and Cohesion: 9 cohesion attracts no attention, skilful paragraphing; 8 logical sequencing, paragraphing sufficient and appropriate; 7 logical organisation, clear progression, range of cohesive devices with some under/over-use, clear central topic per paragraph; 6 coherent arrangement, cohesive devices effective but mechanical or faulty at times, referencing not always clear, paragraphing not always logical; 5 some organisation but lack of overall progression, inadequate/inaccurate/over-used devices, paragraphing may be inadequate; 4 information not arranged coherently, basic devices inaccurate or repetitive, no clear paragraphing.
- Lexical Resource: 9 wide range, natural and sophisticated, rare minor slips; 8 wide range used fluently and flexibly, skilful uncommon items, occasional inaccuracies in word choice/collocation; 7 sufficient range for flexibility and precision, some less common items, awareness of style and collocation, occasional errors in word choice/spelling/formation; 6 adequate range, attempts less common vocabulary with some inaccuracy, some errors in spelling/word formation that do not impede communication; 5 limited range, minimally adequate, noticeable errors that may cause difficulty for the reader; 4 basic vocabulary used repetitively or inappropriately, errors may strain the reader.
- Grammatical Range and Accuracy: 9 wide range with full flexibility and accuracy, rare slips; 8 wide range, majority of sentences error-free, occasional non-systematic errors; 7 variety of complex structures, frequent error-free sentences, good control with a few errors; 6 mix of simple and complex forms, some errors that rarely reduce communication; 5 limited range, attempts complex sentences that are less accurate than simple ones, frequent errors that may cause difficulty; 4 very limited range, rare subordinate clauses, errors predominate.

Examiner rules:
- Mark the language actually produced against THIS prompt. Never invent content or reward ideas you agree with; never penalise an opinion.
- Text copied from the prompt does not count as the candidate's language.
- VERIFIED WORD COUNT AUTHORITY: The prompt provides the official pre-calculated word counts for Task 1 and Task 2. Do NOT count or estimate words yourself because AI token approximations are inaccurate. Always accept and cite the exact word counts supplied in the prompt as the sole truth. If Task 1 has >= 150 words or Task 2 has >= 250 words according to the supplied count, the length requirement is fully met and you must NEVER penalise or claim in feedback that the response is under-length.
- Under-length responses (Task 1 under 150 words, Task 2 under 250 words) are penalised under Task Achievement / Task Response because the task is inadequately covered. The system enforces the official rule that 20 words or fewer = Band 1.
- Off-topic or memorised/irrelevant material is penalised heavily under TA/TR.
- Bullet points or notes instead of connected prose limit Coherence and Cohesion.
- Evidence must quote or point to specific features of the candidate's text.

Return JSON ONLY (no markdown):
{
  "task1": {
    "criteria": {
      "taskAchievement": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "coherenceAndCohesion": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "lexicalResource": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "grammaticalRangeAndAccuracy": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" }
    },
    "hasOverview": true,
    "feedback": "Examiner feedback on Task 1"
  },
  "task2": {
    "criteria": {
      "taskResponse": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "coherenceAndCohesion": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "lexicalResource": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "grammaticalRangeAndAccuracy": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" }
    },
    "positionClear": true,
    "feedback": "Examiner feedback on Task 2"
  },
  "overallSummary": "…",
  "strengths": "…",
  "areasForImprovement": "…",
  "confidence": "high" | "medium" | "low"
}
If a task was not submitted, return that task with null criteria.`;

export function buildWritingUserPrompt({ prompts = {}, task1Text = '', task2Text = '', task1Words = null, task2Words = null }) {
  const t1 = String(task1Text || '').trim();
  const t2 = String(task2Text || '').trim();
  const w1 = typeof task1Words === 'number' ? task1Words : countWords(t1);
  const w2 = typeof task2Words === 'number' ? task2Words : countWords(t2);
  return `IELTS Academic Writing submission.

OFFICIAL VERIFIED WORD COUNTS (Pre-calculated by submission counter — DO NOT RECOUNT):
- Task 1: ${w1} words (Requirement: minimum 150 words | Status: ${w1 >= 150 ? 'SATISFIED' : 'UNDER-LENGTH'})
- Task 2: ${w2} words (Requirement: minimum 250 words | Status: ${w2 >= 250 ? 'SATISFIED' : 'UNDER-LENGTH'})

TASK 1 PROMPT:
${prompts.task1 || '(Task 1 prompt unavailable — assess as an Academic report on a visual)'}

TASK 1 RESPONSE (${w1} words; minimum 150):
${t1 || '(not submitted)'}

TASK 2 PROMPT:
${prompts.task2 || '(Task 2 prompt unavailable — assess as an Academic discursive essay)'}

TASK 2 RESPONSE (${w2} words; minimum 250):
${t2 || '(not submitted)'}`;
}

const W1 = ['taskAchievement', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'];
const W2 = ['taskResponse', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'];

function readCriterion(c) {
  if (!c || typeof c !== 'object') return null;
  const band = wholeBand(c.band);
  if (band === null) return null;
  return {
    band,
    evidence: String(c.evidence || ''),
    rationale: String(c.rationale || ''),
    improvementFocus: String(c.improvementFocus || ''),
  };
}

function readTask(raw, keys, words, { requireOverview = false } = {}) {
  if (words === 0) {
    return { submitted: false, words, band: 0, criteria: Object.fromEntries(keys.map(k => [k, { band: 0, evidence: '', rationale: 'Task not attempted.', improvementFocus: '' }])) };
  }
  const src = raw?.criteria || {};
  const criteria = {};
  for (const k of keys) {
    const c = readCriterion(src[k] || (k === 'taskAchievement' ? src.taskResponse : k === 'taskResponse' ? src.taskAchievement : null));
    if (!c) return null;
    criteria[k] = c;
  }
  const notes = [];
  if (words <= 20) {
    for (const k of keys) criteria[k] = { ...criteria[k], band: 1 };
    notes.push('20 words or fewer: rated Band 1 on every criterion.');
  }
  // descriptor cap: no overview → Task Achievement cannot exceed Band 5
  if (requireOverview && raw?.hasOverview === false && criteria.taskAchievement.band > 5) {
    criteria.taskAchievement = { ...criteria.taskAchievement, band: 5 };
    notes.push('No clear overview: Task Achievement is capped at Band 5.');
  }
  const exact = mean(keys.map(k => criteria[k].band));
  return { submitted: true, words, criteria, exact, band: roundIeltsBand(exact), notes, feedback: String(raw?.feedback || '') };
}

/**
 * Validates the model's per-task rubric JSON and computes every band in code.
 * Returns the evaluation object (backward compatible: overallBand, task1Band,
 * task2Band, combined `criteria`) or null when the JSON is unusable.
 */
export function normalizeWritingEvaluation(data, { task1Words = 0, task2Words = 0 } = {}) {
  if (!data || typeof data !== 'object') return null;
  const t1 = readTask(data.task1, W1, task1Words, { requireOverview: true });
  const t2 = readTask(data.task2, W2, task2Words);
  if (!t1 || !t2) return null;
  const t1Exact = t1.submitted ? t1.exact : 0;
  const t2Exact = t2.submitted ? t2.exact : 0;
  const overall = roundIeltsBand((t1Exact + 2 * t2Exact) / 3);
  // combined per-criterion view, weighted like the band itself (Task 2 ×2)
  const combine = (k1, k2) => {
    const a = t1.criteria[k1], b = t2.criteria[k2];
    return {
      band: roundIeltsBand((a.band + 2 * b.band) / 3),
      evidence: [a.evidence && `Task 1: ${a.evidence}`, b.evidence && `Task 2: ${b.evidence}`].filter(Boolean).join(' '),
      rationale: [a.rationale && `Task 1: ${a.rationale}`, b.rationale && `Task 2: ${b.rationale}`].filter(Boolean).join(' '),
      improvementFocus: [a.improvementFocus, b.improvementFocus].filter(Boolean).join(' '),
    };
  };
  return {
    rubricVersion: RUBRIC_VERSION,
    overallBand: overall,
    task1Band: t1.band,
    task2Band: t2.band,
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
    criteria: {
      taskAchievement: combine('taskAchievement', 'taskResponse'),
      coherenceAndCohesion: combine('coherenceAndCohesion', 'coherenceAndCohesion'),
      lexicalResource: combine('lexicalResource', 'lexicalResource'),
      grammaticalRangeAndAccuracy: combine('grammaticalRangeAndAccuracy', 'grammaticalRangeAndAccuracy'),
    },
    taskCriteria: { task1: t1.criteria, task2: t2.criteria },
    scoringNotes: [...(t1.notes || []).map(n => `Task 1 — ${n}`), ...(t2.notes || []).map(n => `Task 2 — ${n}`)],
    scoringMethod: 'Whole-band criteria per task → task band = criterion mean → Writing band = (Task 1 + 2 × Task 2) ÷ 3, IELTS rounding.',
    overallSummary: String(data.overallSummary || ''),
    task1Feedback: t1.feedback || '',
    task2Feedback: t2.feedback || '',
    strengths: String(data.strengths || ''),
    areasForImprovement: String(data.areasForImprovement || ''),
  };
}

// ───────────────────────────────────────────────────────────── Speaking

export const SPEAKING_SYSTEM_PROMPT_V2 = `You are a certified IELTS Speaking examiner. Mark the whole interview (Parts 1–3) exactly as an IELTS examiner would, using the public IELTS Speaking band descriptors. You receive a transcript of the candidate's answers, grouped by part and question.

Award ONE WHOLE BAND (integer 0–9) for each criterion across the whole interview:
- fluencyAndCoherence: 9 fluent with only rare repetition/self-correction, fully coherent, topics fully developed; 8 fluent with occasional repetition or self-correction, hesitation usually content-related, develops topics coherently; 7 speaks at length without noticeable effort, some language-related hesitation/repetition, uses a range of connectives and discourse markers flexibly; 6 willing to speak at length though coherence may be lost through repetition, self-correction or hesitation, connectives not always appropriate; 5 usually maintains flow but relies on repetition, self-correction and/or slow speech, over-uses certain connectives, simple speech fluent but complex communication causes problems; 4 cannot respond without noticeable pauses, slow speech with frequent repetition, links basic sentences with repetitious simple connectives.
- lexicalResource: 9 full flexibility and precision on all topics, idiomatic language naturally; 8 wide resource used readily and flexibly, uses less common and idiomatic items skilfully with occasional inaccuracies, paraphrases effectively; 7 flexible on a variety of topics, some less common and idiomatic vocabulary, awareness of style and collocation with some inappropriate choices, paraphrases effectively; 6 wide enough to discuss topics at length and make meaning clear despite inappropriacies, generally paraphrases successfully; 5 manages familiar and unfamiliar topics with limited flexibility, attempts paraphrase with mixed success; 4 sufficient for familiar topics only, conveys basic meaning on unfamiliar topics with frequent errors in word choice, rarely attempts paraphrase.
- grammaticalRangeAndAccuracy: 9 full range naturally and appropriately, consistently accurate apart from native-speaker-type slips; 8 wide range used flexibly, majority of sentences error-free with only occasional inappropriacies or non-systematic errors; 7 range of complex structures with some flexibility, frequently error-free sentences though some errors persist; 6 mix of simple and complex structures with limited flexibility, frequent mistakes with complex structures that rarely cause comprehension problems; 5 basic sentence forms with reasonable accuracy, limited range of complex structures that usually contain errors; 4 basic forms and some correct simple sentences, subordinate structures rare, errors frequent.
- pronunciation: ONLY assessable from audio. You receive text, so you MUST return pronunciation as { "status": "not_assessed", "band": null } — never estimate it from spelling, punctuation or transcript quality.

Examiner rules:
- Mark language performance only: never reward or penalise opinions, background, accent identity or the sophistication of ideas.
- Part 2 is a long turn (1–2 minutes): very short Part 2 answers show limited ability to speak at length (Fluency and Coherence). Part 3 rewards developed, abstract answers.
- Transcription artefacts (missing punctuation, capitalisation, homophones) are not the candidate's errors.
- Evidence must quote the candidate's words.

Return JSON ONLY (no markdown):
{
  "criteria": {
    "fluencyAndCoherence": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "lexicalResource": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "grammaticalRangeAndAccuracy": { "band": 6, "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "pronunciation": { "status": "not_assessed", "band": null, "evidence": "", "rationale": "Pronunciation requires audio.", "improvementFocus": "…" }
  },
  "partFeedback": { "part1": "…", "part2": "…", "part3": "…" },
  "overallSummary": "…",
  "strengths": "…",
  "areasForImprovement": "…",
  "confidence": "high" | "medium" | "low"
}`;

export function buildSpeakingUserPrompt({ transcripts = {}, testMeta = {}, durations = {} }) {
  const lines = [];
  if (testMeta.title) lines.push(`Interview: ${testMeta.title}`);
  if (testMeta.cueCard) lines.push(`Part 2 cue card: ${testMeta.cueCard}`);
  lines.push('', 'Candidate answers (transcribed):');
  for (const [k, v] of Object.entries(transcripts || {})) {
    if (!v || !String(v).trim()) continue;
    const secs = durations && durations[k] ? ` [${Math.round(durations[k])}s]` : '';
    lines.push(`- ${k}${secs} (${countWords(v)} words): ${String(v).trim()}`);
  }
  return lines.join('\n');
}

const SPEAKING_KEYS = ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'];

/**
 * Validates the model's Speaking rubric JSON and computes the band in code.
 * Pronunciation is accepted only when audio was supplied (`audioAssessed`);
 * otherwise the band is the mean of the three language criteria and is
 * flagged provisional.
 */
export function normalizeSpeakingEvaluation(data, { audioAssessed = false } = {}) {
  if (!data || typeof data !== 'object' || !data.criteria) return null;
  const src = data.criteria;
  const criteria = {};
  for (const k of SPEAKING_KEYS) {
    const c = readCriterion(src[k] || (k === 'grammaticalRangeAndAccuracy' ? src.grammaticalRange : null));
    if (!c) return null;
    criteria[k] = c;
  }
  const p = src.pronunciation || {};
  const pBand = audioAssessed ? wholeBand(p.band) : null;
  criteria.pronunciation = pBand === null
    ? { status: 'not_assessed', band: null, evidence: '', rationale: 'Pronunciation can only be assessed from audio; a transcript cannot show it.', improvementFocus: String(p.improvementFocus || 'Record answers aloud and review stress, intonation and connected speech.') }
    : { status: 'assessed', band: pBand, evidence: String(p.evidence || ''), rationale: String(p.rationale || ''), improvementFocus: String(p.improvementFocus || '') };
  const bands = SPEAKING_KEYS.map(k => criteria[k].band).concat(pBand === null ? [] : [pBand]);
  return {
    rubricVersion: RUBRIC_VERSION,
    overallBand: roundIeltsBand(mean(bands)),
    provisional: pBand === null,
    scoringMethod: pBand === null
      ? 'Mean of Fluency & Coherence, Lexical Resource and Grammatical Range & Accuracy (pronunciation needs audio), IELTS rounding. Provisional.'
      : 'Mean of the four criteria, IELTS rounding.',
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
    criteria,
    partFeedback: data.partFeedback && typeof data.partFeedback === 'object' ? data.partFeedback : {},
    overallSummary: String(data.overallSummary || ''),
    strengths: String(data.strengths || ''),
    areasForImprovement: String(data.areasForImprovement || ''),
  };
}
