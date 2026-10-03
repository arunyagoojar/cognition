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
        const skipped = !r.candidateAnswer;
        const aiAccepted = correct && r.evaluationMethod === 'AI_VERIFIED';
        const qNum = qId.replace(/^q/, '');
        const state = correct ? 'correct' : skipped ? 'unanswered' : 'incorrect';
        return (
          <div key={qId} className={`answer-review-item ${state}`}>
            <span className="review-verdict" aria-label={correct ? 'Correct' : skipped ? 'Not answered' : 'Incorrect'}>
              {correct ? <Icon name="check" size={14} /> : skipped ? <span aria-hidden="true">–</span> : <Icon name="x" size={14} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                Q{qNum}
                {aiAccepted && <span className="accepted-variant-tag">Accepted variant</span>}
              </div>
              <div className="answer-review-meta">
                {skipped ? 'Not answered' : <>Your answer: <span className="review-answer-chip">{display(r.candidateAnswer)}</span></>}
                {' · '}
                Correct answer: <span className="review-answer-chip is-key">{display(r.officialAnswer)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
