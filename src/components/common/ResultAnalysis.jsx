import React from 'react';
import Icon from '../common/Icon';
import { deriveResultAnalysis } from '../../utils/insights.js';
import { resolveRecommendations } from '../../data/recommendations.js';

/**
 * Detailed post-test analysis (Phase 6) — evidence-based breakdown for one
 * skill's result: question-type performance (R/L), criterion scores (W/S),
 * sentence-level writing suggestions, speaking development guidance, and
 * real content recommendations. Renders nothing it can't support.
 */
export default function ResultAnalysis({ skill, resultRecord, onOpenLesson, onOpenTips, onStartPractice }) {
  const analysis = deriveResultAnalysis(skill, resultRecord);
  if (!analysis) return null;

  const hasTypeData = analysis.perType && analysis.perType.length > 0;
  const hasCriteria = analysis.criteria && analysis.criteria.length > 0;
  if (!hasTypeData && !hasCriteria) return null;

  const focusKeys = analysis.perType
    ? analysis.perType.filter(t => t.total >= 3 && t.accuracy < 0.6).slice(0, 1)
    : [];
  const criteriaRecs = hasCriteria
    ? resolveRecommendations({ key: focusKeyFromCriteria(analysis), skill })
    : (focusKeys[0] ? resolveRecommendations({ key: `${skill}.${focusKeys[0].type}`, skill }) : null);

  const skillLabel = skill.charAt(0).toUpperCase() + skill.slice(1);
  // Only offer links whose destination is wired up — a button that does
  // nothing is worse than no button.
  const recActions = criteriaRecs?.tip ? [
    criteriaRecs.lesson && onOpenLesson && (
      <button key="lesson" type="button" className="result-link-btn is-accent"
        onClick={() => onOpenLesson(criteriaRecs.lesson.id)}>
        <Icon name="play" size={14} /> Watch lesson
      </button>
    ),
    onOpenTips && (
      <button key="tip" type="button" className="result-link-btn"
        onClick={() => onOpenTips(criteriaRecs.tip.skill ?? skill, criteriaRecs.tip.categoryId)}>
        <Icon name="book" size={14} /> Read tip
      </button>
    ),
    onStartPractice && (
      <button key="practice" type="button" className="result-link-btn"
        onClick={() => onStartPractice(skill)}>
        <Icon name="target" size={14} /> {skillLabel} Practice
      </button>
    ),
  ].filter(Boolean) : [];
  const actionRow = recActions.length > 0 ? <div className="result-link-row">{recActions}</div> : null;

  return (
    <div className="result-analysis">
      {/* Reading / Listening — question-type breakdown */}
      {hasTypeData && (
        <section className="result-card">
          <div className="result-card-head">
            <h3 className="result-card-title">Question-type performance</h3>
            {analysis.raw !== undefined && analysis.total !== undefined && (
              <span className="result-card-meta">{analysis.raw}/{analysis.total} correct</span>
            )}
          </div>
          <div className="ra-type-list">
            {analysis.perType.map(t => {
              const pct = Math.round(t.accuracy * 100);
              const weak = t.accuracy < 0.6;
              return (
                <div key={t.type} className="ra-type-row">
                  <div className="ra-type-label">{t.label}</div>
                  <div className="ra-type-track" role="img" aria-label={`${pct}% correct`}>
                    <div className={`ra-type-fill${weak ? ' is-weak' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="ra-type-score">{t.correct}/{t.total}</div>
                </div>
              );
            })}
          </div>
          {(analysis.strong.length > 0 || analysis.focus.length > 0) && (
            <div className="ra-summary">
              {analysis.strong.length > 0 && (
                <p><strong className="is-good">Strong:</strong> {analysis.strong.join(' · ')}</p>
              )}
              {analysis.focus.length > 0 && (
                <p><strong className="is-focus">Focus:</strong> {analysis.focus.join(' · ')}</p>
              )}
            </div>
          )}
          {actionRow}
        </section>
      )}

      {/* Writing / Speaking — criterion cards */}
      {hasCriteria && (
        <section className="result-card">
          <div className="result-card-head">
            <h3 className="result-card-title">{skill === 'writing' ? 'Writing criteria at a glance' : 'Speaking criteria at a glance'}</h3>
          </div>
          <div className="ra-criteria-grid">
            {analysis.criteria.map(c => (
              <div key={c.key} className="ra-criterion">
                <div className="ra-criterion-label">{c.label}</div>
                <div className="ra-criterion-band">{c.band.toFixed(1)}</div>
                {c.improvementFocus && (
                  <div className="ra-criterion-note">{c.improvementFocus}</div>
                )}
              </div>
            ))}
          </div>
          {skill === 'writing' && analysis.task1Band !== null && analysis.task2Band !== null && (
            <p className="ra-summary">
              Task 1: <strong>{analysis.task1Band.toFixed(1)}</strong>
              {' · '}Task 2: <strong>{analysis.task2Band.toFixed(1)}</strong>
            </p>
          )}
          {actionRow}
        </section>
      )}

      {/* Writing — sentences worth improving */}
      {skill === 'writing' && analysis.sentenceImprovements.length > 0 && (
        <section className="result-card">
          <div className="result-card-head">
            <h3 className="result-card-title">Sentences worth improving</h3>
          </div>
          <p className="result-card-sub">Suggestions only — your submitted answer is unchanged.</p>
          <div className="ra-sentence-list">
            {analysis.sentenceImprovements.map((s, i) => (
              <div key={i} className="ra-sentence">
                <div className="result-label">Your sentence</div>
                <p className="ra-sentence-text">"{s.original}"</p>
                <div className="result-label is-accent">Possible improvement</div>
                <p className="ra-sentence-text is-better">"{s.suggestion}"</p>
                {s.reason && <p className="ra-sentence-why"><strong>Why:</strong> {s.reason}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Speaking — development guidance */}
      {skill === 'speaking' && (
        <section className="result-card">
          <div className="result-card-head">
            <h3 className="result-card-title">Developing longer answers</h3>
          </div>
          <p className="result-text">
            Try this structure for extended answers: <strong>Point → Reason → Example → Consequence.</strong>
          </p>
          <div className="ra-example">
            <strong>Point:</strong> I prefer city transport.
            {' '}<strong>Reason:</strong> it's faster during peak hours.
            {' '}<strong>Example:</strong> the metro gets me across town in twenty minutes.
            {' '}<strong>Consequence:</strong> so I rarely drive on weekdays.
          </div>
          {analysis.pronunciation && analysis.pronunciation.band === null && (
            <p className="result-card-sub" style={{ marginTop: 12, marginBottom: 0 }}>
              Pronunciation: not assessed from transcripts — it requires live audio evaluation.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function focusKeyFromCriteria(analysis) {
  const lowest = [...analysis.criteria].sort((a, b) => a.band - b.band)[0];
  const keyMap = {
    'Task Achievement / Response': 'taskResponse',
    'Task Achievement': 'taskAchievement',
    'Coherence & Cohesion': 'coherenceAndCohesion',
    'Lexical Resource': 'lexicalResource',
    'Grammatical Range & Accuracy': 'grammaticalRangeAndAccuracy',
    'Fluency & Coherence': 'fluencyAndCoherence',
  };
  return `${analysis.skill}.${keyMap[lowest.label] || 'overall'}`;
}
