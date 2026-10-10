import React from 'react';

/**
 * One assessment criterion on a Writing / Speaking results screen:
 * name + band, the personalised assessment, evidence-based corrections with a
 * natural alternative, and the action that reaches the next band.
 */
export default function CriterionFeedbackCard({
  title,
  subtitle,
  band,
  bandFallback = 'Not scored',
  assessmentLabel = 'Personalized Assessment',
  assessment,
  corrections = [],
  advice,
  children,
}) {
  const hasBand = typeof band === 'number';
  return (
    <div className="result-card result-feedback-card">
      <div className="result-feedback-head">
        <div style={{ minWidth: 0 }}>
          <h3 className="result-card-title">{title}</h3>
          {subtitle && <p className="result-feedback-sub">{subtitle}</p>}
        </div>
        {hasBand ? (
          <div className="result-band-chip" aria-label={`Band ${band.toFixed(1)} of 9`}>
            <b>{band.toFixed(1)}</b><span>/ 9</span>
          </div>
        ) : (
          <span className="result-badge">{bandFallback}</span>
        )}
      </div>

      {children}

      {assessment && (
        <div className="result-feedback-block">
          <div className="result-label">{assessmentLabel}</div>
          <p className="result-text">{assessment}</p>
        </div>
      )}

      {corrections.length > 0 && (
        <div className="result-feedback-block">
          <div className="result-label">Evidence-Based Corrections &amp; Natural Alternatives</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {corrections.map((corr, idx) => (
              <div key={idx} className="result-correction">
                {(corr.task === 1 || corr.task === 2) && (
                  <span className="result-correction-task">Task {corr.task}</span>
                )}
                <div className="result-correction-line">
                  <span className="result-correction-mark is-bad" aria-hidden="true">✗</span>
                  <div>
                    <div className="result-correction-tag">Your wording</div>
                    <span style={{ fontStyle: 'italic' }}>"{corr.original}"</span>
                  </div>
                </div>
                <div className="result-correction-line">
                  <span className="result-correction-mark is-good" aria-hidden="true">✓</span>
                  <div>
                    <div className="result-correction-tag is-good">More natural alternative</div>
                    <strong>"{corr.alternative}"</strong>
                  </div>
                </div>
                {corr.explanation && (
                  <div className="result-correction-why"><strong>Why:</strong> {corr.explanation}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {advice && (
        <div className="result-advice">
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1.4 }}>🎯</span>
          <div>
            <div className="result-label">Action to Reach Next Band</div>
            <p className="result-text" style={{ fontSize: 15.5 }}>{advice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
