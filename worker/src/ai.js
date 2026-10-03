/**
 * Server-side AI evaluation for Cognition (Phase 4).
 * The Worker decrypts the user's credential in memory, calls Gemini,
 * validates the rubric JSON, and returns ONLY the evaluation.
 * The decrypted key exists transiently and is never logged or returned.
 *
 * Prompts and schemas mirror src/utils/geminiEvaluator.js (V1).
 */

export const AI_MODELS = {
  // Auto-updating alias — survives upstream model retirements.
  primary: 'gemini-flash-latest',
  fallback: 'gemini-2.5-flash',
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const IELTS_SPEAKING_SYSTEM_PROMPT_V1 = `You are an IELTS Academic Speaking examiner and assessment assistant.

Evaluate the candidate's Speaking performance using the official IELTS Speaking assessment criteria:
1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

Apply the official IELTS-style band descriptors consistently (scale 0.0 to 9.0 in 0.5 increments).

Do not reward or penalize the candidate based on:
- the opinion they express
- their personal background
- accent identity
- topic preference
- sophistication of ideas alone

Evaluate the language performance demonstrated by the response.

For Fluency and Coherence, consider:
- continuity of speech, hesitation, repetition, self-correction, linking, organization of ideas, ability to develop responses.

For Lexical Resource, consider:
- vocabulary range, precision, appropriacy, collocation, repetition, ability to paraphrase.

For Grammatical Range and Accuracy, consider:
- sentence variety, grammatical control, errors, complexity, whether errors impede communication.

For Pronunciation:
- CRITICAL PRONUNCIATION RULE: Do not infer pronunciation quality from transcript text alone.
- If only a transcript is available, mark pronunciation as requiring audio evidence rather than fabricating an assessment.
- In that case, set pronunciation.status to "insufficient_audio_evidence", pronunciation.band to null, and calculate overallBand based on the three language criteria.

Return structured JSON ONLY (no markdown fences, no explanatory text):
{
  "overallBand": 7.0,
  "confidence": "high",
  "criteria": {
    "fluencyAndCoherence": { "band": 7.0, "evidence": "Direct quote or observed pattern", "rationale": "Justification against band descriptors", "improvementFocus": "Targeted advice" },
    "lexicalResource": { "band": 7.0, "evidence": "Direct quote or observed pattern", "rationale": "Justification against band descriptors", "improvementFocus": "Targeted advice" },
    "grammaticalRangeAndAccuracy": { "band": 7.0, "evidence": "Direct quote or observed pattern", "rationale": "Justification against band descriptors", "improvementFocus": "Targeted advice" },
    "pronunciation": { "status": "insufficient_audio_evidence", "band": null, "evidence": "Text transcripts alone cannot substantiate acoustic phonological features.", "rationale": "Pronunciation assessment strictly requires direct audio frequency examination.", "improvementFocus": "Focus on word stress and connected speech cadence during live recording." }
  },
  "overallSummary": "Comprehensive diagnostic overview",
  "strengths": "Main language assets observed",
  "areasForImprovement": "Top priorities for band improvement"
}`;

export const IELTS_WRITING_SYSTEM_PROMPT_V1 = `You are an IELTS Academic Writing examiner and assessment assistant.

Evaluate the candidate's response using the official IELTS Academic Writing assessment criteria:
For Task 1: Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
For Task 2: Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.

Evaluate the response against the actual task prompt.
Do not award points merely because the response is long.
Do not penalize a candidate for expressing an opinion you disagree with.

Evaluate:
- task fulfillment, relevance, organization, development of ideas, vocabulary, grammar, cohesion, accuracy.

For Task 1 specifically, assess whether the candidate accurately identifies and summarizes the important features of the visual/data prompt where applicable.
For Task 2 specifically, assess whether the candidate addresses all parts of the question and develops a relevant position.

Base the evaluation on the submitted text only. Do not invent content.

Return structured JSON ONLY (no markdown fences, no explanatory text):
{
  "overallBand": 7.0,
  "task1Band": 7.0,
  "task2Band": 7.0,
  "confidence": "high",
  "criteria": {
    "taskAchievement": { "band": 7.0, "evidence": "Specific evidence from Task 1 and Task 2", "rationale": "Fulfillment of prompt requirements", "improvementFocus": "Targeted advice" },
    "coherenceAndCohesion": { "band": 7.0, "evidence": "Paragraphing and cohesive device usage", "rationale": "Logical progression of ideas", "improvementFocus": "Targeted advice" },
    "lexicalResource": { "band": 7.0, "evidence": "Collocations and academic terms used", "rationale": "Precision and lexical range", "improvementFocus": "Targeted advice" },
    "grammaticalRangeAndAccuracy": { "band": 7.0, "evidence": "Complex sentences and grammatical control", "rationale": "Error frequency and syntactic variety", "improvementFocus": "Targeted advice" }
  },
  "overallSummary": "Comprehensive assessment of the writing submission",
  "task1Feedback": "Detailed feedback on Task 1 report",
  "task2Feedback": "Detailed feedback on Task 2 essay",
  "strengths": "Observed strengths in writing",
  "areasForImprovement": "Key steps to raise score"
}`;

function extractJsonFromText(text) {
  if (!text) return null;
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {}
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {}
  }
  return null;
}

const half = (n) => Math.round(n * 2) / 2;

export function validateSpeakingEvaluationJson(data) {
  if (!data || typeof data !== 'object') return null;
  const band = Number(data.overallBand);
  if (isNaN(band) || band < 0 || band > 9.0) return null;
  if (!data.criteria || typeof data.criteria !== 'object') return null;

  const fc = data.criteria.fluencyAndCoherence?.band;
  const lr = data.criteria.lexicalResource?.band;
  const gr = (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange)?.band;
  if (typeof fc !== 'number' || typeof lr !== 'number' || typeof gr !== 'number') return null;

  return {
    overallBand: half(band),
    confidence: data.confidence || 'high',
    criteria: {
      fluencyAndCoherence: {
        band: half(fc),
        evidence: data.criteria.fluencyAndCoherence.evidence || '',
        rationale: data.criteria.fluencyAndCoherence.rationale || '',
        improvementFocus: data.criteria.fluencyAndCoherence.improvementFocus || '',
      },
      lexicalResource: {
        band: half(lr),
        evidence: data.criteria.lexicalResource.evidence || '',
        rationale: data.criteria.lexicalResource.rationale || '',
        improvementFocus: data.criteria.lexicalResource.improvementFocus || '',
      },
      grammaticalRangeAndAccuracy: {
        band: half(gr),
        evidence: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).evidence || '',
        rationale: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).rationale || '',
        improvementFocus: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).improvementFocus || '',
      },
      pronunciation: {
        status: data.criteria.pronunciation?.status || 'insufficient_audio_evidence',
        band: typeof data.criteria.pronunciation?.band === 'number' ? half(data.criteria.pronunciation.band) : null,
        evidence: data.criteria.pronunciation?.evidence || 'Audio waveform examination required.',
        rationale: data.criteria.pronunciation?.rationale || 'Transcript text alone cannot verify pronunciation.',
        improvementFocus: data.criteria.pronunciation?.improvementFocus || 'Practice stress and intonation during speech recording.',
      },
    },
    overallSummary: data.overallSummary || '',
    strengths: data.strengths || '',
    areasForImprovement: data.areasForImprovement || '',
  };
}

export function validateWritingEvaluationJson(data) {
  if (!data || typeof data !== 'object') return null;
  const band = Number(data.overallBand);
  if (isNaN(band) || band < 0 || band > 9.0) return null;
  if (!data.criteria || typeof data.criteria !== 'object') return null;

  const ta = (data.criteria.taskAchievement || data.criteria.taskResponse)?.band;
  const cc = data.criteria.coherenceAndCohesion?.band;
  const lr = data.criteria.lexicalResource?.band;
  const gr = (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange)?.band;
  if (typeof ta !== 'number' || typeof cc !== 'number' || typeof lr !== 'number' || typeof gr !== 'number') return null;

  return {
    overallBand: half(band),
    task1Band: typeof data.task1Band === 'number' ? half(data.task1Band) : half(band),
    task2Band: typeof data.task2Band === 'number' ? half(data.task2Band) : half(band),
    confidence: data.confidence || 'high',
    criteria: {
      taskAchievement: {
        band: half(ta),
        evidence: (data.criteria.taskAchievement || data.criteria.taskResponse).evidence || '',
        rationale: (data.criteria.taskAchievement || data.criteria.taskResponse).rationale || '',
        improvementFocus: (data.criteria.taskAchievement || data.criteria.taskResponse).improvementFocus || '',
      },
      coherenceAndCohesion: {
        band: half(cc),
        evidence: data.criteria.coherenceAndCohesion.evidence || '',
        rationale: data.criteria.coherenceAndCohesion.rationale || '',
        improvementFocus: data.criteria.coherenceAndCohesion.improvementFocus || '',
      },
      lexicalResource: {
        band: half(lr),
        evidence: data.criteria.lexicalResource.evidence || '',
        rationale: data.criteria.lexicalResource.rationale || '',
        improvementFocus: data.criteria.lexicalResource.improvementFocus || '',
      },
      grammaticalRangeAndAccuracy: {
        band: half(gr),
        evidence: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).evidence || '',
        rationale: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).rationale || '',
        improvementFocus: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).improvementFocus || '',
      },
    },
    overallSummary: data.overallSummary || '',
    task1Feedback: data.task1Feedback || '',
    task2Feedback: data.task2Feedback || '',
    strengths: data.strengths || '',
    areasForImprovement: data.areasForImprovement || '',
  };
}

async function callGemini(model, apiKey, systemPrompt, userPrompt) {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  // Never include the key or raw headers in errors.
  if (!res.ok) {
    const err = new Error(`Gemini request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/**
 * Runs the evaluation chain: primary model → fallback model.
 * Returns { status, evaluation, model } or { status, message }.
 */
export async function runEvaluationChain({ apiKey, systemPrompt, userPrompt, validator }) {
  for (const model of [AI_MODELS.primary, AI_MODELS.fallback]) {
    try {
      const text = await callGemini(model, apiKey, systemPrompt, userPrompt);
      const parsed = extractJsonFromText(text);
      const validated = validator(parsed);
      if (validated) {
        return { status: 'completed', evaluation: validated, model };
      }
    } catch (e) {
      if (e.status === 429) {
        return { status: 'failed', message: 'AI rate limit reached (429). Please wait a minute and retry.' };
      }
      // Try the fallback model; never surface provider internals.
    }
  }
  return {
    status: 'failed',
    message: 'AI evaluation failed to produce a valid IELTS rubric response. Check your API key configuration and try again.',
  };
}

/**
 * Server-side credential validation (Part K): cheap models-list ping.
 * Returns { valid, message }. Never logs the key.
 */
export async function validateGeminiKeyServer(apiKey) {
  try {
    const res = await fetch(`${GEMINI_BASE}?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 429) return { valid: true };
    if (res.status === 400 || res.status === 403) {
      return { valid: false, message: 'Gemini rejected this API key. Please check the key and try again.' };
    }
    return { valid: false, message: 'Could not verify the key with Google right now. Please try again shortly.' };
  } catch {
    return { valid: false, message: 'Could not reach Google to verify the key. Please try again shortly.' };
  }
}

export const ANSWER_VERIFIER_SYSTEM_PROMPT = `You are an IELTS answer-key verifier.

For each item you receive, decide whether the student's answer is an acceptable representation of the OFFICIAL answer for that exact question, under the supplied constraints (word limits, singular/plural, numbers, dates, times, units, names, spelling requirements).

Rules:
- The official answer is the authority. Never invent or substitute an answer.
- Accept obvious representations: case differences, number format ("11" vs "eleven"), optional parenthetical parts, minor spelling that preserves the word, singular/plural when the question context makes it acceptable.
- Reject answers that change meaning: am/pm swaps, different quantities, related-but-different words ("university" is not "college"), wrong concepts.
- If you cannot confidently establish equivalence, decide UNCERTAIN.

Respond with structured JSON ONLY (no markdown, no commentary):
{
  "results": [
    { "id": "<echo the item id>",
      "decision": "CORRECT" | "INCORRECT" | "UNCERTAIN",
      "matchedAnswer": "<the official/accepted answer it corresponds to>",
      "reason": "<short factual explanation>" }
  ]
}
Include exactly one result per input item, echoing ids verbatim.`;

/**
 * Batched answer verification: one Gemini request for all uncertain items.
 * Returns { results: [{id, decision, matchedAnswer, reason}] } or { results: [] }.
 */
export async function runAnswerVerification(items, apiKey) {
  const userPrompt = `Verify the following ${items.length} student answer(s) against the official IELTS answer key.

${JSON.stringify(items.map(it => ({
  id: it.id,
  question: it.questionText || '',
  questionType: it.questionType || '',
  instruction: it.instruction || '',
  officialAnswer: it.officialAnswer || '',
  studentAnswer: it.studentAnswer || '',
  wordLimit: it.wordLimit || null,
})), null, 2)}`;

  try {
    const text = await callGemini(AI_MODELS.primary, apiKey, ANSWER_VERIFIER_SYSTEM_PROMPT, userPrompt);
    const parsed = extractJsonFromText(text);
    if (parsed && Array.isArray(parsed.results)) {
      const valid = parsed.results.filter(r => r && r.id && ['CORRECT', 'INCORRECT', 'UNCERTAIN'].includes(r.decision));
      return { results: valid };
    }
  } catch (e) {
    if (e.status === 429) {
      return { results: [], rateLimited: true };
    }
  }
  return { results: [] };
}
