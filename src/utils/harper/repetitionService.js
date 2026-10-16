/**
 * IELTS Repetition & Lexical Resource Engine
 * Detects overused words, calculates lexical diversity,
 * provides high-band academic synonyms, and generates habit-building tips.
 */

export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'also', 'will', 'just', 'well', 'etc'
]);

/**
 * Curated IELTS Academic Synonym Database
 * Mapped to standard lemmas/roots for instant lookup
 */
export const IELTS_SYNONYMS = {
  // Task 1: Trends, Changes & Visual Data
  increase: ['surge', 'escalate', 'climb', 'rise', 'soar', 'expand', 'show an upward trend'],
  increases: ['surges', 'escalates', 'climbs', 'rises', 'soars', 'shows an upward trend'],
  increased: ['surged', 'escalated', 'climbed', 'rose', 'soared', 'experienced growth'],
  increasing: ['surging', 'escalating', 'rising', 'soaring', 'expanding', 'trending upward'],
  decrease: ['decline', 'plummet', 'drop', 'dwindle', 'contract', 'show a downward trend'],
  decreases: ['declines', 'plummets', 'drops', 'dwindles', 'contracts'],
  decreased: ['declined', 'plummeted', 'dropped', 'dwindled', 'contracted', 'slumped'],
  decreasing: ['declining', 'plummeting', 'dropping', 'dwindling', 'diminishing'],
  fluctuate: ['oscillate', 'vacillate', 'vary', 'shift intermittently', 'display volatility'],
  fluctuated: ['oscillated', 'vacillated', 'varied', 'shifted erratically'],
  fluctuating: ['oscillating', 'vacillating', 'varying', 'unstable'],
  show: ['illustrate', 'depict', 'demonstrate', 'elucidate', 'reveal', 'outline', 'delineate'],
  shows: ['illustrates', 'depicts', 'demonstrates', 'elucidates', 'reveals', 'outlines'],
  showed: ['illustrated', 'depicted', 'demonstrated', 'elucidated', 'revealed'],
  showing: ['illustrating', 'depicting', 'demonstrating', 'elucidating', 'revealing'],
  big: ['substantial', 'considerable', 'monumental', 'significant', 'pronounced', 'sizable'],
  huge: ['massive', 'vast', 'enormous', 'substantial', 'monumental'],
  small: ['marginal', 'negligible', 'minimal', 'modest', 'nominal', 'fractional'],
  see: ['witness', 'observe', 'register', 'note', 'record', 'experience'],
  seen: ['witnessed', 'observed', 'registered', 'recorded', 'experienced'],

  // Task 2: Academic Arguments & Discourse
  important: ['crucial', 'essential', 'vital', 'paramount', 'pivotal', 'imperative', 'indispensable'],
  importance: ['significance', 'salience', 'prominence', 'relevance'],
  people: ['individuals', 'citizens', 'the public', 'society', 'residents', 'consumers', 'the populace'],
  person: ['individual', 'citizen', 'member of society'],
  problem: ['dilemma', 'challenge', 'impediment', 'complication', 'obstacle', 'setback'],
  problems: ['dilemmas', 'challenges', 'impediments', 'complications', 'obstacles'],
  solution: ['remedy', 'countermeasure', 'resolution', 'intervention', 'panacea'],
  solutions: ['remedies', 'countermeasures', 'resolutions', 'interventions'],
  good: ['beneficial', 'advantageous', 'constructive', 'exemplary', 'salutary', 'viable'],
  bad: ['detrimental', 'adverse', 'disadvantageous', 'pernicious', 'deleterious', 'damaging'],
  think: ['contend', 'argue', 'assert', 'posit', 'maintain', 'advocate', 'surmise'],
  believes: ['contends', 'asserts', 'maintains', 'posits', 'argues'],
  opinion: ['stance', 'viewpoint', 'perspective', 'conviction', 'outlook'],
  many: ['numerous', 'a multitude of', 'a plethora of', 'abundant', 'copious', 'diverse'],
  'a lot of': ['a considerable volume of', 'a substantial amount of', 'an abundance of'],
  very: ['exceedingly', 'remarkably', 'exceptionally', 'profoundly', 'considerably', 'substantially'],
  change: ['transformation', 'transition', 'alteration', 'shift', 'overhaul', 'evolution'],
  changes: ['transformations', 'transitions', 'alterations', 'shifts', 'overhauls'],
  help: ['facilitate', 'bolster', 'assist', 'foster', 'nurture', 'enhance'],
  helps: ['facilitates', 'bolsters', 'assists', 'fosters', 'enhances'],
  helped: ['facilitated', 'bolstered', 'assisted', 'fostered', 'supported'],
  make: ['generate', 'produce', 'yield', 'formulate', 'establish', 'cultivate'],
  makes: ['generates', 'produces', 'yields', 'formulates', 'establishes'],
  made: ['generated', 'produced', 'yielded', 'formulated', 'established'],
  reason: ['rationale', 'justification', 'catalyst', 'driving factor', 'incentive'],
  reasons: ['rationales', 'justifications', 'catalysts', 'contributing factors', 'motives'],
  effect: ['consequence', 'implication', 'aftermath', 'repercussion', 'outcome'],
  effects: ['consequences', 'implications', 'repercussions', 'outcomes'],
  affect: ['impact', 'influence', 'alter', 'modify'],
  money: ['financial resources', 'funds', 'capital', 'revenue', 'allocations'],
  country: ['nation', 'state', 'sovereign entity', 'jurisdiction'],
  countries: ['nations', 'states', 'jurisdictions', 'global economies'],
  government: ['authorities', 'policymakers', 'governing bodies', 'the state', 'administrators'],
  governments: ['authorities', 'policymakers', 'governing bodies', 'regulators'],
  education: ['academic schooling', 'pedagogy', 'scholastic instruction', 'knowledge acquisition'],
  child: ['youth', 'juvenile', 'minor', 'offspring'],
  children: ['youths', 'juveniles', 'minors', 'youngsters', 'the younger generation'],
  job: ['occupation', 'profession', 'vocation', 'employment', 'career path'],
  jobs: ['occupations', 'professions', 'vocations', 'employment opportunities'],
  'lead to': ['culminate in', 'precipitate', 'instigate', 'give rise to', 'engender'],
  'result in': ['culminate in', 'precipitate', 'give rise to', 'engender'],
};

/**
 * Tokenize text into words with accurate character offsets
 */
export function extractWordsWithPositions(text) {
  const regex = /\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g;
  const words = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    words.push({
      text: match[0],
      lower: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return words;
}

/**
 * Analyze text for repetitive non-stop words and lexical diversity
 */
export function analyzeRepetition(text) {
  if (!text || !text.trim()) {
    return {
      repetitiveWords: [],
      totalWords: 0,
      uniqueWords: 0,
      lexicalDiversity: 0,
      repetitionScore: 100,
    };
  }

  const tokens = extractWordsWithPositions(text);
  const totalWords = tokens.length;
  if (totalWords === 0) {
    return {
      repetitiveWords: [],
      totalWords: 0,
      uniqueWords: 0,
      lexicalDiversity: 0,
      repetitionScore: 100,
    };
  }

  // Group meaningful content words
  const frequencyMap = new Map();

  for (const token of tokens) {
    const word = token.lower;
    // Skip stop words, single letters, and numbers
    if (STOP_WORDS.has(word) || word.length < 3) {
      continue;
    }

    if (!frequencyMap.has(word)) {
      frequencyMap.set(word, {
        word,
        count: 0,
        occurrences: [],
      });
    }

    const entry = frequencyMap.get(word);
    entry.count += 1;
    entry.occurrences.push({ start: token.start, end: token.end });
  }

  // Calculate unique words across all tokens
  const allUniqueWords = new Set(tokens.map(t => t.lower)).size;
  const lexicalDiversity = Math.round((allUniqueWords / totalWords) * 100);

  // Filter repetitive words:
  // For short drafts (< 100 words), count >= 2 can be notable,
  // For normal essays (>= 100 words), count >= 3 is flagged.
  const repetitionThreshold = totalWords < 100 ? 3 : 3;

  const repetitiveWords = [];
  let totalRepetitiveOccurrences = 0;

  for (const [word, data] of frequencyMap.entries()) {
    if (data.count >= repetitionThreshold) {
      // Lookup synonyms
      const synonyms = IELTS_SYNONYMS[word] || [];
      
      let severity = 'low';
      if (data.count >= 6) severity = 'high';
      else if (data.count >= 4) severity = 'medium';

      repetitiveWords.push({
        word,
        count: data.count,
        occurrences: data.occurrences,
        synonyms,
        severity,
      });

      totalRepetitiveOccurrences += data.count;
    }
  }

  // Sort by highest frequency
  repetitiveWords.sort((a, b) => b.count - a.count);

  // Score from 0 to 100 (100 = rich diverse vocabulary, 0 = heavily repetitive)
  const penalty = (totalRepetitiveOccurrences / totalWords) * 120;
  const repetitionScore = Math.max(20, Math.min(100, Math.round(100 - penalty)));

  return {
    repetitiveWords,
    totalWords,
    uniqueWords: allUniqueWords,
    lexicalDiversity,
    repetitionScore,
  };
}

/**
 * Generate targeted habit-building takeaways based on live draft
 */
export function generateHabitInsights({
  grammarIssues = [],
  repetitiveWords = [],
  wordCount = 0,
  targetWords = 250,
  taskKind = 2,
}) {
  const insights = [];

  // 1. Repetitive Word Habits
  if (repetitiveWords.length > 0) {
    const topWord = repetitiveWords[0];
    const syns = topWord.synonyms.length > 0
      ? `Try swapping with: ${topWord.synonyms.slice(0, 3).join(', ')}.`
      : 'Try rephrasing with varied noun phrases or relative clauses.';
    
    insights.push({
      id: 'lexical-variety',
      category: 'Lexical Resource (Vocabulary)',
      severity: topWord.count >= 5 ? 'urgent' : 'warning',
      title: `Overused Word: "${topWord.word}" (${topWord.count}×)`,
      tip: `IELTS Band 7+ requires flexible lexical control without excessive repetition. ${syns}`,
    });
  } else if (wordCount >= 80) {
    insights.push({
      id: 'lexical-positive',
      category: 'Lexical Resource (Vocabulary)',
      severity: 'good',
      title: 'Strong Vocabulary Range',
      tip: 'You are avoiding repetitive content words. Maintain this discipline in your exam paragraphs.',
    });
  }

  // 2. Grammar Habits
  const articleErrors = grammarIssues.filter(i => /article/i.test(i.message));
  if (articleErrors.length > 0) {
    insights.push({
      id: 'article-habit',
      category: 'Grammatical Range & Accuracy',
      severity: 'warning',
      title: `Article Precision (${articleErrors.length} flagged)`,
      tip: 'Notice your usage of definite ("the") and indefinite ("a"/"an") articles before singular countable nouns.',
    });
  }

  const spellingErrors = grammarIssues.filter(i => /spelling|mean/i.test(i.message));
  if (spellingErrors.length >= 2) {
    insights.push({
      id: 'spelling-habit',
      category: 'Lexical Resource (Spelling)',
      severity: 'warning',
      title: `Typo & Spelling Alert (${spellingErrors.length} typos)`,
      tip: 'Unforced spelling mistakes directly impact your Lexical Resource score. Double check high-frequency academic endings (-tion, -ment, -able).',
    });
  }

  // 3. Length & Volume Habits
  if (wordCount < targetWords) {
    const diff = targetWords - wordCount;
    insights.push({
      id: 'word-count',
      category: 'Task Fulfillment',
      severity: wordCount < targetWords * 0.7 ? 'urgent' : 'info',
      title: `Under Minimum Length (${wordCount}/${targetWords})`,
      tip: `Write at least ${diff} more words to avoid automatic band penalties under IELTS criteria.`,
    });
  } else {
    insights.push({
      id: 'word-count-ok',
      category: 'Task Fulfillment',
      severity: 'good',
      title: 'Word Count Minimum Satisfied',
      tip: `You have reached ${wordCount} words. Keep within reasonable bounds (${targetWords + 50}–${targetWords + 80} words) to leave time for proofreading.`,
    });
  }

  return insights;
}
