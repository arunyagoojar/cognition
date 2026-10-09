/**
 * Opt-In Live IELTS AI Model Evaluation Test Harness
 *
 * Separated from deterministic CI suite (`npm test`).
 * Validates actual live responses against schemas and descriptor expectations
 * WITHOUT hardcoding favorable or artificial band scores.
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... node scripts/live_evaluation_harness.mjs
 *   GEMINI_API_KEY=AIza... node scripts/live_evaluation_harness.mjs
 */
import assert from 'node:assert/strict';
import {
  WRITING_SYSTEM_PROMPT_V2, SPEAKING_SYSTEM_PROMPT_V2, ANSWER_VERIFIER_SYSTEM_PROMPT,
  buildWritingUserPrompt, buildSpeakingUserPrompt, buildAnswerVerifierUserPrompt,
  normalizeWritingEvaluation, normalizeSpeakingEvaluation
} from '../src/utils/ieltsRubric.js';

const groqKey = process.env.GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!groqKey && !geminiKey) {
  console.log('------------------------------------------------------------');
  console.log('OPT-IN LIVE MODEL EVALUATION HARNESS');
  console.log('------------------------------------------------------------');
  console.log('No API key provided. Skipping live network tests.');
  console.log('To run against live providers, set GROQ_API_KEY or GEMINI_API_KEY:');
  console.log('  GROQ_API_KEY=gsk_... node scripts/live_evaluation_harness.mjs');
  console.log('  GEMINI_API_KEY=AIza... node scripts/live_evaluation_harness.mjs');
  console.log('------------------------------------------------------------');
  process.exit(0);
}

function extractJson(text) {
  if (!text) return null;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try { return JSON.parse(match[1].trim()); } catch (_) {}
  }
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch (_) {}
  }
  return null;
}

async function callProvider(systemPrompt, userPrompt) {
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) throw new Error(`Groq call failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content, provider: 'groq', model: 'openai/gpt-oss-120b' };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini call failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { text: data.candidates?.[0]?.content?.parts?.[0]?.text, provider: 'gemini', model: 'gemini-2.5-flash' };
}

async function run() {
  console.log(`Running live model evaluation harness using ${groqKey ? 'Groq' : 'Gemini'}...`);

  // 1. Live Answer Verification
  console.log('\n[1/3] Testing Live Answer Verification...');
  const items = [
    {
      id: 'item-1',
      questionText: 'The library opens on ____ mornings.',
      instruction: 'NO MORE THAN ONE WORD',
      officialAnswer: 'Monday',
      studentAnswer: 'monday'
    },
    {
      id: 'item-2',
      questionText: 'Distance to destination is ____ km.',
      instruction: 'ONE WORD OR A NUMBER',
      officialAnswer: '15',
      studentAnswer: '50'
    }
  ];
  const verifierPrompt = buildAnswerVerifierUserPrompt(items);
  const verifierRes = await callProvider(ANSWER_VERIFIER_SYSTEM_PROMPT, verifierPrompt);
  const verifierJson = extractJson(verifierRes.text);
  assert.ok(verifierJson && Array.isArray(verifierJson.results), 'Answer verifier must return { results: [...] }');
  const r1 = verifierJson.results.find(r => r.id === 'item-1');
  const r2 = verifierJson.results.find(r => r.id === 'item-2');
  assert.equal(r1?.decision, 'CORRECT', 'Exact word case difference should be accepted as CORRECT');
  assert.equal(r2?.decision, 'INCORRECT', 'Different number (15 vs 50) must be INCORRECT');
  console.log('  ✓ Answer Verification responded with valid schema and sound decisions.');

  // 2. Live Writing Evaluation Schema & Whole-Band Criteria
  console.log('\n[2/3] Testing Live Writing Evaluation...');
  const writingPrompt = buildWritingUserPrompt({
    prompts: {
      task1: 'The chart shows water consumption across three countries in 2020.',
      task2: 'Some believe universities should only focus on practical work skills. Discuss both views.'
    },
    task1Text: 'The bar chart details water usage in 2020. Overall, Country A used significantly more water than others.',
    task2Text: 'Higher education serves various purposes in modern society. While vocational preparation is essential, academic inquiry remains equally valuable.'
  });
  const writingRes = await callProvider(WRITING_SYSTEM_PROMPT_V2, writingPrompt);
  const writingJson = extractJson(writingRes.text);
  assert.ok(writingJson, 'Writing response must be valid JSON');
  assert.ok(writingJson.task1 && writingJson.task2, 'Writing response must contain task1 and task2');
  const normWriting = normalizeWritingEvaluation(writingJson, { task1Words: 18, task2Words: 22 });
  assert.ok(normWriting, 'normalizeWritingEvaluation must parse live response without error');
  // Both tasks are ≤20 words: verified under 20-word rule
  assert.equal(normWriting.task1Band, 1, 'Task 1 (18 words) must be Band 1 per official 20-word rule');
  console.log('  ✓ Writing evaluation returned complete criteria schema and parsed successfully.');

  // 3. Live Speaking Evaluation Schema & Pronunciation Exemption
  console.log('\n[3/3] Testing Live Speaking Evaluation...');
  const speakingPrompt = buildSpeakingUserPrompt({
    transcripts: {
      '0_0': 'I live in a quiet neighborhood near the city center with my family.',
      '1_0': 'I would like to describe a historic building I visited last summer in Kyoto.'
    },
    testMeta: { title: 'Practice Speaking Test' }
  });
  const speakingRes = await callProvider(SPEAKING_SYSTEM_PROMPT_V2, speakingPrompt);
  const speakingJson = extractJson(speakingRes.text);
  assert.ok(speakingJson && speakingJson.criteria, 'Speaking response must contain criteria');
  assert.equal(speakingJson.criteria.pronunciation?.band, null, 'Model must return null for pronunciation on transcript');
  const normSpeaking = normalizeSpeakingEvaluation(speakingJson, { audioAssessed: false });
  assert.ok(normSpeaking, 'normalizeSpeakingEvaluation must parse live response');
  assert.equal(normSpeaking.provisional, true, 'Speaking band must be flagged provisional when audio unassessed');
  console.log('  ✓ Speaking evaluation returned expected schema and respected pronunciation null rule.');

  console.log('\nAll live model checks passed successfully!');
}

run().catch(err => {
  console.error('\nLive model harness failed:', err);
  process.exit(1);
});
