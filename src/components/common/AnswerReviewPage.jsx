import React, { useRef, useEffect } from 'react';
import Icon from './Icon';
import AnswerReviewList from './AnswerReviewList';
import { ResultPage, ResultItem } from './ResultReveal';

export default function AnswerReviewPage({ skill, itemResults, onBack }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  const name = skill === 'reading' ? 'Reading' : 'Listening';
  return (
    <ResultPage skill={skill} className="answer-review-page">
      <ResultItem as="button" type="button" className="result-back-btn" onClick={onBack}>
        <Icon name="arrowLeft" size={16} /> Back to summary
      </ResultItem>
      <ResultItem as="section">
        <div className="result-section-head">
          <p className="result-eyebrow">{name} · Answer review</p>
          <h1 ref={headingRef} tabIndex={-1} className="result-title">Your answers, question by question</h1>
          <p className="result-section-sub">Compare your answers with the correct answers. Choose “To review” to see mistakes and skipped questions.</p>
        </div>
        <AnswerReviewList itemResults={itemResults} showUnanswered />
      </ResultItem>
      <ResultItem className="result-actions">
        <button type="button" className="result-btn is-secondary" onClick={onBack}>
          <Icon name="arrowLeft" size={18} /> Back to summary
        </button>
      </ResultItem>
    </ResultPage>
  );
}
