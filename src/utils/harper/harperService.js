/** A practice-owned worker, with a bounded cache and orderly async disposal. */
export function createHarperSession() {
  let engine, initialization, disposed = false;
  const cache = new Map();
  const pending = new Set();
  async function getLinter() {
    if (disposed) throw new Error('Writing checker closed');
    if (!initialization) initialization = (async () => {
      const { LocalLinter, WorkerLinter, Dialect } = await import('harper.js');
      const { binary } = await import('harper.js/binary');
      const Linter = typeof Worker !== 'undefined' && typeof window !== 'undefined' ? WorkerLinter : LocalLinter;
      engine = new Linter({ binary, dialect: Dialect.British });
      await engine.setup();
      await engine.setLintConfig(await engine.getDefaultLintConfig());
      return engine;
    })().catch(async error => {
      await engine?.dispose(); engine = null; initialization = null; throw error;
    });
    return initialization;
  }
  function lint(text) {
    if (disposed) return Promise.reject(new Error('Writing checker closed'));
    if (cache.has(text)) return cache.get(text);
    const job = (async () => {
      if (!text.trim()) return summarizeIssues(text, []);
      const linter = await getLinter();
      const groups = await linter.organizedLints(text, { language: 'plaintext', dedup: false, isolateEnglish: false });
      const issues = [];
      for (const [rule, lints] of Object.entries(groups)) for (const raw of lints) {
        const span = raw.span(), start = span.start, end = span.end;
        const snippet = text.slice(start, end), message = raw.message(), kind = raw.lint_kind();
        const suggestions = raw.suggestions().map(s => {
          const result = { replace: s.get_replacement_text(), kind: s.kind() };
          s.free?.(); return result;
        });
        const category = kind === 'Spelling' ? {type:'spelling',label:'Spelling / Typo'} : categorizeLint(message);
        // Severity is a UI distinction, not a confidence or IELTS score.
        const severity = /Spelling|Agreement|Capitalization|Punctuation|Typo|RepeatedWords/.test(kind) ? 'error' : 'warning';
        if (!(category.type === 'spelling' && snippet.toLowerCase() === 'caribbean')) issues.push({
          id: `${rule}-${start}-${end}`, start, end, snippet, message, suggestions,
          category: category.label, type: category.type, severity, rule, kind,
        });
        span.free?.(); raw.free?.();
      }
      return summarizeIssues(text, issues.sort((a,b) => a.start-b.start || a.end-b.end));
    })();
    cache.set(text, job); pending.add(job);
    if (cache.size > 5) cache.delete(cache.keys().next().value);
    job.then(() => pending.delete(job), () => { pending.delete(job); cache.delete(text); });
    return job;
  }
  let descriptions;
  return {
    lint, getLinter,
    async explain(rule) {
      descriptions ||= getLinter().then(l => l.getLintDescriptions()).catch(error => { descriptions=null; throw error; });
      return (await descriptions)[rule] || '';
    },
    async dispose() {
      disposed = true;
      await Promise.allSettled([...pending, initialization, descriptions].filter(Boolean));
      await engine?.dispose();
      cache.clear(); engine = null;
    },
  };
}
const defaultSession = createHarperSession();
export const getHarperLinter = () => defaultSession.getLinter();
export const lintTextWithHarper = text => defaultSession.lint(text);

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


export function summarizeIssues(text, issues) {
  const sentences = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('en', {granularity:'sentence'}).segment(text)].filter(s=>s.segment.trim()).map(s=>({start:s.index,end:s.index+s.segment.length}))
    : [...text.matchAll(/[^.!?]+[.!?]+|\S[^.!?]*$/g)].filter(m=>m[0].trim()).map(m=>({start:m.index,end:m.index+m[0].length}));
  const totalSentences = sentences.length;
  const errorFreeSentences = sentences.filter(s=>!issues.some(i=>i.start<s.end && (i.end>s.start || i.start===i.end && i.start>=s.start))).length;
  return {issues, totalSentences, errorFreeSentences, errorCount:issues.filter(i=>i.severity==='error').length,
    warningCount:issues.filter(i=>i.severity==='warning').length,
    accuracyPercent:totalSentences ? Math.round(errorFreeSentences/totalSentences*100) : 100,
    wordCount:text.trim().split(/\s+/).filter(Boolean).length};
}
export function applyHarperFix(text, issue, replacement) {
  if (!issue || issue.start<0 || issue.end>text.length || text.slice(issue.start,issue.end)!==issue.snippet) return text;
  return text.slice(0,issue.start)+replacement+text.slice(issue.end);
}
