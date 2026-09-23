import React from 'react';
import { Flag, ChevronLeft, ChevronRight } from 'lucide-react';

export default function QuestionPalette({
  totalQuestions = 40,
  answers = {},
  flagged = {},
  currentQuestion = 1,
  onSelectQuestion,
  onToggleFlag,
  onSubmit,
  nextSectionText,
  onNextSection,
  prevSectionText,
  onPrevSection
}) {
  const questions = Array.from({ length: totalQuestions }, (_, i) => i + 1);

  const isAnswered = (qNum) => {
    const val = answers[qNum];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  };

  return (
    <footer className="cd-palette-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button
          className={`btn btn-secondary ${flagged[currentQuestion] ? 'badge-amber' : ''}`}
          onClick={() => onToggleFlag(currentQuestion)}
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          <Flag size={14} color={flagged[currentQuestion] ? 'var(--accent-amber)' : 'currentColor'} />
          <span>{flagged[currentQuestion] ? 'Flagged' : 'Review'}</span>
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 8px' }}
            disabled={currentQuestion <= 1}
            onClick={() => onSelectQuestion(Math.max(1, currentQuestion - 1))}
            title="Previous question"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 8px' }}
            disabled={currentQuestion >= totalQuestions}
            onClick={() => onSelectQuestion(Math.min(totalQuestions, currentQuestion + 1))}
            title="Next question"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="palette-grid">
        {questions.map((qNum) => {
          const answered = isAnswered(qNum);
          const isCurrent = currentQuestion === qNum;
          const isFlagged = !!flagged[qNum];

          let pillClass = 'palette-pill';
          if (isCurrent) pillClass += ' current';
          else if (isFlagged) pillClass += ' flagged';
          else if (answered) pillClass += ' answered';

          return (
            <button
              key={qNum}
              id={`palette-q-${qNum}`}
              className={pillClass}
              onClick={() => onSelectQuestion(qNum)}
              title={`Question ${qNum}: ${answered ? 'Answered' : 'Unanswered'}${isFlagged ? ' (Review Flagged)' : ''}`}
            >
              {qNum}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {onPrevSection && (
          <button
            className="btn btn-secondary"
            onClick={onPrevSection}
            style={{ whiteSpace: 'nowrap', padding: '8px 12px', fontSize: 12.5 }}
          >
            {prevSectionText || '← Previous'}
          </button>
        )}

        {onNextSection ? (
          <button
            className="btn btn-primary"
            onClick={onNextSection}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 18px',
              fontSize: 13,
              background: 'linear-gradient(135deg, var(--accent-blue), #2563eb)',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{nextSectionText || 'Next Section →'}</span>
          </button>
        ) : onSubmit ? (
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 18px',
              fontSize: 13,
              background: 'linear-gradient(135deg, var(--accent-amber), #d97706)',
              boxShadow: '0 2px 10px rgba(217, 119, 6, 0.35)',
              fontWeight: 600
            }}
          >
            Submit Test
          </button>
        ) : null}

        {onNextSection && onSubmit && (
          <button
            className="btn btn-ghost"
            onClick={onSubmit}
            title="Submit test now"
            style={{ fontSize: 11.5, padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            Finish & Submit
          </button>
        )}
      </div>
    </footer>
  );
}
