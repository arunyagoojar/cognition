/**
 * Harper Grammar Checker Service
 * Initializes and manages Harper's WebAssembly linter on-device.
 * 100% offline, privacy-first, zero telemetry.
 */

let linterInstance = null;
let initPromise = null;

/**
 * Get or initialize the Harper LocalLinter instance with British English dialect.
 */
export async function getHarperLinter() {
  if (linterInstance) {
    return linterInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const { LocalLinter, WorkerLinter, Dialect } = await import('harper.js');
      const { binaryInlined } = await import('harper.js/binaryInlined');

      const Linter = typeof Worker !== 'undefined' && typeof window !== 'undefined' ? WorkerLinter : LocalLinter;
      const linter = new Linter({
        binary: binaryInlined,
        dialect: Dialect.British,
      });

      await linter.setup();
      await linter.setLintConfig(await linter.getDefaultLintConfig());
      linterInstance = linter;
      return linter;
    } catch (err) {
      console.error('Failed to initialize Harper linter:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Categorize a Harper lint into user-friendly IELTS grammar/mechanics groups.
 */
function categorizeLint(message, _snippet) {
  const msg = (message || '').toLowerCase();
  if (/repeat this word/i.test(msg)) return {type:'repeated',label:'Repeated word',color:'var(--c-coral)'};
  if (/article|indefinite|definite/i.test(msg)) {
    return { type: 'article', label: 'Article Usage', color: 'var(--c-yellow)' };
  }
  if (/spelling|typo|misspelled/i.test(msg)) {
    return { type: 'spelling', label: 'Spelling / Typo', color: 'var(--c-lavender)' };
  }
  if (/comma|period|punctuation|hyphen|semicolon|colon|quote/i.test(msg)) {
    return { type: 'punctuation', label: 'Punctuation', color: 'var(--text-tertiary)' };
  }
  if (/capital|lowercase|uppercase/i.test(msg)) {
    return { type: 'capitalization', label: 'Capitalization', color: 'var(--text-secondary)' };
  }
  if (/agreement|subject|verb|plural|singular|tense/i.test(msg)) {
    return { type: 'agreement', label: 'Grammar / Agreement', color: 'var(--c-coral)' };
  }
  return { type: 'grammar', label: 'Grammar & Style', color: 'var(--c-coral)' };
}

/**
 * Lint text using Harper and return normalized issues
 */
export async function lintTextWithHarper(text) {
  if (!text || !text.trim()) {
    return {
      issues: [],
      accuracyPercent: 100,
      errorFreeSentences: 0,
      totalSentences: 0,
    };
  }

  const linter = await getHarperLinter();
  const rawLints = await linter.lint(text, {language:'plaintext', dedup:false, isolateEnglish:false});
  // harper.js 2.10 already converts spans to JavaScript UTF-16 offsets.

  const issues = [];
  for (let i = 0; i < rawLints.length; i++) {
    const raw = rawLints[i];
    const span = raw.span();
    const start = span.start;
    const end = span.end;
    const snippet = text.slice(start, end);
    const message = raw.message();

    const suggestions = [];
    if (typeof raw.suggestion_count === 'function' && raw.suggestion_count() > 0) {
      const rawSuggs = raw.suggestions() || [];
      for (const sug of rawSuggs) {
        const replace = sug.get_replacement_text();
        if (replace !== undefined && replace !== null) {
          suggestions.push({
            replace,
            kind: sug.kind(),
          });
        }
      }
    }

    const category = categorizeLint(message, snippet);

    issues.push({
      id: `harper-issue-${i}-${start}`,
      start,
      end,
      snippet,
      message,
      suggestions,
      category: category.label,
      type: category.type,
      color: category.color,
    });
  }

  // Narrow local check for an article directly before an object pronoun.
  // Harper 2.10 does not yet flag "for a me"; avoid treating this as full grammar coverage.
  for (const match of text.matchAll(/\b(?:a|an)\s+(?:me|him|us|them|myself|yourself|ourselves|themselves)\b/g)) {
    const start=match.index, end=start+match[0].length;
    if(issues.some(i=>i.start<=start && i.end>=end)) continue;
    issues.push({id:`local-article-${start}`,start,end,snippet:match[0],message:'Remove the article before this object pronoun.',category:'Article usage',type:'article',color:'var(--c-coral)',source:'local',suggestions:[{replace:match[0].replace(/^(?:a|an)\s+/,''),kind:0}]});
  }

  // Calculate sentences and error-free sentences
  const sentenceRegex = /[^.!?]+[.!?]+|\S[^.!?]*$/g;
  const sentenceMatches = [];
  let sMatch;
  while ((sMatch = sentenceRegex.exec(text)) !== null) {
    if (sMatch[0].trim().length > 0) {
      sentenceMatches.push({
        start: sMatch.index,
        end: sMatch.index + sMatch[0].length,
        text: sMatch[0],
      });
    }
  }

  const totalSentences = Math.max(1, sentenceMatches.length);
  let errorFreeSentences = 0;

  for (const s of sentenceMatches) {
    const hasError = issues.some(iss => iss.start < s.end && iss.end > s.start);
    if (!hasError) {
      errorFreeSentences++;
    }
  }

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const accuracyPercent = Math.round(errorFreeSentences / totalSentences * 100);

  return {
    issues,
    accuracyPercent,
    errorFreeSentences,
    totalSentences,
    wordCount: words,
  };
}

/**
 * Apply a fix replacement to the text at the given span
 */
export function applyHarperFix(originalText, issue, replacement) {
  if (!originalText || !issue || typeof issue.start !== 'number' || typeof issue.end !== 'number') {
    return originalText;
  }
  const before = originalText.slice(0, issue.start);
  const after = originalText.slice(issue.end);
  return before + replacement + after;
}
