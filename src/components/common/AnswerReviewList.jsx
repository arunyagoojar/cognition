import React, { useState } from 'react';
import Icon from './Icon';

/**
 * Per-question answer review for Listening / Reading results.
 * Each row: question number, a clear verdict, the candidate's answer, the
 * official answer, the accepted equivalent (when an answer was credited as a
 * variant of the key) and the verifier's reason when one exists.
 */
// Judgement answers are shown with the same labels as the choices the
// candidate saw — "NOT GIVEN" is an answer option, not missing data.
const CHOICE_LABEL = { TRUE: 'True', FALSE: 'False', 'NOT GIVEN': 'Not Given', YES: 'Yes', NO: 'No' };
const display = (v) => {
  if (Array.isArray(v)) return v.map(display).filter(Boolean).join(' / ');
  const s = String(v ?? '').trim();
  return CHOICE_LABEL[s.toUpperCase()] || s;
};
const norm = (v) => display(v).toLowerCase().replace(/\s+/g, ' ');

const STATE_META = {
  correct: { label: 'Correct', icon: <Icon name="check" size={15} /> },
  incorrect: { label: 'Incorrect', icon: <Icon name="x" size={15} /> },
  unanswered: { label: 'Not answered', icon: <span aria-hidden="true">–</span> },
  unresolved: { label: 'Pending review', icon: <span aria-hidden="true">?</span> },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'wrong', label: 'To review' },
  { id: 'correct', label: 'Correct' },
];

function stateOf(r) {
  const correct = r.finalResult === 'CORRECT';
  const unresolved = Boolean(r.unresolved || r.finalResult === 'UNCERTAIN' || r.aiDecision === 'UNCERTAIN');
  const skipped = !String(r.candidateAnswer ?? '').trim();
  return unresolved ? 'unresolved' : correct ? 'correct' : skipped ? 'unanswered' : 'incorrect';
}

export default function AnswerReviewList({ itemResults, showUnanswered = false }) {
  const [filter, setFilter] = useState('all');
  if (!itemResults) return null;
  const entries = Object.entries(itemResults);
  if (entries.length === 0) return null;

  const rows = entries
    .filter(([, r]) => showUnanswered || String(r.candidateAnswer ?? '').trim())
    .map(([qId, r]) => ({ qId, r, state: stateOf(r) }));
  if (rows.length === 0) return null;

  const counts = rows.reduce((acc, { state }) => ({ ...acc, [state]: (acc[state] || 0) + 1 }), {});
  const visible = rows.filter(({ state }) => (
    filter === 'all' ? true : filter === 'correct' ? state === 'correct' : state !== 'correct'
  ));

  return (
    <div className="answer-review">
      <div className="answer-review-toolbar">
        <div className="answer-review-counts" aria-label="Answer summary">
          <span className="ar-count is-correct"><b>{counts.correct || 0}</b> correct</span>
          <span className="ar-count is-incorrect"><b>{counts.incorrect || 0}</b> incorrect</span>
          {(counts.unanswered || 0) > 0 && <span className="ar-count is-unanswered"><b>{counts.unanswered}</b> not answered</span>}
          {(counts.unresolved || 0) > 0 && <span className="ar-count is-unresolved"><b>{counts.unresolved}</b> pending review</span>}
        </div>
        <div className="answer-review-filter" role="group" aria-label="Filter answers">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? 'is-active' : ''}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="answer-review-empty">
          {filter === 'correct' ? 'No correct answers to show.' : 'Nothing to review — every answer was correct.'}
        </p>
      ) : (
        <ol className="answer-review-list">
          {visible.map(({ qId, r, state }) => {
            const meta = STATE_META[state];
            const qNum = qId.replace(/^q/i, '');
            const official = display(r.officialAnswer);
            const matched = display(r.matchedAnswer);
            const isVariant = state === 'correct' && (r.acceptedVariant || r.evaluationMethod === 'AI_VERIFIED');
            const showMatched = state === 'correct' && matched && (isVariant || norm(r.matchedAnswer) !== norm(r.officialAnswer));
            return (
              <li key={qId} className={`answer-review-item is-${state}`}>
                <div className="ar-head">
                  <span className="ar-qnum">Q{qNum}</span>
                  <span className="ar-status">
                    <span className="ar-status-icon">{meta.icon}</span>
                    {meta.label}
                  </span>
                  {isVariant && <span className="accepted-variant-tag">Accepted variant</span>}
                </div>
                <dl className="ar-answers">
                  <div className="ar-row">
                    <dt>Your answer</dt>
                    <dd>
                      {state === 'unanswered'
                        ? <span className="ar-empty">No answer given</span>
                        : <span className={`ar-chip is-${state}`}>{display(r.candidateAnswer)}</span>}
                    </dd>
                  </div>
                  <div className="ar-row">
                    <dt>Correct answer</dt>
                    <dd><span className="ar-chip is-key">{official || '—'}</span></dd>
                  </div>
                  {showMatched && (
                    <div className="ar-row">
                      <dt>Matched to</dt>
                      <dd><span className="ar-chip is-key">{matched}</span></dd>
                    </div>
                  )}
                </dl>
                {r.aiReason && (
                  <p className="ar-reason">
                    <span className="ar-reason-label">{state === 'unresolved' ? 'Why it is pending' : 'Examiner note'}</span>
                    {r.aiReason}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
