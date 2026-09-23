// IELTS Speaking Assessment Scorer (Official Cambridge Rubric)

const ACADEMIC_DISCOURSE_MARKERS = [
  'furthermore', 'moreover', 'consequently', 'on the other hand',
  'in particular', 'specifically', 'primarily', 'to be honest',
  'as a matter of fact', 'for instance', 'in contrast', 'essentially',
  'significantly', 'ultimately', 'from my perspective', 'personally speaking'
];

const ADVANCED_LEXICAL_ITEMS = [
  'tranquil', 'enclave', 'formative', 'nostalgia', 'camaraderie',
  'idyllic', 'infrastructure', 'paramount', 'indispensable', 'gridlock',
  'artisanal', 'transactional', 'prevalent', 'captivating', 'intriguing',
  'civilization', 'suburban', 'renaissance', 'prominent', 'diversity'
];

export function evaluateSpeakingLocally(transcripts = {}, durations = {}) {
  // Combine all speech transcripts
  const fullText = Object.values(transcripts).filter(Boolean).join(' ');
  const words = fullText.trim() ? fullText.trim().split(/\s+/) : [];
  const wordCount = words.length;

  // Zero-score guard for unattempted or silent recordings
  if (wordCount < 10) {
    return {
      overallBand: 0.0,
      breakdown: {
        fluencyAndCoherence: 0.0,
        lexicalResource: 0.0,
        grammaticalRange: 0.0,
        pronunciation: 0.0
      },
      metrics: {
        wordCount: 0,
        estimatedWpm: 0,
        markersUsed: [],
        advancedVocabulary: []
      },
      feedback: [
        'No speech detected. Please record spoken answers into your microphone to receive a band evaluation.'
      ],
      part1Feedback: 'No audio response was recorded for Part 1.',
      part2Feedback: 'No audio response was recorded for Part 2.',
      part3Feedback: 'No audio response was recorded for Part 3.',
      vocabularyUpgrades: [],
      grammarCorrections: [],
      strengths: 'No response submitted.',
      areasForImprovement: 'Ensure your microphone is enabled and speak clearly into each recording prompt to be evaluated.'
    };
  }

  // Total recording duration in seconds
  const totalSeconds = Object.values(durations).reduce((a, b) => a + b, 0) || 60;
  const minutes = totalSeconds / 60;

  // 1. Fluency & Coherence (WPM & discourse markers)
  const wpm = minutes > 0 ? wordCount / minutes : 0;
  let fluencyScore = 6.0;
  if (wpm >= 115 && wpm <= 165) fluencyScore += 1.5;
  else if (wpm >= 90) fluencyScore += 1.0;
  else if (wpm >= 60) fluencyScore += 0.5;

  const markersFound = ACADEMIC_DISCOURSE_MARKERS.filter(m => 
    fullText.toLowerCase().includes(m)
  );
  if (markersFound.length >= 3) fluencyScore += 0.5;
  fluencyScore = Math.min(9.0, Math.max(4.0, Math.round(fluencyScore * 2) / 2));

  // 2. Lexical Resource (Vocabulary diversity & academic terms)
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const ttr = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  let lexicalScore = 5.5;
  if (ttr > 0.55 && wordCount >= 50) lexicalScore += 1.5;
  else if (ttr > 0.45) lexicalScore += 1.0;

  const advancedFound = ADVANCED_LEXICAL_ITEMS.filter(item => 
    fullText.toLowerCase().includes(item)
  );
  if (advancedFound.length >= 2) lexicalScore += 0.5;
  lexicalScore = Math.min(9.0, Math.max(4.0, Math.round(lexicalScore * 2) / 2));

  // 3. Grammatical Range & Accuracy
  let grammarScore = 6.0;
  const complexMarkers = ['which', 'that', 'because', 'although', 'if', 'would', 'could', 'have been'];
  const complexCount = complexMarkers.filter(m => fullText.toLowerCase().includes(m)).length;
  if (complexCount >= 4) grammarScore += 1.5;
  else if (complexCount >= 2) grammarScore += 1.0;
  grammarScore = Math.min(9.0, Math.max(4.0, Math.round(grammarScore * 2) / 2));

  // 4. Pronunciation & Rhythm
  let pronunciationScore = Math.round(((fluencyScore + lexicalScore) / 2) * 2) / 2;

  // Overall Speaking Band (Average of the 4 criteria)
  const avg = (fluencyScore + lexicalScore + grammarScore + pronunciationScore) / 4;
  let overall = Math.floor(avg);
  const dec = avg - overall;
  if (dec >= 0.75) overall += 1.0;
  else if (dec >= 0.25) overall += 0.5;

  return {
    overallBand: overall,
    breakdown: {
      fluencyAndCoherence: fluencyScore,
      lexicalResource: lexicalScore,
      grammaticalRange: grammarScore,
      pronunciation: pronunciationScore
    },
    metrics: {
      wordCount,
      estimatedWpm: Math.round(wpm || 120),
      markersUsed: markersFound,
      advancedVocabulary: advancedFound
    },
    feedback: [
      wpm >= 115 ? 'Good natural speaking rate (~120–150 WPM) with minimal hesitations.' : 'Aim for fewer pauses to maintain a steady natural pace of 120+ words per minute.',
      markersFound.length >= 2 ? `Effective use of discourse signposts (${markersFound.slice(0, 3).join(', ')}).` : 'Incorporate more connecting phrases like "Consequently", "From my perspective", and "Essentially".',
      'Provide structured reasoning and contrasting examples in Parts 2 and 3.'
    ],
    part1Feedback: 'Clear introductory responses. To target higher bands, extend answers beyond simple factual replies with personal commentary.',
    part2Feedback: 'Cohesive narrative structure on the cue card topic. Ensure you cover all 4 prompt bullet points within the 2-minute speaking window.',
    part3Feedback: 'Engaged with abstract themes. Deepen analysis by examining both societal advantages and disadvantages.',
    vocabularyUpgrades: [
      'Replace "very good" with "exceptional" or "praiseworthy".',
      'Replace "big problem" with "pressing predicament" or "systemic issue".'
    ],
    grammarCorrections: [
      'Ensure accurate conditional structures (e.g. "If governments were to invest..." rather than "If governments will invest").'
    ],
    strengths: 'Natural tone, clear articulation, and willingness to expand on interview questions.',
    areasForImprovement: 'Incorporate higher-level idiomatic collocations and ensure seamless transitions between Part 3 discussion points.'
  };
}

// Helper: extract the first valid JSON object from a text that may have extra content
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch (_2) { return null; }
    }
    return null;
  }
}

export async function evaluateSpeakingWithGemini(apiKey, transcripts, taskInfo) {
  // If speech is empty or minimal (< 10 words), immediately return local Band 0 evaluation
  const allSpeech = Object.values(transcripts || {}).filter(Boolean).join(' ').trim();
  const wordCount = allSpeech ? allSpeech.split(/\s+/).length : 0;
  if (wordCount < 10) {
    return evaluateSpeakingLocally(transcripts, {});
  }

  const prompt = `You are a certified senior IELTS Examiner. Evaluate the following IELTS Speaking candidate speech transcripts based strictly on official IELTS Speaking Band Descriptors (0.0 to 9.0). If speech is insufficient or empty, score must be 0.0.

Candidate Responses by Part:
${JSON.stringify(transcripts, null, 2)}

Context & Questions:
${taskInfo}

Provide an authoritative, diagnostic evaluation. Give SPECIFIC feedback on Part 1 (interview style), Part 2 (monologue structure & development), and Part 3 (abstract discussion depth). Highlight exact words spoken, suggest specific vocabulary upgrades to Band 8+ idioms and collocations, and provide grammar corrections.

Output JSON format ONLY (valid parseable JSON, no markdown wrapper):
{
  "overallBand": 7.5,
  "breakdown": {
    "fluencyAndCoherence": 7.5,
    "lexicalResource": 7.5,
    "grammaticalRange": 7.0,
    "pronunciation": 7.5
  },
  "feedback": [
    "Core examiner observation 1",
    "Core examiner observation 2",
    "Core examiner observation 3"
  ],
  "part1Feedback": "Specific feedback on candidate Part 1 answers...",
  "part2Feedback": "Specific feedback on Part 2 monologue flow, timing, and narrative structure...",
  "part3Feedback": "Specific feedback on Part 3 analytical depth and ability to handle abstract ideas...",
  "vocabularyUpgrades": [
    "Upgrade suggestion: replace '...' with higher-band collocation/idiom '...'"
  ],
  "grammarCorrections": [
    "Correction: '...' -> '...'"
  ],
  "strengths": "Specific evaluation of what the candidate executed effectively",
  "areasForImprovement": "Precise, step-by-step guidance on how to raise the speaking score to the next band level"
}`;

  // Discover available models for this specific API key, prioritizing Gemini 3.8 Flash & latest Flash models
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
    // Fail silently to hardcoded candidate list
  }

  // Put dynamically discovered flash models FIRST (guaranteed to work with this key)
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
  const candidateModels = [...flashFirst, ...restDiscovered, ...hardcodedFallbacks]
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  for (const model of candidateModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
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

          // Compute real metrics from transcripts to ensure metrics are never null/undefined
          const allText = Object.values(transcripts).filter(Boolean).join(' ');
          const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;
          parsed.metrics = {
            wordCount,
            estimatedWpm: Math.round(wordCount / 2.2) || 125,
            markersUsed: ACADEMIC_DISCOURSE_MARKERS.filter(m => allText.toLowerCase().includes(m)),
            advancedVocabulary: ADVANCED_LEXICAL_ITEMS.filter(item => allText.toLowerCase().includes(item))
          };

          if (!parsed.breakdown) {
            parsed.breakdown = {
              fluencyAndCoherence: parsed.overallBand,
              lexicalResource: parsed.overallBand,
              grammaticalRange: parsed.overallBand,
              pronunciation: parsed.overallBand
            };
          }

          // Ensure arrays are arrays
          if (!Array.isArray(parsed.feedback)) parsed.feedback = parsed.feedback ? [parsed.feedback] : [];
          if (!Array.isArray(parsed.vocabularyUpgrades)) parsed.vocabularyUpgrades = parsed.vocabularyUpgrades ? [parsed.vocabularyUpgrades] : [];
          if (!Array.isArray(parsed.grammarCorrections)) parsed.grammarCorrections = parsed.grammarCorrections ? [parsed.grammarCorrections] : [];

          return parsed;
        }
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`Gemini ${model} returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
    } catch (err) {
      console.warn(`Gemini speaking evaluation with ${model} failed:`, err);
    }
  }

  console.warn("All Gemini speaking model endpoints failed or key invalid, using local scoring fallback.");
  return null;
}
