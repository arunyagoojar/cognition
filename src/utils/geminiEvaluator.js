// Central Gemini AI Evaluation Architecture for IELTS Writing & Speaking
// Adheres strictly to Official IELTS Band Descriptors, explicit lifecycle states, and JSON validation.
import { getAiCacheItem, setAiCacheItem } from './storage.js';

export const AI_CONFIG = {
  primaryModel: 'gemini-2.0-flash',
  fallbackModel: 'gemini-1.5-flash',
  temperature: 0.2,
  maxOutputTokens: 2048,
  rateLimitCooldownMs: 60000,
};

let lastRateLimitTime = 0;

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
    "fluencyAndCoherence": {
      "band": 7.0,
      "evidence": "Direct quote or observed pattern",
      "rationale": "Justification against band descriptors",
      "improvementFocus": "Targeted advice"
    },
    "lexicalResource": {
      "band": 7.0,
      "evidence": "Direct quote or observed pattern",
      "rationale": "Justification against band descriptors",
      "improvementFocus": "Targeted advice"
    },
    "grammaticalRangeAndAccuracy": {
      "band": 7.0,
      "evidence": "Direct quote or observed pattern",
      "rationale": "Justification against band descriptors",
      "improvementFocus": "Targeted advice"
    },
    "pronunciation": {
      "status": "insufficient_audio_evidence",
      "band": null,
      "evidence": "Text transcripts alone cannot substantiate acoustic phonological features.",
      "rationale": "Pronunciation assessment strictly requires direct audio frequency examination.",
      "improvementFocus": "Focus on word stress and connected speech cadence during live recording."
    }
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
    "taskAchievement": {
      "band": 7.0,
      "evidence": "Specific evidence from Task 1 and Task 2",
      "rationale": "Fulfillment of prompt requirements",
      "improvementFocus": "Targeted advice"
    },
    "coherenceAndCohesion": {
      "band": 7.0,
      "evidence": "Paragraphing and cohesive device usage",
      "rationale": "Logical progression of ideas",
      "improvementFocus": "Targeted advice"
    },
    "lexicalResource": {
      "band": 7.0,
      "evidence": "Collocations and academic terms used",
      "rationale": "Precision and lexical range",
      "improvementFocus": "Targeted advice"
    },
    "grammaticalRangeAndAccuracy": {
      "band": 7.0,
      "evidence": "Complex sentences and grammatical control",
      "rationale": "Error frequency and syntactic variety",
      "improvementFocus": "Targeted advice"
    }
  },
  "overallSummary": "Comprehensive assessment of the writing submission",
  "task1Feedback": "Detailed feedback on Task 1 report",
  "task2Feedback": "Detailed feedback on Task 2 essay",
  "strengths": "Observed strengths in writing",
  "areasForImprovement": "Key steps to raise score"
}`;

/**
 * Fast deterministic string hashing (DJB2) for request deduplication and caching.
 */
export function hashContent(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extracts and parses JSON from model response text safely.
 */
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

/**
 * Validates Speaking evaluation JSON schema.
 */
export function validateSpeakingEvaluationJson(data) {
  if (!data || typeof data !== 'object') return null;

  const band = Number(data.overallBand);
  if (isNaN(band) || band < 0 || band > 9.0) return null;

  if (!data.criteria || typeof data.criteria !== 'object') return null;

  const fc = data.criteria.fluencyAndCoherence?.band;
  const lr = data.criteria.lexicalResource?.band;
  const gr = (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange)?.band;

  if (typeof fc !== 'number' || typeof lr !== 'number' || typeof gr !== 'number') {
    return null;
  }

  // Normalize structure
  return {
    overallBand: Math.round(band * 2) / 2,
    confidence: data.confidence || 'high',
    criteria: {
      fluencyAndCoherence: {
        band: Math.round(fc * 2) / 2,
        evidence: data.criteria.fluencyAndCoherence.evidence || '',
        rationale: data.criteria.fluencyAndCoherence.rationale || '',
        improvementFocus: data.criteria.fluencyAndCoherence.improvementFocus || '',
      },
      lexicalResource: {
        band: Math.round(lr * 2) / 2,
        evidence: data.criteria.lexicalResource.evidence || '',
        rationale: data.criteria.lexicalResource.rationale || '',
        improvementFocus: data.criteria.lexicalResource.improvementFocus || '',
      },
      grammaticalRangeAndAccuracy: {
        band: Math.round(gr * 2) / 2,
        evidence: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).evidence || '',
        rationale: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).rationale || '',
        improvementFocus: (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange).improvementFocus || '',
      },
      pronunciation: {
        status: data.criteria.pronunciation?.status || 'insufficient_audio_evidence',
        band: typeof data.criteria.pronunciation?.band === 'number' ? Math.round(data.criteria.pronunciation.band * 2) / 2 : null,
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

/**
 * Validates Writing evaluation JSON schema.
 */
export function validateWritingEvaluationJson(data) {
  if (!data || typeof data !== 'object') return null;

  const band = Number(data.overallBand);
  if (isNaN(band) || band < 0 || band > 9.0) return null;

  if (!data.criteria || typeof data.criteria !== 'object') return null;

  const ta = (data.criteria.taskAchievement || data.criteria.taskResponse)?.band;
  const cc = data.criteria.coherenceAndCohesion?.band;
  const lr = data.criteria.lexicalResource?.band;
  const gr = (data.criteria.grammaticalRangeAndAccuracy || data.criteria.grammaticalRange)?.band;

  if (typeof ta !== 'number' || typeof cc !== 'number' || typeof lr !== 'number' || typeof gr !== 'number') {
    return null;
  }

  return {
    overallBand: Math.round(band * 2) / 2,
    task1Band: typeof data.task1Band === 'number' ? Math.round(data.task1Band * 2) / 2 : Math.round(band * 2) / 2,
    task2Band: typeof data.task2Band === 'number' ? Math.round(data.task2Band * 2) / 2 : Math.round(band * 2) / 2,
    confidence: data.confidence || 'high',
    criteria: {
      taskAchievement: {
        band: Math.round(ta * 2) / 2,
        evidence: (data.criteria.taskAchievement || data.criteria.taskResponse).evidence || '',
        rationale: (data.criteria.taskAchievement || data.criteria.taskResponse).rationale || '',
        improvementFocus: (data.criteria.taskAchievement || data.criteria.taskResponse).improvementFocus || '',
      },
      coherenceAndCohesion: {
        band: Math.round(cc * 2) / 2,
        evidence: data.criteria.coherenceAndCohesion.evidence || '',
        rationale: data.criteria.coherenceAndCohesion.rationale || '',
        improvementFocus: data.criteria.coherenceAndCohesion.improvementFocus || '',
      },
      lexicalResource: {
        band: Math.round(lr * 2) / 2,
        evidence: data.criteria.lexicalResource.evidence || '',
        rationale: data.criteria.lexicalResource.rationale || '',
        improvementFocus: data.criteria.lexicalResource.improvementFocus || '',
      },
      grammaticalRangeAndAccuracy: {
        band: Math.round(gr * 2) / 2,
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

/**
 * Minimal lightweight validation of a user-provided Gemini API key (2-token ping).
 */
export async function validateGeminiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'Gemini API key is required.' };
  }

  const trimmedKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.primaryModel}:generateContent?key=${trimmedKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 3 }
      })
    });

    if (res.ok) {
      return { success: true, message: '✓ Gemini connected' };
    }

    if (res.status === 429) {
      return { success: true, message: '✓ Gemini connected (Rate limited - ready for use)' };
    }

    if (res.status === 400 || res.status === 403 || res.status === 404) {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.fallbackModel}:generateContent?key=${trimmedKey}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 3 }
        })
      });

      if (fallbackRes.ok || fallbackRes.status === 429) {
        return { success: true, message: '✓ Gemini connected' };
      }
    }

    return { success: false, message: 'Gemini connection failed' };
  } catch (err) {
    return { success: false, message: 'Gemini connection failed' };
  }
}

/**
 * Authoritative AI Evaluation for IELTS Academic Writing.
 * Explicit states: 'not_started' | 'evaluating' | 'completed' | 'failed'.
 * When not completed, band remains strictly null.
 */
export async function evaluateWritingWithAI(apiKey, { task1Text = '', task2Text = '', prompts = {} }) {
  const t1Clean = (task1Text || '').trim();
  const t2Clean = (task2Text || '').trim();

  if (!t1Clean && !t2Clean) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'No essay content submitted for evaluation.',
    };
  }

  // Deduplication cache check
  const contentHash = `writing_${hashContent(`${t1Clean}___${t2Clean}___${prompts.task1 || ''}`)}`;
  const cached = getAiCacheItem(contentHash);
  if (cached && cached.evaluationStatus === 'completed') {
    return { ...cached, isCached: true };
  }

  if (!apiKey || !apiKey.trim()) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'AI evaluation unavailable. Please configure your Google Gemini API key in Settings.',
    };
  }

  const now = Date.now();
  if (now - lastRateLimitTime < AI_CONFIG.rateLimitCooldownMs) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      task1Band: null,
      task2Band: null,
      criteria: null,
      message: 'AI rate limit cooldown active (429). Please wait 60 seconds.',
    };
  }

  const t1Words = t1Clean ? t1Clean.split(/\s+/).length : 0;
  const t2Words = t2Clean ? t2Clean.split(/\s+/).length : 0;

  const userPrompt = `Evaluate the candidate's IELTS Academic Writing submission:
Task 1 Prompt: ${prompts.task1 || 'Academic visual/data report (150 words minimum)'}
Task 1 Candidate Response (${t1Words} words):
${t1Clean || '(No response submitted)'}

Task 2 Prompt: ${prompts.task2 || 'Academic discursive essay (250 words minimum)'}
Task 2 Candidate Response (${t2Words} words):
${t2Clean || '(No response submitted)'}`;

  const modelsToTry = [AI_CONFIG.primaryModel, AI_CONFIG.fallbackModel];

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: IELTS_WRITING_SYSTEM_PROMPT_V1 }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: AI_CONFIG.temperature,
            maxOutputTokens: AI_CONFIG.maxOutputTokens
          }
        })
      });

      if (res.status === 429) {
        lastRateLimitTime = Date.now();
        console.warn('Gemini 429 rate limit hit.');
        break;
      }

      if (res.ok) {
        const data = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = extractJsonFromText(candidateText);
        const validated = validateWritingEvaluationJson(parsed);

        if (validated) {
          const finalResult = {
            ...validated,
            band: validated.overallBand,
            evaluationStatus: 'completed',
            modelUsed: model,
            task1Words: t1Words,
            task2Words: t2Words,
            evaluatedAt: new Date().toISOString()
          };
          setAiCacheItem(contentHash, finalResult);
          return finalResult;
        }
      }
    } catch (e) {
      console.warn(`Evaluation with ${model} failed`, e);
    }
  }

  // Failure: do NOT invent scores. Band remains strictly null.
  return {
    evaluationStatus: 'failed',
    band: null,
    overallBand: null,
    task1Band: null,
    task2Band: null,
    criteria: null,
    message: 'AI evaluation failed to produce a valid IELTS rubric response. Check API key and network connection.',
  };
}

/**
 * Authoritative AI Evaluation for IELTS Academic Speaking.
 * Explicit states: 'not_started' | 'evaluating' | 'completed' | 'failed'.
 * When not completed, band remains strictly null.
 */
export async function evaluateSpeakingWithAI(apiKey, { transcripts = {}, testMeta = {}, durations = {} }) {
  const combinedSpeech = Object.values(transcripts || {}).filter(Boolean).join(' ').trim();
  const wordCount = combinedSpeech ? combinedSpeech.split(/\s+/).length : 0;

  if (wordCount < 10) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: 'Insufficient audio/transcript content recorded for evaluation (minimum 10 words required).',
    };
  }

  // Deduplication cache check
  const contentHash = `speaking_${hashContent(JSON.stringify(transcripts))}`;
  const cached = getAiCacheItem(contentHash);
  if (cached && cached.evaluationStatus === 'completed') {
    return { ...cached, isCached: true };
  }

  if (!apiKey || !apiKey.trim()) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: 'AI evaluation unavailable. Please configure your Google Gemini API key in Settings.',
    };
  }

  const now = Date.now();
  if (now - lastRateLimitTime < AI_CONFIG.rateLimitCooldownMs) {
    return {
      evaluationStatus: 'failed',
      band: null,
      overallBand: null,
      criteria: null,
      message: 'AI rate limit cooldown active (429). Please wait 60 seconds.',
    };
  }

  const userPrompt = `Candidate Responses by Part:
${JSON.stringify(transcripts, null, 2)}

Test Topic Context: ${testMeta?.title || 'IELTS Speaking Academic Interview'}`;

  const modelsToTry = [AI_CONFIG.primaryModel, AI_CONFIG.fallbackModel];

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: IELTS_SPEAKING_SYSTEM_PROMPT_V1 }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: AI_CONFIG.temperature,
            maxOutputTokens: AI_CONFIG.maxOutputTokens
          }
        })
      });

      if (res.status === 429) {
        lastRateLimitTime = Date.now();
        console.warn('Gemini 429 rate limit hit.');
        break;
      }

      if (res.ok) {
        const data = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = extractJsonFromText(candidateText);
        const validated = validateSpeakingEvaluationJson(parsed);

        if (validated) {
          const finalResult = {
            ...validated,
            band: validated.overallBand,
            evaluationStatus: 'completed',
            modelUsed: model,
            evaluatedAt: new Date().toISOString()
          };
          setAiCacheItem(contentHash, finalResult);
          return finalResult;
        }
      }
    } catch (e) {
      console.warn(`Evaluation with ${model} failed`, e);
    }
  }

  // Failure: do NOT invent scores. Band remains strictly null.
  return {
    evaluationStatus: 'failed',
    band: null,
    overallBand: null,
    criteria: null,
    message: 'AI evaluation failed to produce a valid IELTS rubric response. Check API key and network connection.',
  };
}
