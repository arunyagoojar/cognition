import React from 'react';
import Icon from './Icon';

/**
 * Compact answer-review list (Phase 5).
 * Primary display: correct/incorrect, the student's answer, the official one.
 * AI-accepted variants get a subtle tag — verification never dominates.
 */
// Judgement answers are shown with the same labels as the choices the
// candidate saw — "NOT GIVEN" is an answer option, not missing data.
const CHOICE_LABEL = { TRUE: 'True', FALSE: 'False', 'NOT GIVEN': 'Not Given', YES: 'Yes', NO: 'No' };
const display = (v) => {
  const s = String(v ?? '').trim();
  return CHOICE_LABEL[s.toUpperCase()] || s;
};

export default function AnswerReviewList({ itemResults, showUnanswered = false }) {
  if (!itemResults) return null;
  const entries = Object.entries(itemResults);
  if (entries.length === 0) return null;

  const answered = showUnanswered ? entries : entries.filter(([, r]) => r.candidateAnswer);
  if (answered.length === 0) return null;

  return (
    <div className="answer-review-list">
      {answered.map(([qId, r]) => {
        const correct = r.finalResult === 'CORRECT';
        const unresolved = Boolean(r.unresolved || r.finalResult === 'UNCERTAIN' || r.aiDecision === 'UNCERTAIN');
        const skipped = !r.candidateAnswer;
        const aiAccepted = correct && r.evaluationMethod === 'AI_VERIFIED';
        const qNum = qId.replace(/^q/, '');
        const state = unresolved ? 'unresolved' : correct ? 'correct' : skipped ? 'unanswered' : 'incorrect';
        return (
          <div key={qId} className={`answer-review-item ${state}`}>
            <span className="review-verdict" aria-label={unresolved ? 'Unresolved / Pending Review' : correct ? 'Correct' : skipped ? 'Not answered' : 'Incorrect'}>
              {unresolved ? <span aria-hidden="true" style={{ fontWeight: 800, fontSize: 14 }}>?</span> : correct ? <Icon name="check" size={14} /> : skipped ? <span aria-hidden="true">–</span> : <Icon name="x" size={14} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>Q{qNum}</span>
                {aiAccepted && <span className="accepted-variant-tag">Accepted variant</span>}
                {unresolved && (
                  <span className="unresolved-review-tag" style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(252, 204, 66, 0.25)',
                    border: '1px solid #FCCC42',
                    color: '#8A6D00'
                  }}>
                    Unresolved · Pending Review
                  </span>
                )}
              </div>
              <div className="answer-review-meta">
                {skipped ? 'Not answered' : <>Your answer: <span className="review-answer-chip">{display(r.candidateAnswer)}</span></>}
                {' · '}
                Correct answer: <span className="review-answer-chip is-key">{display(r.officialAnswer)}</span>
                {unresolved && r.aiReason && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Note: {r.aiReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
