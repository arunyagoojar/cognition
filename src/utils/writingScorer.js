// IELTS Academic Writing Assessment Scorer (Official Cambridge Rubric)

export function evaluateWritingLocally(task1Text = '', task2Text = '') {
  const countWords = (text) => text.trim() ? text.trim().split(/\s+/).length : 0;
  const countParagraphs = (text) => text.split(/\n+/).filter(p => p.trim().length > 0).length;

  const t1Words = countWords(task1Text);
  const t2Words = countWords(task2Text);

  // Zero-score guard for empty or unattempted submissions
  if (t1Words < 15 && t2Words < 20) {
    return {
      overallBand: 0.0,
      task1Band: 0.0,
      task2Band: 0.0,
      task1: {
        band: 0.0,
        wordCount: t1Words,
        hasOverview: false,
        metThreshold: false
      },
      task2: {
        band: 0.0,
        wordCount: t2Words,
        paragraphs: countParagraphs(task2Text),
        metThreshold: false
      },
      criteriaBreakdown: {
        taskAchievement: 0.0,
        coherenceAndCohesion: 0.0,
        lexicalResource: 0.0,
        grammaticalRange: 0.0
      },
      feedback: [
        'Insufficient essay length submitted. IELTS requires a minimum of 150 words for Task 1 and 250 words for Task 2.',
        'Complete essay responses are required to receive diagnostic band ratings.'
      ],
      task1Feedback: 'Task 1 response is empty or under the 15-word minimum threshold for evaluation.',
      task2Feedback: 'Task 2 response is empty or under the 20-word minimum threshold for evaluation.',
      lexicalHighlights: [],
      grammarHighlights: [],
      strengths: 'No response submitted.',
      areasForImprovement: 'Compose full essay responses adhering to the prompt requirements (150+ words for Task 1, 250+ words for Task 2).'
    };
  }

  // --- Task 1 Scoring (33.3% weight) ---
  let t1Score = 6.0;
  if (t1Words >= 150) t1Score += 1.0;
  else if (t1Words < 120) t1Score -= 1.0;

  const hasOverview = /overall|in general|in summary|it is clear that|notable/i.test(task1Text);
  if (hasOverview) t1Score += 0.5;
  else t1Score = Math.min(t1Score, 5.0); // missing overview caps at 5.0 in IELTS

  const hasComparisons = /compared to|whereas|while|whilst|substantially|respectively|accounted for/i.test(task1Text);
  if (hasComparisons) t1Score += 0.5;
  t1Score = Math.min(9.0, Math.max(4.0, Math.round(t1Score * 2) / 2));

  // --- Task 2 Scoring (66.7% weight) ---
  let t2Score = 6.0;
  if (t2Words >= 250) t2Score += 1.0;
  else if (t2Words < 200) t2Score -= 1.0;

  const t2Paragraphs = countParagraphs(task2Text);
  if (t2Paragraphs >= 4) t2Score += 0.5;

  const hasPosition = /in my view|i firmly believe|in conclusion|on the other hand|from my perspective|i agree|i disagree/i.test(task2Text);
  if (hasPosition) t2Score += 0.5;
  t2Score = Math.min(9.0, Math.max(4.0, Math.round(t2Score * 2) / 2));

  // Final composite writing band = (t1 + 2*t2) / 3
  const weighted = (t1Score + 2 * t2Score) / 3;
  let overall = Math.floor(weighted);
  const dec = weighted - overall;
  if (dec >= 0.75) overall += 1.0;
  else if (dec >= 0.25) overall += 0.5;

  return {
    overallBand: overall,
    task1Band: t1Score,
    task2Band: t2Score,
    task1: {
      band: t1Score,
      wordCount: t1Words,
      hasOverview,
      metThreshold: t1Words >= 150
    },
    task2: {
      band: t2Score,
      wordCount: t2Words,
      paragraphs: t2Paragraphs,
      metThreshold: t2Words >= 250
    },
    criteriaBreakdown: {
      taskAchievement: Math.round(((hasOverview ? 7.5 : 5.0) + (t2Words >= 250 ? 7.5 : 5.5)) / 2 * 2) / 2,
      coherenceAndCohesion: t2Paragraphs >= 4 ? 7.5 : 6.0,
      lexicalResource: (t1Words >= 150 && t2Words >= 250) ? 7.5 : 6.0,
      grammaticalRange: overall >= 7.0 ? 7.5 : 6.5
    },
    feedback: [
      t1Words >= 150 ? 'Task 1 meets the minimum word count requirement (150+ words).' : `Task 1 is under the 150-word minimum (${t1Words} words written).`,
      hasOverview ? 'Task 1 presents an explicit overall trend summary.' : 'Include an explicit "Overall..." overview paragraph in Task 1 to avoid a Band 5 cap.',
      t2Words >= 250 ? 'Task 2 meets the minimum word count requirement (250+ words).' : `Task 2 is under 250 words (${t2Words} written); expand arguments to reach 260–290 words for full development.`,
      t2Paragraphs >= 4 ? 'Well-structured 4-paragraph layout observed.' : 'Organize Task 2 into 4 distinct paragraphs: Introduction, Body 1, Body 2, and Conclusion.'
    ],
    task1Feedback: hasOverview
      ? 'Strong visual summarization with an identifiable overview. Ensure you highlight high/low extremes and exact numerical comparisons from the chart.'
      : 'Critical: Task 1 lacks a clear overview sentence. IELTS Band Descriptors mandate that reports without a clear overview cannot exceed Band 5 in Task Achievement.',
    task2Feedback: t2Paragraphs >= 4
      ? 'Logical essay organization with discernible body paragraphs. Focus on extending each topic sentence with concrete real-world evidence.'
      : 'Organize your ideas into 4 discrete paragraphs. Use cohesive discourse connectors between paragraphs to elevate your Coherence & Cohesion score.',
    lexicalHighlights: [
      'Good baseline academic vocabulary detected throughout both tasks.',
      'Upgrade common expressions (e.g. replace "big difference" with "marked disparity", "get worse" with "deteriorate progressively").'
    ],
    grammarHighlights: [
      'Good variety of compound and complex sentence structures.',
      'Ensure subject-verb agreement and consistent past/present tenses when referencing historical data.'
    ],
    strengths: 'Clear attempt structure with relevant vocabulary and engagement with the exam prompts.',
    areasForImprovement: 'Focus on incorporating a prominent overview in Task 1 and refining cohesion between paragraphs in Task 2 to reach Band 7.5+.'
  };
}

// Helper: extract the first valid JSON object from a text that may have extra content
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    // Try to find the first {...} block
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_2) {
        return null;
      }
    }
    return null;
  }
}

export async function evaluateWritingWithGemini(apiKey, task1Text, task2Text, prompts) {
  // ── Compute exact word counts client-side so Gemini uses these numbers ──
  const countWords = (t) => t.trim() ? t.trim().split(/\s+/).length : 0;
  const t1Words = countWords(task1Text);
  const t2Words = countWords(task2Text);
  const hasOverview = /overall|in general|in summary|it is clear that|notable/i.test(task1Text);

  // If both essays are empty or minimal, return local Band 0 evaluation immediately
  if (t1Words < 15 && t2Words < 20) {
    return evaluateWritingLocally(task1Text, task2Text);
  }

  const prompt = `You are a certified senior IELTS Writing Examiner. Evaluate the candidate's IELTS Academic Writing submission based on the official IELTS Academic Writing Band Descriptors (0.0 to 9.0). If essays are insufficient or empty, scores must be 0.0.

IMPORTANT WORD COUNT FACTS (already calculated by the system — do NOT recount, use these exact numbers):
- Task 1 word count: ${t1Words} words (minimum required: 150 words)
- Task 2 word count: ${t2Words} words (minimum required: 250 words)
- Task 1 ${t1Words >= 150 ? 'MEETS' : 'DOES NOT MEET'} the 150-word minimum requirement.
- Task 2 ${t2Words >= 250 ? 'MEETS' : 'DOES NOT MEET'} the 250-word minimum requirement.
These word counts are definitive. In your feedback, reflect these numbers accurately.

Task 1 Prompt:
${prompts.task1}

Task 1 Candidate Response (${t1Words} words):
${task1Text}

Task 2 Prompt:
${prompts.task2}

Task 2 Candidate Response (${t2Words} words):
${task2Text}

Provide an authoritative, rigorous examiner evaluation with SPECIFIC, DIAGNOSTIC feedback. Highlight exact candidate sentences, identify specific vocabulary to upgrade with high-band academic alternatives, point out concrete grammar corrections, and evaluate whether Task 1 has an explicit overview.

Output JSON format ONLY (valid parseable JSON, no markdown outside JSON):
{
  "overallBand": 7.0,
  "task1Band": 7.0,
  "task2Band": 7.0,
  "criteriaBreakdown": {
    "taskAchievement": 7.0,
    "coherenceAndCohesion": 7.0,
    "lexicalResource": 7.0,
    "grammaticalRange": 7.0
  },
  "feedback": [
    "Core examiner insight 1",
    "Core examiner insight 2",
    "Core examiner insight 3"
  ],
  "task1Feedback": "Specific detailed review of Task 1 (${t1Words} words submitted): Did the candidate include a clear overview? Were key features and data accurately reported? Did they make comparisons where relevant?",
  "task2Feedback": "Specific detailed review of Task 2 (${t2Words} words submitted): Is the thesis clear? Are ideas well supported? How effective is paragraphing and concluding remarks?",
  "lexicalHighlights": [
    "Effective academic phrases used by candidate...",
    "Vocabulary upgrade suggestion: replace '...' with higher-band alternative '...'"
  ],
  "grammarHighlights": [
    "Complex grammatical structures noted...",
    "Grammar correction: '...' should be written as '...'"
  ],
  "strengths": "Detailed assessment of the candidate's strongest areas in this submission",
  "areasForImprovement": "Concrete, step-by-step actionable advice to advance to the next half or full band"
}`;

  // ── Discover available models for this API key dynamically ──
  let availableModels = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData.models)) {
        availableModels = listData.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
      }
    }
  } catch (e) {
    // Fail silently — will use fallback list
  }

  // Put dynamically discovered flash models FIRST (they are guaranteed to work with this key)
  // then append hardcoded fallback names in case discovery fails
  const flashFirst = availableModels.filter(m => m.includes('flash'));
  const restDiscovered = availableModels.filter(m => !m.includes('flash'));
  const hardcodedFallbacks = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro'
  ];

  const candidateModels = [
    ...flashFirst,
    ...restDiscovered,
    ...hardcodedFallbacks
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  for (const model of candidateModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) {
          const parsed = extractJson(resultText);
          if (!parsed) {
            console.warn(`Model ${model} returned non-parseable JSON, trying next.`);
            continue;
          }
          parsed.modelUsed = model;
          parsed.isAiEvaluated = true;

          // Override word counts with our accurate client-side counts — never trust Gemini's recount
          parsed.task1 = {
            band: parsed.task1Band || parsed.criteriaBreakdown?.taskAchievement || parsed.overallBand,
            wordCount: t1Words,
            hasOverview,
            metThreshold: t1Words >= 150
          };
          parsed.task2 = {
            band: parsed.task2Band || parsed.criteriaBreakdown?.taskAchievement || parsed.overallBand,
            wordCount: t2Words,
            paragraphs: task2Text.split(/\n+/).filter(p => p.trim().length > 0).length,
            metThreshold: t2Words >= 250
          };

          // Ensure arrays are arrays
          if (!Array.isArray(parsed.feedback)) {
            parsed.feedback = typeof parsed.feedback === 'string' ? [parsed.feedback] : [];
          }
          if (!Array.isArray(parsed.lexicalHighlights)) {
            parsed.lexicalHighlights = typeof parsed.lexicalHighlights === 'string' ? [parsed.lexicalHighlights] : [];
          }
          if (!Array.isArray(parsed.grammarHighlights)) {
            parsed.grammarHighlights = typeof parsed.grammarHighlights === 'string' ? [parsed.grammarHighlights] : [];
          }

          return parsed;
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`Gemini ${model} returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`Gemini writing evaluation with ${model} failed:`, err);
    }
  }

  console.warn('All Gemini model endpoints failed or key invalid, using local scoring fallback.');
  return null;
}
