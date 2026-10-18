// Recover useful part coaching from feedback already saved with an interview.
// Whole-interview criterion bands never become invented scores for Parts 1–3.
const CRITERIA = {
  fluencyAndCoherence: 'fluency',
  lexicalResource: 'vocabulary',
  grammaticalRangeAndAccuracy: 'grammar',
};

function tokens(text) {
  return [...String(text).matchAll(/[\p{L}\p{N}\p{M}]+/gu)].map(match => ({
    value: match[0].normalize('NFKC').toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function findQuote(answers, quote, minimumWords = 1) {
  if (typeof quote !== 'string' || quote.trim().split(/\s+/).length < minimumWords) return null;
  const wanted = tokens(quote);
  if (wanted.length < minimumWords) return null;
  for (const answer of answers) {
    for (let i = 0; i <= answer.tokens.length - wanted.length; i++) {
      if (wanted.every((token, offset) => token.value === answer.tokens[i + offset].value)) {
        return answer.text.slice(answer.tokens[i].start, answer.tokens[i + wanted.length - 1].end);
      }
    }
  }
  return null;
}

const list = values => values.length < 3 ? values.join(' and ') : `${values.slice(0,-1).join(', ')} and ${values.at(-1)}`;

export function recoverSpeakingDiagnostics(result = {}) {
  const answers = { 1: [], 2: [], 3: [] };
  for (const [key, text] of Object.entries(result.transcripts || {})) {
    const match = /^(?:([0-2])_\d+|part([1-3]))$/.exec(key);
    if (!match || typeof text !== 'string' || !text.trim()) continue;
    const part = match[1] === undefined ? Number(match[2]) : Number(match[1]) + 1;
    answers[part].push({ text, tokens: tokens(text) });
  }

  const diagnostics = {};
  for (const part of [1, 2, 3]) {
    const diagnostic = result.partDiagnostics?.[`part${part}`];
    if (typeof diagnostic?.needsPractice !== 'boolean') continue;
    const evidence = findQuote(answers[part], diagnostic.evidence);
    if (evidence) diagnostics[`part${part}`] = {
      needsPractice: diagnostic.needsPractice,
      reason: typeof diagnostic.reason === 'string' ? diagnostic.reason : '',
      evidence,
      nextAction: typeof diagnostic.nextAction === 'string' ? diagnostic.nextAction : '',
      source: 'part_review',
    };
  }

  const located = { 1: [], 2: [], 3: [] };
  for (const [key, name] of Object.entries(CRITERIA)) {
    const criterion = result.criteria?.[key];
    if (typeof criterion?.band !== 'number' || !Number.isFinite(criterion.band) || criterion.band < 0 || criterion.band >= 7) continue;
    for (const correction of Array.isArray(criterion.corrections) ? criterion.corrections : []) {
      if (!String(correction?.alternative || '').trim() || !String(correction?.explanation || '').trim()) continue;
      if (String(correction.alternative).trim() === String(correction.original || '').trim()) continue;
      const matches = [1, 2, 3].map(part => ({ part, evidence: findQuote(answers[part], correction.original, 3) })).filter(match => match.evidence);
      // A phrase used in several parts cannot identify the source of an error.
      if (matches.length !== 1) continue;
      const { part, evidence } = matches[0];
      located[part].push({ key, name, evidence, band: criterion.band,
        nextAction: criterion.nextBandAdvice || criterion.improvementFocus || correction.explanation });
    }
  }

  for (const part of [1, 2, 3]) {
    // An explicit healthy finding takes precedence over older/general feedback.
    if (diagnostics[`part${part}`] || !located[part].length) continue;
    const findings = located[part].sort((a,b) => a.band - b.band || b.evidence.length - a.evidence.length);
    const names = [...new Set(findings.map(finding => finding.name))];
    diagnostics[`part${part}`] = {
      needsPractice: true,
      reason: `Your ${list(names)} feedback identifies ${names.length === 1 ? 'an issue' : 'issues'} in this part.`,
      evidence: findings[0].evidence,
      nextAction: findings[0].nextAction,
      source: 'criterion_feedback',
      criterionKeys: [...new Set(findings.map(finding => finding.key))],
    };
  }
  return diagnostics;
}
