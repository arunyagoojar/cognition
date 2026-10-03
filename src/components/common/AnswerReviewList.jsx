import React from 'react';
import Icon from './Icon';

/**
 * Compact answer-review list (Phase 5).
 * Primary display: correct/incorrect, the student's answer, the official one.
 * AI-accepted variants get a subtle tag — verification never dominates.
 */
export default function AnswerReviewList({ itemResults }) {
  if (!itemResults) return null;
  const entries = Object.entries(itemResults);
  if (entries.length === 0) return null;

  const answered = entries.filter(([, r]) => r.candidateAnswer);
  if (answered.length === 0) return null;

  return (
    <div className="answer-review-list">
      {answered.map(([qId, r]) => {
        const correct = r.finalResult === 'CORRECT';
        const aiAccepted = correct && r.evaluationMethod === 'AI_VERIFIED';
        const qNum = qId.replace(/^q/, '');
        return (
          <div key={qId} className={`answer-review-item ${correct ? 'correct' : 'incorrect'}`}>
            <span className="review-verdict" aria-label={correct ? 'Correct' : 'Incorrect'}>
              {correct ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                Q{qNum}
                {aiAccepted && <span className="accepted-variant-tag">Accepted variant</span>}
              </div>
              <div className="answer-review-meta">
                Your answer: <strong style={{ color: 'var(--text-primary)' }}>{String(r.candidateAnswer)}</strong>
                {' · '}
                Official answer: <strong style={{ color: 'var(--text-primary)' }}>{String(r.officialAnswer)}</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
