import { useId } from 'react';
import './PartCriteriaBreakdown.css';

const SPEAKING_CRITERIA = [
  ['fluencyAndCoherence', 'Fluency', 'Fluency & coherence'],
  ['lexicalResource', 'Vocabulary', 'Lexical resource'],
  ['grammaticalRangeAndAccuracy', 'Grammar', 'Grammatical range & accuracy'],
];
const WRITING_CRITERIA = part => [
  [part === 1 ? 'taskAchievement' : 'taskResponse', 'Task fulfilment', part === 1 ? 'Task achievement' : 'Task response'],
  ['coherenceAndCohesion', 'Cohesion', 'Coherence & cohesion'],
  ['lexicalResource', 'Vocabulary', 'Lexical resource'],
  ['grammaticalRangeAndAccuracy', 'Grammar', 'Grammatical range & accuracy'],
];
const DESCRIPTIONS = { speaking: { 1: 'Interview', 2: 'Long turn', 3: 'Discussion' }, writing: { 1: 'Report', 2: 'Essay · twice the overall weight' } };
const validBand = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9;
const feedbackText = criterion => criterion?.feedback || criterion?.personalizedAssessment || criterion?.rationale || '';

export default function PartCriteriaBreakdown({ skill = 'speaking', partDiagnostics = {}, partFeedback = {}, sections, onPractice, partNumbers }) {
  const headingId = useId();
  const writing = skill === 'writing';
  const unit = writing ? 'Task' : 'Part';
  const title = writing ? 'Writing task estimates' : 'Part practice estimates';
  const displayedParts = writing ? [1, 2] : Array.isArray(partNumbers) && partNumbers.length ? [...new Set(partNumbers.map(Number))].filter(part => [1, 2, 3].includes(part)) : [1, 2, 3];
  const parts = displayedParts.map(part => {
    const section = sections?.find(item => Number(item.key ?? item.part) === part);
    const diagnostic = section?.observation || partDiagnostics?.[`part${part}`] || {};
    return {
      ...diagnostic, ...section, part,
      criteria: section?.criteria || diagnostic.criteria || {},
      band: section?.band ?? diagnostic.practiceBand,
      reason: section?.reason || diagnostic.reason || partFeedback?.[`part${part}`] || '',
    };
  });
  const hasAnyEvidence = parts.some(part => validBand(part.band) || Object.keys(part.criteria).length || part.reason || part.evidence || part.samples);
  if (!hasAnyEvidence) return <section className="part-criteria-breakdown" aria-labelledby={headingId}><h3 id={headingId}>{title}</h3><p className="part-criteria-note">Your saved result has no {writing ? 'task' : 'part'} estimates. Recheck your saved full {writing ? 'Writing' : 'Speaking'} test to add them, or take a new test.</p></section>;

  return <section className={`part-criteria-breakdown${writing ? ' is-writing' : ''}`} aria-labelledby={headingId}>
    <div className="part-criteria-heading"><h3 id={headingId}>{title}</h3><p>{writing ? 'Four criteria per task. Task 2 carries twice the weight in your overall Writing grade.' : 'AI estimates for each part. Separate from your overall Speaking grade; pronunciation is excluded.'}</p></div>
    <div className={`part-criteria-grid${parts.length === 1 ? ' is-single-part' : ''}`}>{parts.map(part => {
      const criteria = writing ? WRITING_CRITERIA(part.part) : SPEAKING_CRITERIA;
      const scored = criteria.some(([key]) => validBand(part.criteria[key]?.band));
      const hasFeedback = part.reason || part.evidence || part.nextAction || scored;
      return <article key={part.part} className={`part-criteria-card${part.needsPractice ? ' is-focus' : ''}`}>
        <div className="part-criteria-card-heading"><div><h4>{unit} {part.part}</h4><span>{DESCRIPTIONS[skill][part.part]}</span></div><div className="part-criteria-estimate">{validBand(part.band) ? <><strong>{part.band.toFixed(1)}</strong><span>{unit.toLowerCase()} estimate</span></> : <span>{hasFeedback ? 'Qualitative feedback' : 'No estimate yet'}</span>}</div></div>
        {scored ? <div className="part-criteria-rows">{criteria.map(([key, label, fullLabel]) => {
          const band = part.criteria[key]?.band;
          return <div className="part-criteria-row" key={key}><span title={fullLabel}>{label}</span><span className="part-criteria-track" aria-hidden="true">{validBand(band) && <span style={{ width: `${band / 9 * 100}%` }} />}</span><strong><span className="part-criteria-sr-only">{unit} {part.part}, {fullLabel}: </span>{validBand(band) ? band.toFixed(1) : '—'}<span className="part-criteria-sr-only">{validBand(band) ? ' out of 9' : 'not estimated'}</span></strong></div>;
        })}</div> : <p className="part-criteria-qualitative">{part.reason || `This result does not contain criterion estimates for this ${unit.toLowerCase()}.`}</p>}
        {scored && part.reason && <p className="part-criteria-reason">{part.reason}</p>}
        {hasFeedback && <details className="part-criteria-evidence"><summary>Feedback & evidence</summary><div>{scored && criteria.map(([key, label]) => {
          const criterion = part.criteria[key];
          const feedback = feedbackText(criterion);
          if (!feedback && !criterion?.evidence) return null;
          return <div className="part-criteria-evidence-item" key={key}><h5>{label}</h5>{feedback && <p>{feedback}</p>}{criterion.evidence && <blockquote>“{criterion.evidence}”</blockquote>}</div>;
        })}{!scored && part.evidence && <blockquote>“{part.evidence}”</blockquote>}{part.nextAction && <p className="part-criteria-next"><strong>Try next:</strong> {part.nextAction}</p>}</div></details>}
        {onPractice && hasFeedback && <button type="button" className="part-criteria-practice" onClick={() => onPractice({ ...part, key: part.part, label: `${unit} ${part.part}` })}>Practise {unit} {part.part} <span aria-hidden="true">→</span></button>}
      </article>;
    })}</div>
  </section>;
}
