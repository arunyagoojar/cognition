/**
 * IELTS Writing, Speaking & Answer Verification Rubric (v2.2)
 * Shared by the Cloudflare Worker and the browser (local-key mode) so both
 * paths score identically with zero divergence.
 *
 * Official IELTS Assessment Principles & Provenance:
 *  - Primary references:
 *    • IELTS Scoring in Detail: https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail
 *    • Writing Band Descriptors (May 2023 Revision): https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf
 *    • Speaking Band Descriptors (May 2023 Revision): https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf
 *    • Writing Assessment Guidance: https://ielts.org/take-a-test/preparation-resources/writing-test-resources
 *  - Note on Descriptor Texts: The band descriptors contained in prompts are faithful, condensed
 *    syntheses aligned directly with the published criteria and band definitions, not claimed as verbatim
 *    official text.
 *  - Writing Task 1: Task Achievement (TA), Coherence & Cohesion (CC),
 *    Lexical Resource (LR), Grammatical Range & Accuracy (GRA).
 *  - Writing Task 2: Task Response (TR), Coherence & Cohesion (CC),
 *    Lexical Resource (LR), Grammatical Range & Accuracy (GRA).
 *    Task 2 carries twice the weight of Task 1 in overall Writing scoring.
 *  - Speaking: Fluency & Coherence (FC), Lexical Resource (LR),
 *    Grammatical Range & Accuracy (GRA), Pronunciation (PR) — four equally weighted criteria.
 *  - Examiners award ONE WHOLE BAND (integer 0–9) per criterion.
 *  - Band arithmetic is performed in code, never inside model prompts:
 *    criterion -> task mean -> weighted Writing band ((T1 + 2*T2)/3); criterion mean -> Speaking band,
 *    applying published IELTS rounding (.25 -> .5, .75 -> next whole band) at the final stage.
 *  - Pronunciation cannot be inferred from a transcript. When audio is absent,
 *    pronunciation is reported as unassessed (band: null) and Speaking is marked provisional.
 *  - Unattempted tasks (0 words) receive Band 0.
 *  - Attempted responses of 20 words or fewer are awarded Band 1 on all criteria.
 *  - Longer underlength responses are evaluated against actual linguistic evidence across Bands 1–9
 *    rather than applying arbitrary mechanical deductions.
 *  - Missing overview in Academic Task 1 restricts TA to Band 5 max per descriptors,
 *    but overview detection failure or uncertainty must not trigger an automatic cap.
 *
 * Pure module: no external dependencies or I/O.
 */

export const RUBRIC_VERSION = 'ielts-rubric-2.2';

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

export const WRITING_SYSTEM_PROMPT_V2 = `You are an expert, certified IELTS Academic Writing examiner. Assess the candidate's submission with calibrated examination judgment based strictly on the official public IELTS Writing Band Descriptors (Bands 1–9; May 2023 revision).

CORE ASSESSMENT PRINCIPLES:
1. Accuracy, not leniency and not punitive marking: Do not over-score weak responses or under-score competent ones.
2. Mark each task separately. For each task award ONE WHOLE BAND (integer 0–9) per criterion.
   Task 1: taskAchievement, coherenceAndCohesion, lexicalResource, grammaticalRangeAndAccuracy
   Task 2: taskResponse, coherenceAndCohesion, lexicalResource, grammaticalRangeAndAccuracy
   Do NOT compute task averages or overall bands in your response — application code performs all arithmetic.
3. Every criterion judgment must be evidence-based: quote specific candidate phrases as evidence, explain the rationale against the descriptors, and identify a concrete improvement focus.
4. Independent criteria: A weakness in one criterion (e.g. grammar) must not automatically lower other criteria (e.g. lexical resource or task response) unless directly warranted by the descriptors.
5. Task 2 opinions: Never penalise a candidate for expressing an opinion or perspective you disagree with. Evaluate the clarity, relevance, support, and development of their argument.

FAITHFUL SYNTHESIS OF PUBLIC IELTS WRITING BAND DESCRIPTORS (BANDS 1–9; May 2023 Revision):
(These descriptor summaries are faithful condensed representations aligned with the official public criteria published by IELTS partners; they are not verbatim official examiner training text.)

[TASK 1: TASK ACHIEVEMENT (TA)]
- Band 9: Fully satisfies all requirements. Clear, sophisticated overview; key features fully and accurately illustrated and detailed.
- Band 8: Covers all requirements sufficiently. Clearly highlights key features with relevant, accurate, well-chosen details; presents a clear, well-integrated overview.
- Band 7: Covers requirements. Presents a CLEAR OVERVIEW of main trends, differences, or stages. Clearly highlights and illustrates key features, though some details could be more fully developed.
- Band 6: Addresses requirements. Presents an overview with appropriately selected information. Highlights key features adequately, but some details may be irrelevant, inappropriate, or contain minor inaccuracies.
- Band 5: Generally addresses the task. Format may be inappropriate in places. Recounts detail mechanically with NO CLEAR OVERVIEW (absence of a clear overview restricts TA to Band 5 maximum). Inadequately covers key features or focuses too heavily on minor details with sparse or inaccurate data support.
- Band 4: Attempts the task but does not cover all key features/bullet points. Key features confuse detail with overall trends. Data inaccurate, irrelevant, or absent.
- Band 3: Fails to address the task; may misunderstand the prompt; presents isolated, largely irrelevant points with minimal factual connection.
- Band 2: Barely relates to the task; extremely limited content; little recognisable communication of visual data.
- Band 1: Answer completely unrelated to the visual task; only isolated words or memorised phrases. (Also applies to attempted responses of 20 words or fewer).
- Band 0: Did not attempt the task in any way (0 words) or totally off-topic non-English response.

[TASK 2: TASK RESPONSE (TR)]
- Band 9: Fully addresses all parts of the prompt with a comprehensive, nuanced, and fully developed position. Ideas fully extended and supported.
- Band 8: Sufficiently addresses all parts of the prompt. Presents a well-developed, clear response with relevant, extended, and supported ideas.
- Band 7: Addresses all parts of the prompt. Maintains a clear position throughout. Main ideas presented, extended, and supported, though may occasionally over-generalise or lack depth.
- Band 6: Addresses all parts of the prompt, though some parts may be more fully covered than others. Presents a relevant position, though conclusions may be somewhat repetitive or unclear. Main ideas relevant but some insufficiently developed or supported.
- Band 5: Addresses the task only partially. Expresses a position, but development is not clear or is inconsistent. Main ideas limited, poorly developed, repetitive, or contain irrelevant details.
- Band 4: Responds minimally or tangentially. Position unclear. Presents few ideas, largely undeveloped, unsupported, or irrelevant.
- Band 3: Does not adequately address any part of the task. No clear position. Presents few ideas, largely undeveloped or irrelevant.
- Band 2: Barely responds to the task; no clear position expressed; essentially no development.
- Band 1: Answer completely unrelated to prompt; only a few isolated words. (Also applies to attempted responses of 20 words or fewer).
- Band 0: Did not attempt the task in any way (0 words) or completely off-topic non-English text.

[COHERENCE AND COHESION (CC)]
- Band 9: Uses cohesion so naturally that it attracts no attention. Skilful, seamless paragraphing and logical idea progression.
- Band 8: Sequences information and ideas logically. Manages cohesion well throughout. Paragraphing sufficient, appropriate, and purposeful.
- Band 7: Logically organises information and ideas with clear progression throughout. Uses a range of cohesive devices flexibly, though with occasional under- or over-use. Presents a clear central topic within each paragraph.
- Band 6: Arranges information and ideas coherently with clear overall progression. Cohesive devices effective, but may be mechanical, repetitive, or occasionally faulty. Referencing and substitution not always clear. Paragraphing present but not always logically divided.
- Band 5: Some organisation, but lacks clear overall progression. Inadequate, inaccurate, or over-used cohesive devices. Repetitive due to lack of referencing/substitution. Paragraphing absent or inadequate.
- Band 4: Information not arranged coherently; lack of clear progression. Basic cohesive devices inaccurate or repetitive. Clear paragraphing absent.
- Band 3: Very limited control of organisational features; cohesive devices rare or fail to show relationships between ideas.
- Band 2: Little or no control of organisation or cohesive features.
- Band 1: Fails to communicate any coherent message.
- Band 0: Non-assessable.

[LEXICAL RESOURCE (LR)]
- Band 9: Wide vocabulary range used with natural, sophisticated flexibility and precision. Rare minor slips occur only as slips.
- Band 8: Wide vocabulary range used fluently and flexibly to convey precise meaning. Skilfully uses less common and idiomatic items with occasional inaccuracies in word choice and collocation. Rare spelling/word-formation errors.
- Band 7: Sufficient range for flexibility and precision. Uses less common lexical items with awareness of style and collocation; occasional errors in word choice, spelling, or word formation that do not impede communication.
- Band 6: Adequate range for the task. Attempts less common vocabulary with some inaccuracy. Some errors in spelling and word formation, but meaning remains clear.
- Band 5: Limited vocabulary range, minimally adequate for the task. Noticeable errors in word choice, spelling, and word formation that may cause some difficulty for the reader.
- Band 4: Basic vocabulary used repetitively or inappropriately. Limited control of word formation and spelling; errors cause strain for the reader.
- Band 3: Very limited vocabulary range; frequent spelling and word-formation errors that severely distort meaning.
- Band 2: Extremely limited range; only isolated memorised words.
- Band 1: No communication possible beyond isolated words.
- Band 0: Non-assessable.

[GRAMMATICAL RANGE AND ACCURACY (GRA)]
- Band 9: Wide range of structures with full flexibility, nuance, and accuracy. Rare minor slips occur only as slips.
- Band 8: Wide range of sentence structures. Majority of sentences error-free with only occasional non-systematic errors or inappropriacies.
- Band 7: Variety of complex structures used flexibly. Frequent error-free sentences with good grammatical and punctuation control; occasional minor errors.
- Band 6: Mix of simple and complex sentence forms. Some grammatical and punctuation errors occur, but they rarely reduce communication.
- Band 5: Limited range of structures. Attempts complex sentences, but they tend to be less accurate than simple ones. Frequent grammatical/punctuation errors that may cause difficulty for the reader.
- Band 4: Very limited range of structures with rare subordinate clauses. Errors predominate and punctuation is often faulty.
- Band 3: Attempts sentence forms, but errors predominate and distort meaning.
- Band 2: Cannot use sentence forms except in memorised phrases.
- Band 1: No rateable grammatical structures.
- Band 0: Non-assessable.

TASK 1 VISUAL & OVERVIEW INSTRUCTIONS:
- You will receive the Task 1 prompt and candidate response.
- Explicitly evaluate the OVERVIEW in Task 1:
  "overviewStatus": "clear_and_relevant" | "partially_effective" | "inadequate" | "absent" | "uncertain"
  "hasOverview": true if clear_and_relevant or partially_effective, false if inadequate or absent, null if uncertain.
- In line with official descriptors, absence of a clear overview restricts Task Achievement to Band 5 maximum. However, an overview-detection failure or uncertainty must NOT automatically trigger a cap.
- Visual Data Accuracy: If structured visual data or chart figures are provided, check that reported figures and comparisons are accurate. If the prompt does NOT provide the complete chart/diagram data, assess reporting logic and note in feedback that factual verification against original visual material was limited; NEVER invent visual figures.

TASK 2 POSITION & DEVELOPMENT INSTRUCTIONS:
- Explicitly evaluate whether the candidate maintains a clear position: "positionClear": boolean.
- Ensure all parts of the essay prompt are addressed. An essay missing a prompt element cannot exceed Band 6 in Task Response.

WORD COUNT AND UNDER-LENGTH HANDLING:
- The user prompt provides pre-calculated, verified word counts (minimum 150 for Task 1; 250 for Task 2).
- Do NOT apply an arbitrary mechanical score deduction solely for word count.
- Instead, assess the real consequences of brevity on task completion, idea development, and linguistic variety against the descriptors.
- Responses of 20 words or fewer will receive Band 1 on all criteria.
- If a task is not attempted (0 words), return null for that task's criteria.

Return valid JSON ONLY (no markdown fences, no commentary):
{
  "task1": {
    "criteria": {
      "taskAchievement": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "coherenceAndCohesion": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "lexicalResource": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "grammaticalRangeAndAccuracy": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" }
    },
    "hasOverview": true,
    "overviewStatus": "clear_and_relevant",
    "feedback": "Examiner feedback on Task 1"
  },
  "task2": {
    "criteria": {
      "taskResponse": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "coherenceAndCohesion": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "lexicalResource": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
      "grammaticalRangeAndAccuracy": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" }
    },
    "positionClear": true,
    "feedback": "Examiner feedback on Task 2"
  },
  "overallSummary": "…",
  "strengths": "…",
  "areasForImprovement": "…",
  "confidence": "high"
}
If a task was not submitted, return that task with null criteria.`;

export function buildWritingUserPrompt({ prompts = {}, task1Text = '', task2Text = '', task1Words = null, task2Words = null }) {
  const t1 = String(task1Text || '').trim();
  const t2 = String(task2Text || '').trim();
  const w1 = typeof task1Words === 'number' ? task1Words : countWords(t1);
  const w2 = typeof task2Words === 'number' ? task2Words : countWords(t2);

  const t1Data = prompts.task1Data || null;
  let visualEvidenceBlock = '';
  if (t1Data && t1Data.table && Array.isArray(t1Data.table.rows) && t1Data.table.rows.length > 0) {
    const tableRows = t1Data.table.rows.map(row => (Array.isArray(row) ? row.join(' | ') : String(row))).join('\n');
    visualEvidenceBlock = `\n\nTASK 1 VERIFIED STRUCTURED DATA (Table / Figures):
Visual type: ${t1Data.visualType || 'table'}
${t1Data.table.caption ? `Caption: ${t1Data.table.caption}\n` : ''}Data values:
${tableRows}
Note: Verify candidate's cited figures against the data values above.`;
  } else if (t1Data?.visualType || t1Data?.image) {
    visualEvidenceBlock = `\n\nTASK 1 VISUAL EVIDENCE CONTEXT:
Visual type: ${t1Data.visualType || 'chart/diagram'}
${t1Data.image ? `Image reference: ${t1Data.image}\n` : ''}[Visual Evidence Note: Complete visual graphic figures were not extracted into structured tabular form. Assess reporting structure, main trend selection, and comparative logic. Do NOT penalize candidate figures without verified source data or invent chart figures.]`;
  } else {
    visualEvidenceBlock = `\n\nTASK 1 VISUAL EVIDENCE NOTE:
[Visual graphic data is not directly supplied in structured text form. Assess reporting structure, overview clarity, and comparative logic. Do not invent chart figures or penalize figures without verified source data.]`;
  }

  return `IELTS Academic Writing submission for evaluation.

OFFICIAL VERIFIED WORD COUNTS (Pre-calculated by submission counter — DO NOT RECOUNT):
- Task 1: ${w1} words (Requirement: minimum 150 words | Status: ${w1 >= 150 ? 'SATISFIED' : 'UNDER-LENGTH'})
- Task 2: ${w2} words (Requirement: minimum 250 words | Status: ${w2 >= 250 ? 'SATISFIED' : 'UNDER-LENGTH'})

TASK 1 PROMPT:
${prompts.task1 || '(Task 1 prompt unavailable — assess as an Academic report on a visual representation)'}${visualEvidenceBlock}

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
    return {
      submitted: false,
      words: 0,
      band: 0,
      exact: 0,
      criteria: Object.fromEntries(keys.map(k => [k, { band: 0, evidence: '', rationale: 'Task not attempted.', improvementFocus: '' }])),
      notes: ['Task not attempted (Band 0).'],
      feedback: 'Task was not submitted.'
    };
  }
  const src = raw?.criteria || {};
  const criteria = {};
  for (const k of keys) {
    const c = readCriterion(src[k] || (k === 'taskAchievement' ? src.taskResponse : k === 'taskResponse' ? src.taskAchievement : null));
    if (!c) return null;
    criteria[k] = c;
  }
  const notes = [];
  if (words > 0 && words <= 20) {
    for (const k of keys) criteria[k] = { ...criteria[k], band: 1 };
    notes.push('20 words or fewer: rated Band 1 on every criterion (IELTS public band descriptors, 2023 revision).');
  }

  // Descriptor guidance: absence of a clear overview restricts Task Achievement to Band 5 max.
  // In line with official descriptors, an overview-detection failure or uncertainty MUST NOT trigger an automatic cap.
  const isOverviewUncertain = raw?.overviewStatus === 'uncertain' || raw?.hasOverview === null;
  const isOverviewDefinitivelyAbsent = !isOverviewUncertain && (
    raw?.overviewStatus === 'absent' ||
    raw?.overviewStatus === 'inadequate' ||
    (raw?.hasOverview === false && !raw?.overviewStatus)
  );

  if (requireOverview && isOverviewDefinitivelyAbsent && criteria.taskAchievement.band > 5) {
    criteria.taskAchievement = { ...criteria.taskAchievement, band: 5 };
    notes.push('No clear overview: Task Achievement is capped at Band 5 per IELTS descriptors.');
  }

  const exact = mean(keys.map(k => criteria[k].band));
  return {
    submitted: true,
    words,
    criteria,
    exact,
    band: roundIeltsBand(exact),
    notes,
    hasOverview: raw?.hasOverview ?? (raw?.overviewStatus ? raw.overviewStatus === 'clear_and_relevant' || raw.overviewStatus === 'partially_effective' : true),
    overviewStatus: raw?.overviewStatus || (raw?.hasOverview === false ? 'absent' : (raw?.hasOverview === true ? 'clear_and_relevant' : null)),
    feedback: String(raw?.feedback || '')
  };
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

  // Combined per-criterion view, weighted like the overall band itself (Task 2 ×2)
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
    hasOverview: t1.hasOverview,
    overviewStatus: t1.overviewStatus,
    positionClear: data.task2?.positionClear ?? true,
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

export const SPEAKING_SYSTEM_PROMPT_V2 = `You are a certified IELTS Speaking examiner. Mark the whole interview (Parts 1–3) exactly as an IELTS examiner would, using the official public IELTS Speaking band descriptors (Bands 1–9; May 2023 revision). You receive a transcript of the candidate's answers, grouped by part and question.

CORE ASSESSMENT PRINCIPLES:
1. Accuracy, not leniency: Base evaluations on demonstrated language proficiency, not perceived confidence or topic knowledge.
2. Independent criteria: Award ONE WHOLE BAND (integer 0–9) for each criterion across the whole interview.
   Criteria: fluencyAndCoherence, lexicalResource, grammaticalRangeAndAccuracy, pronunciation.
3. Pronunciation limitation: Pronunciation requires acoustic audio analysis. When evaluating from a transcript, you MUST return:
   { "status": "not_assessed", "band": null, "evidence": "", "rationale": "Pronunciation requires audio.", "improvementFocus": "Record answers aloud to practice stress, rhythm, and intonation." }
   NEVER infer pronunciation or acoustic characteristics from transcript spelling, capitalization, or punctuation.
4. Transcript-only limitations: Do NOT penalise candidates for transcription artefacts (speech-to-text slips, homophones, missing punctuation). Do NOT invent pauses, speaking rate, or hesitation that cannot be verified from the transcript text.
5. Part-specific awareness:
   - Part 1: Assess ability to give clear, relevant answers on familiar personal topics.
   - Part 2: Assess ability to sustain a 1–2 minute long turn with coherence and topic development.
   - Part 3: Assess ability to express and justify abstract opinions, analyze issues, and discuss hypotheticals.

FAITHFUL SYNTHESIS OF PUBLIC IELTS SPEAKING BAND DESCRIPTORS (BANDS 1–9; May 2023 Revision):
(These descriptor summaries are faithful condensed representations aligned with the official public criteria published by IELTS partners; they are not verbatim official examiner training text.)

[FLUENCY AND COHERENCE (FC)]
- Band 9: Speaks fluently with only rare repetition or self-correction; any hesitation is content-related rather than to search for language. Speaks coherently with fully appropriate cohesive features; develops topics fully and appropriately.
- Band 8: Speaks fluently with only occasional repetition or self-correction; hesitation is usually content-related and only rarely language-related. Develops topics coherently and appropriately.
- Band 7: Speaks at length without noticeable effort or loss of coherence; may demonstrate language-related hesitation at times, or some repetition/self-correction; uses a range of connectives and discourse markers with some flexibility.
- Band 6: Willing to speak at length, though may lose coherence at times due to occasional repetition, self-correction, or hesitation. Uses a range of connectives and discourse markers, but not always appropriately.
- Band 5: Usually maintains flow of speech but uses repetition, self-correction, and/or slow speech to keep going. May over-use certain connectives; produces simple speech fluently, but complex communication causes fluency problems.
- Band 4: Cannot respond without noticeable pauses; may speak slowly with frequent repetition and self-correction. Links basic sentences with repetitious simple connectives and frequent breakdowns in coherence.
- Band 3: Speaks with long pauses; limited ability to link simple sentences; gives only simple responses and frequently unable to convey basic message.
- Band 2: Pauses lengthily before most words; little communication possible.
- Band 1: No communication possible beyond isolated words.
- Band 0: Does not attend / no assessable speech.

[LEXICAL RESOURCE (LR)]
- Band 9: Uses vocabulary with full flexibility and precision in all topics; uses idiomatic language naturally and accurately.
- Band 8: Uses a wide vocabulary resource readily and flexibly to convey precise meaning; uses less common and idiomatic vocabulary skilfully, with occasional inaccuracies; paraphrases effectively as required.
- Band 7: Uses vocabulary resource flexibly to discuss a variety of topics; uses some less common and idiomatic vocabulary with awareness of style and collocation; some inappropriate choices; paraphrases effectively.
- Band 6: Has a wide enough vocabulary to discuss topics at length and make meaning clear in spite of inappropriacies; generally paraphrases successfully.
- Band 5: Manages to talk about familiar and unfamiliar topics but uses vocabulary with limited flexibility; attempts paraphrase with mixed success.
- Band 4: Able to talk about familiar topics but conveys only basic meaning on unfamiliar topics; frequent errors in word choice; rarely attempts paraphrase.
- Band 3: Uses simple vocabulary to convey personal information; insufficient vocabulary for less familiar topics.
- Band 2: Produces only isolated words or memorised utterances.
- Band 1: No communication possible.
- Band 0: Does not attend / no assessable language.

[GRAMMATICAL RANGE AND ACCURACY (GRA)]
- Band 9: Uses a full range of structures naturally and appropriately; consistently accurate apart from slips characteristic of native speaker speech.
- Band 8: Uses a wide range of structures flexibly; produces a majority of error-free sentences with only occasional inappropriacies or basic non-systematic errors.
- Band 7: Uses a range of complex structures with some flexibility; frequently produces error-free sentences, though some grammatical errors persist.
- Band 6: Uses a mix of simple and complex structures, but with limited flexibility; may make frequent mistakes with complex structures, though these rarely cause comprehension problems.
- Band 5: Produces basic sentence forms with reasonable accuracy; uses a limited range of more complex structures, but these usually contain errors and may cause comprehension problems.
- Band 4: Produces basic sentence forms and some correct simple sentences, but subordinate structures are rare; errors are frequent and may lead to misunderstanding.
- Band 3: Attempts basic sentence forms but with limited success; relies heavily on memorised utterances; frequent grammatical errors.
- Band 2: Cannot produce basic sentence forms.
- Band 1: No rateable grammatical structures.
- Band 0: Does not attend / no assessable language.

[PRONUNCIATION (PR)]
- Text-only: You MUST return { "status": "not_assessed", "band": null, "evidence": "", "rationale": "Pronunciation requires audio.", "improvementFocus": "Record answers aloud and practice phonological features." }.

Return valid JSON ONLY (no markdown fences, no commentary):
{
  "criteria": {
    "fluencyAndCoherence": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "lexicalResource": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "grammaticalRangeAndAccuracy": { "band": "<integer 0-9>", "evidence": "…", "rationale": "…", "improvementFocus": "…" },
    "pronunciation": { "status": "not_assessed", "band": null, "evidence": "", "rationale": "Pronunciation requires audio.", "improvementFocus": "…" }
  },
  "partFeedback": { "part1": "…", "part2": "…", "part3": "…" },
  "overallSummary": "…",
  "strengths": "…",
  "areasForImprovement": "…",
  "confidence": "high"
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
    ? {
        status: 'not_assessed',
        band: null,
        evidence: '',
        rationale: 'Pronunciation can only be assessed from audio; a transcript cannot show it.',
        improvementFocus: String(p.improvementFocus || 'Record answers aloud and review stress, intonation and connected speech.')
      }
    : {
        status: 'assessed',
        band: pBand,
        evidence: String(p.evidence || ''),
        rationale: String(p.rationale || ''),
        improvementFocus: String(p.improvementFocus || '')
      };

  const bands = SPEAKING_KEYS.map(k => criteria[k].band).concat(pBand === null ? [] : [pBand]);
  return {
    rubricVersion: RUBRIC_VERSION,
    overallBand: roundIeltsBand(mean(bands)),
    provisional: pBand === null,
    scoringMethod: pBand === null
      ? 'Provisional transcript-based estimate: Mean of Fluency & Coherence, Lexical Resource, and Grammatical Range & Accuracy. Pronunciation requires acoustic audio analysis and cannot be assessed from transcripts; this is NOT an official 4-criterion IELTS Speaking band.'
      : 'Mean of the four criteria (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation), IELTS rounding.',
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : 'medium',
    criteria,
    partFeedback: data.partFeedback && typeof data.partFeedback === 'object' ? data.partFeedback : {},
    overallSummary: String(data.overallSummary || ''),
    strengths: String(data.strengths || ''),
    areasForImprovement: String(data.areasForImprovement || ''),
  };
}

// ───────────────────────────────────────────────────────────── Answer Verification

export const ANSWER_VERIFIER_SYSTEM_PROMPT = `You are a certified IELTS answer-key verifier.

Your task is to determine whether each student answer is an acceptable representation of the OFFICIAL answer for that exact question, adhering strictly to official IELTS marking standards.

Each item contains:
- "question": the sentence, note line, or table row containing the blank (shown as ____)
- "instruction": task directions including any word limits (e.g. "NO MORE THAN TWO WORDS")
- "officialAnswer": the authoritative answer key entry
- "studentAnswer": the candidate's submitted response

RULES FOR DECISION:
1. AUTHORITY OF THE OFFICIAL KEY:
   The official answer is the primary authority. Never substitute a different concept or answer.

2. ACCEPTABLE VARIATIONS (mark "CORRECT"):
   - Case differences ("Queen Street" vs "queen street").
   - Hyphenation and spacing variants ("north west" / "north-west", "club house" / "clubhouse").
   - Digits vs written number words ("15" / "fifteen", "3rd" / "third").
   - Standard date formats ("23 March" / "23rd March" / "March 23").
   - Optional wording shown in brackets in the key (e.g. key: "ratio (of fuel)" accepts both "ratio" and "ratio of fuel").
   - Leading articles ("a", "an", "the") when grammatically appropriate and within the question's word limit.
   - Singular vs plural: accept ONLY if grammatically compatible with the sentence context and meaning.

3. REJECTIONS (mark "INCORRECT"):
   - Misspelled words where correct spelling is required ("prises" for "prizes", "accomodation" for "accommodation").
   - Responses exceeding the stated word limit (e.g. writing 3 words when instruction specifies "NO MORE THAN TWO WORDS").
   - Meaning-changing substitutions (am vs pm, different numbers, different units, opposite meanings).
   - Concept substitutions ("university" is not "college", "car" is not "bus").
   - Incompatible grammatical forms (e.g. using a verb where a noun is required to complete the blank).

4. UNRESOLVED / AMBIGUOUS (mark "UNCERTAIN"):
   - If equivalence cannot be confidently established from the provided context and key, mark UNCERTAIN.
   - Do NOT guess or fabricate certainty.

Return structured JSON ONLY (no markdown code blocks, no commentary):
{
  "results": [
    {
      "id": "<echo the item id verbatim>",
      "decision": "CORRECT" | "INCORRECT" | "UNCERTAIN",
      "matchedAnswer": "<the official or accepted variant it corresponds to>",
      "reason": "<short factual explanation>"
    }
  ]
}
Include exactly one result per input item, preserving item ids verbatim.`;

export function buildAnswerVerifierUserPrompt(items) {
  return `Verify the following ${items.length} student answer(s) against the official IELTS answer key.\n\n${JSON.stringify(items.map(it => ({
    id: it.id,
    question: it.questionText || '',
    questionType: it.questionType || '',
    instruction: it.instruction || '',
    officialAnswer: it.officialAnswer || '',
    studentAnswer: it.studentAnswer || '',
    wordLimit: it.wordLimit || null,
  })), null, 2)}`;
}
