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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Reading / Listening — question-type breakdown */}
      {hasTypeData && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
            Question-type performance
            {analysis.raw !== undefined && analysis.total !== undefined && (
              <span style={{ color: 'var(--text-secondary)', fontWeight: 700, marginLeft: 8 }}>
                {analysis.raw}/{analysis.total} correct
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analysis.perType.map(t => {
              const pct = Math.round(t.accuracy * 100);
              const weak = t.accuracy < 0.6;
              return (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 150 }}>
                    {t.label}
                  </div>
                  <div style={{ flex: 2, height: 8, background: 'var(--surface-alt)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: weak ? 'var(--c-coral)' : 'var(--success-icon)',
                      borderRadius: 4,
                    }} />
                  </div>
                  <div style={{ width: 58, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {t.correct}/{t.total}
                  </div>
                </div>
              );
            })}
          </div>
          {(analysis.strong.length > 0 || analysis.focus.length > 0) && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {analysis.strong.length > 0 && (
                <div><strong style={{ color: 'var(--success-icon)' }}>Strong:</strong> {analysis.strong.join(' · ')}</div>
              )}
              {analysis.focus.length > 0 && (
                <div><strong style={{ color: 'var(--coral)' }}>Focus:</strong> {analysis.focus.join(' · ')}</div>
              )}
            </div>
          )}
          {criteriaRecs?.tip && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {criteriaRecs.lesson && (
                <button type="button" className="nav-back-btn" style={{ borderColor: 'var(--c-coral)' }}
                  onClick={() => onOpenLesson?.(criteriaRecs.lesson.id)}>
                  <Icon name="play" size={12} /> Watch lesson
                </button>
              )}
              <button type="button" className="nav-back-btn"
                onClick={() => onOpenTips?.(criteriaRecs.tip.skill ?? skill, criteriaRecs.tip.categoryId)}>
                <Icon name="book" size={12} /> Read tip
              </button>
              <button type="button" className="nav-back-btn"
                onClick={() => onStartPractice?.(skill)}>
                <Icon name="target" size={12} /> {skill.charAt(0).toUpperCase() + skill.slice(1)} Practice
              </button>
            </div>
          )}
        </div>
      )}

      {/* Writing / Speaking — criterion cards */}
      {hasCriteria && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
            {skill === 'writing' ? 'Writing criteria' : 'Speaking criteria'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {analysis.criteria.map(c => (
              <div key={c.key} style={{ padding: 12, background: 'var(--surface-interactive)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{c.band.toFixed(1)}</div>
                {c.improvementFocus && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.45 }}>{c.improvementFocus}</div>
                )}
              </div>
            ))}
          </div>
          {skill === 'writing' && analysis.task1Band !== null && analysis.task2Band !== null && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Task 1: <strong style={{ color: 'var(--text-primary)' }}>{analysis.task1Band.toFixed(1)}</strong>
              {' · '}Task 2: <strong style={{ color: 'var(--text-primary)' }}>{analysis.task2Band.toFixed(1)}</strong>
            </div>
          )}
          {criteriaRecs?.tip && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {criteriaRecs.lesson && (
                <button type="button" className="nav-back-btn" style={{ borderColor: 'var(--c-coral)' }}
                  onClick={() => onOpenLesson?.(criteriaRecs.lesson.id)}>
                  <Icon name="play" size={12} /> Watch lesson
                </button>
              )}
              <button type="button" className="nav-back-btn"
                onClick={() => onOpenTips?.(criteriaRecs.tip.skill ?? skill, criteriaRecs.tip.categoryId)}>
                <Icon name="book" size={12} /> Read tip
              </button>
              <button type="button" className="nav-back-btn"
                onClick={() => onStartPractice?.(skill)}>
                <Icon name="target" size={12} /> {skill.charAt(0).toUpperCase() + skill.slice(1)} Practice
              </button>
            </div>
          )}
        </div>
      )}

      {/* Writing — sentences worth improving */}
      {skill === 'writing' && analysis.sentenceImprovements.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Sentences worth improving
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Suggestions only — your submitted answer is unchanged.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {analysis.sentenceImprovements.map((s, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--surface-interactive)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Your sentence</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 8 }}>"{s.original}"</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-coral)', textTransform: 'uppercase', marginBottom: 4 }}>Possible improvement</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>"{s.suggestion}"</div>
                {s.reason && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Why: {s.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speaking — development guidance */}
      {skill === 'speaking' && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '16px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            Developing longer answers
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
            Try this structure for extended answers: <strong style={{ color: 'var(--text-primary)' }}>Point → Reason → Example → Consequence.</strong>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--surface-interactive)', borderRadius: 10, padding: 12, lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Point:</strong> I prefer city transport.
            {' '}<strong style={{ color: 'var(--text-primary)' }}>Reason:</strong> it's faster during peak hours.
            {' '}<strong style={{ color: 'var(--text-primary)' }}>Example:</strong> the metro gets me across town in twenty minutes.
            {' '}<strong style={{ color: 'var(--text-primary)' }}>Consequence:</strong> so I rarely drive on weekdays.
          </div>
          {analysis.pronunciation && analysis.pronunciation.band === null && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
              Pronunciation: not assessed from transcripts — it requires live audio evaluation.
            </div>
          )}
        </div>
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
