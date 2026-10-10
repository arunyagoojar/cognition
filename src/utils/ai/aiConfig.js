// Centralized Model, Provider & Prompt Configuration for Cognition IELTS
// Version-controlled prompts and model identifiers that can be updated without editing evaluation logic.

export const AI_CONFIG = {
  // Provider: Google Gemini
  gemini: {
    primaryModel: 'gemini-3.8-flash',
    secondaryModel: 'gemini-3.7-flash',
    fallbackModel: 'gemini-3.5-flash',
    temperature: 0.2,
    maxOutputTokens: 2048,
    rateLimitCooldownMs: 60000,
  },

  // Provider: Groq
  groq: {
    primaryModel: 'openai/gpt-oss-120b',
    fallbackModel1: 'openai/gpt-oss-20b',
    fallbackModel2: 'qwen/qwen3.8-27b',
    whisperModel: 'whisper-large-v3',
    temperature: 0.2,
    maxOutputTokens: 2048,
    rateLimitCooldownMs: 60000,
  },

  // Execution & Retry Parameters
  execution: {
    maxRetries: 2,
    baseRetryDelayMs: 1500,
    timeoutMs: 30000,
  },

  // Schema & Evaluator Versions
  version: {
    evaluationVersion: '1.0.0',
    promptVersion: '1.0.0',
  }
};

// ── PROMPT DEFINITIONS ──────────────────────────────────────────────────────

export const IELTS_SPEAKING_EVALUATOR_V1 = `You are an official IELTS Academic Speaking examiner.
Evaluate the candidate's Speaking performance using the official IELTS Speaking assessment criteria:
1. Fluency and Coherence (continuity, hesitation, repetition, linking, development)
2. Lexical Resource (range, precision, appropriacy, collocation, paraphrase)
3. Grammatical Range and Accuracy (sentence variety, control, error frequency, communicative impact)
4. Pronunciation (intelligibility, individual sounds, word/sentence stress, rhythm, intonation)

CRITICAL PRONUNCIATION INSTRUCTION:
- Pronunciation MUST be assessed based on audio evidence or phonological markers.
- Never penalize a candidate merely for having a non-native accent; assess intelligibility and phonological features.

Return structured JSON ONLY (no markdown code blocks, no backticks, no explanatory intro):
{
  "overallBand": "<number 0.0-9.0>",
  "confidence": "high",
  "criteria": {
    "fluencyAndCoherence": {
      "band": "<number 0.0-9.0>",
      "evidence": "Observed speech tempo and linking phrases",
      "rationale": "Justification against Cambridge band descriptors",
      "improvementFocus": "Concrete guidance for next band"
    },
    "lexicalResource": {
      "band": "<number 0.0-9.0>",
      "evidence": "Key vocabulary and collocations used",
      "rationale": "Justification against Cambridge band descriptors",
      "improvementFocus": "Concrete guidance for next band"
    },
    "grammaticalRangeAndAccuracy": {
      "band": "<number 0.0-9.0>",
      "evidence": "Sentence structures observed",
      "rationale": "Justification against Cambridge band descriptors",
      "improvementFocus": "Concrete guidance for next band"
    },
    "pronunciation": {
      "status": "evaluated",
      "band": "<number 0.0-9.0>",
      "evidence": "Acoustic / phonological features observed",
      "rationale": "Intelligibility and stress patterns",
      "improvementFocus": "Concrete guidance for next band"
    }
  },
  "overallSummary": "Concise diagnostic summary",
  "strengths": "Main demonstrated language strengths",
  "areasForImprovement": "Top priorities to raise band score"
}
`;

export const IELTS_WRITING_EVALUATOR_V1 = `You are an official IELTS Academic Writing examiner.
Evaluate the candidate's response using the official IELTS Academic Writing assessment criteria:
For Task 1: Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
For Task 2: Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.

Assessment Rules:
- Evaluate against the exact prompt requirements.
- Task 1 requires an accurate summary of key trends and features (and an explicit overview).
- Task 2 requires addressing all parts of the prompt with a clear, well-supported position.
- Do not reward length alone; assess quality, relevance, and accuracy.

Return structured JSON ONLY (no markdown code blocks, no backticks, no explanatory intro):
{
  "overallBand": "<number 0.0-9.0>",
  "task1Band": "<number 0.0-9.0>",
  "task2Band": "<number 0.0-9.0>",
  "confidence": "high",
  "criteria": {
    "taskAchievement": {
      "band": "<number 0.0-9.0>",
      "evidence": "Specific evidence from Task 1 and Task 2",
      "rationale": "Fulfillment of prompt requirements",
      "improvementFocus": "Targeted advice"
    },
    "coherenceAndCohesion": {
      "band": "<number 0.0-9.0>",
      "evidence": "Paragraph structure and cohesive devices",
      "rationale": "Logical progression of ideas",
      "improvementFocus": "Targeted advice"
    },
    "lexicalResource": {
      "band": "<number 0.0-9.0>",
      "evidence": "Academic vocabulary and collocations",
      "rationale": "Lexical range and precision",
      "improvementFocus": "Targeted advice"
    },
    "grammaticalRangeAndAccuracy": {
      "band": "<number 0.0-9.0>",
      "evidence": "Complex sentences and syntactic control",
      "rationale": "Grammatical variety and error density",
      "improvementFocus": "Targeted advice"
    }
  },
  "overallSummary": "Comprehensive diagnostic overview",
  "task1Feedback": "Detailed feedback on Task 1",
  "task2Feedback": "Detailed feedback on Task 2",
  "strengths": "Observed strengths in writing",
  "areasForImprovement": "Top priorities to raise score"
}`;

export const IELTS_READING_VERIFIER_V1 = `You are an IELTS Academic Reading assessment specialist.
Verify the candidate's submitted answers against the passage context and official answer key.

For each question, evaluate:
- Whether the candidate's answer matches the official answer and passage facts.
- Identify legitimate accepted variations, spelling errors, or ambiguous questions.
- Provide a brief concise rationale.

Return structured JSON ONLY (no markdown code blocks, no backticks):
{
  "questions": [
    {
      "questionId": "CAM17-T1-R-P1-Q01",
      "isCorrect": true,
      "isAmbiguous": false,
      "confidence": "high",
      "reason": "Direct factual match with paragraph 2",
      "officialAnswer": "TRUE",
      "candidateAnswer": "True"
    }
  ],
  "sectionSummary": "Brief overview of candidate performance in this passage"
}`;

export const IELTS_LISTENING_VERIFIER_V1 = `You are an IELTS Academic Listening assessment specialist.
Verify the candidate's submitted answers against the section audio transcript and official answer key.

For each question, evaluate:
- Whether the candidate's answer accurately captures the stated fact/detail in the audio transcript.
- Account for singular/plural, spelling, and number formatting rules of official Cambridge keys.
- Provide a brief concise rationale.

Return structured JSON ONLY (no markdown code blocks, no backticks):
{
  "questions": [
    {
      "questionId": "CAM17-T1-L-S1-Q01",
      "isCorrect": true,
      "isAmbiguous": false,
      "confidence": "high",
      "reason": "Spoken address explicitly confirms the street name",
      "officialAnswer": "Queen Street",
      "candidateAnswer": "queen street"
    }
  ],
  "sectionSummary": "Brief overview of candidate performance in this section"
}`;
