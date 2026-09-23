import React, { useState } from 'react';
import QuestionPalette from '../common/QuestionPalette';
import CountdownTimer from '../common/CountdownTimer';
import ScoreModal from '../common/ScoreModal'; // kept for type compatibility
import ResultsPage from '../common/ResultsPage';
import ExitConfirmationModal from '../common/ExitConfirmationModal';
import ExitScreen from '../common/ExitScreen';
import { calculateReadingBand, isAnswerCorrect } from '../../utils/bandCalculator';
import { saveSkillScore } from '../../utils/storage';
import { Highlighter, Trash2, CheckCircle2, RotateCcw, ArrowLeft, ArrowRight, Send } from 'lucide-react';

export default function ReadingModule({ testData, onComplete, isExamMode = false, onBackToDashboard }) {
  const reading = testData.reading;
  const [activePassageIdx, setActivePassageIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [scoreResult, setScoreResult] = useState(null);
  const [isReviewed, setIsReviewed] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState('yellow');
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isExited, setIsExited] = useState(false);

  const hasProgress = Object.keys(answers).length > 0 && !isReviewed;

  const handleBackClick = () => {
    if (hasProgress && !isExamMode) {
      setIsExitModalOpen(true);
    } else if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    setAnswers({});
    setFlagged({});
    setIsExited(true);
  };

  const currentPassage = reading.passages[activePassageIdx];

  const handleAnswerChange = (qNum, val) => {
    setAnswers(prev => ({ ...prev, [qNum]: val }));
  };

  const handleMultiSelectChange = (qNumbers, optionLetter) => {
    const primaryNum = qNumbers[0];
    const secondaryNum = qNumbers[1];
    const currentList = Array.isArray(answers[primaryNum]) ? [...answers[primaryNum]] : [];

    let updated;
    if (currentList.includes(optionLetter)) {
      updated = currentList.filter(l => l !== optionLetter);
    } else {
      if (currentList.length < qNumbers.length) {
        updated = [...currentList, optionLetter];
      } else {
        updated = [currentList[1], optionLetter];
      }
    }

    setAnswers(prev => ({
      ...prev,
      [primaryNum]: updated,
      [secondaryNum]: updated
    }));
  };

  const toggleFlag = (qNum) => {
    setFlagged(prev => ({ ...prev, [qNum]: !prev[qNum] }));
  };

  // Text highlighting tool for passages
  const highlightSelection = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = `highlight-${activeHighlightColor}`;
    span.textContent = range.toString();

    range.deleteContents();
    range.insertNode(span);
    selection.removeAllRanges();
  };

  const clearHighlights = () => {
    const pane = document.getElementById('passage-content-area');
    if (!pane) return;
    const highlights = pane.querySelectorAll('.highlight-yellow, .highlight-green, .highlight-blue');
    highlights.forEach(h => {
      const parent = h.parentNode;
      while (h.firstChild) {
        parent.insertBefore(h.firstChild, h);
      }
      parent.removeChild(h);
    });
  };

  const handleSubmit = () => {
    let rawScore = 0;
    const breakdown = [
      { name: 'Passage 1: London Underground', score: 0, total: 13 },
      { name: 'Passage 2: Stadiums Past & Future', score: 0, total: 13 },
      { name: 'Passage 3: To Catch a King', score: 0, total: 14 },
    ];

    reading.passages.forEach((p, pIdx) => {
      p.questions.forEach((q) => {
        if (q.type === 'multi-select') {
          const userArr = answers[q.questionNumbers[0]] || [];
          const expArr = q.answer;
          const matches = userArr.filter(item => expArr.includes(item));
          rawScore += matches.length;
          breakdown[pIdx].score += matches.length;
        } else {
          const userAns = answers[q.id];
          if (isAnswerCorrect(userAns, q.answer)) {
            rawScore += 1;
            breakdown[pIdx].score += 1;
          }
        }
      });
    });

    const band = calculateReadingBand(rawScore);
    const result = {
      rawScore,
      total: 40,
      bandScore: band,
      breakdown,
      answers
    };

    setScoreResult(result);
    setIsReviewed(true);
    saveSkillScore('reading', result);
    if (onComplete) {
      onComplete(result);
    }
  };

  if (isExited) {
    return (
      <ExitScreen
        sectionTitle="Reading Practice Session"
        onReturnHome={onBackToDashboard}
        onRestartSection={() => {
          setIsExited(false);
          setAnswers({});
          setFlagged({});
          setActivePassageIdx(0);
          clearHighlights();
        }}
      />
    );
  }

  // Full-page results view (replaces old modal overlay)
  if (scoreResult) {
    const questionResults = reading.passages.flatMap(p =>
      p.questions.flatMap(q => {
        if (q.type === 'multi-select') {
          const userArr = answers[q.questionNumbers?.[0]] || [];
          return [{ id: q.questionNumbers?.[0], answer: userArr.join(','), expected: (q.answer || []).join(','), correct: userArr.sort().join(',') === (q.answer || []).sort().join(',') }];
        }
        return [{ id: q.id, answer: answers[q.id] || '', expected: q.answer, correct: isAnswerCorrect(answers[q.id], q.answer) }];
      })
    );
    return (
      <ResultsPage
        title="Reading Test Results"
        moduleName="Reading"
        accentColor="var(--accent-green)"
        rawScore={scoreResult.rawScore}
        totalQuestions={scoreResult.total}
        bandScore={scoreResult.bandScore}
        breakdown={scoreResult.breakdown}
        questionResults={questionResults}
        onRetake={() => {
          setAnswers({});
          setFlagged({});
          setIsReviewed(false);
          setScoreResult(null);
          setActivePassageIdx(0);
          clearHighlights();
        }}
        onBackToDashboard={onBackToDashboard}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBackToDashboard && !isExamMode && (
            <button
              className="btn btn-ghost"
              onClick={handleBackClick}
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              <ArrowLeft size={15} />
              <span>Back to Dashboard</span>
            </button>
          )}

          <div className="segmented-control">
          {reading.passages.map((p, idx) => (
            <button
              key={p.passageNumber}
              className={`segmented-btn ${activePassageIdx === idx ? 'active' : ''}`}
              onClick={() => setActivePassageIdx(idx)}
            >
              <span>Passage {p.passageNumber}</span>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                Q{p.questions[0].id}–{p.questions[p.questions.length - 1].type === 'multi-select'
                  ? p.questions[p.questions.length - 1].questionNumbers[1]
                  : p.questions[p.questions.length - 1].id}
              </span>
            </button>
          ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Highlighter Palette */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <Highlighter size={14} color="var(--text-muted)" />
            <button
              onClick={() => { setActiveHighlightColor('yellow'); highlightSelection(); }}
              style={{ width: 18, height: 18, borderRadius: '50%', background: '#e9b949', border: activeHighlightColor === 'yellow' ? '2px solid #fff' : 'none', cursor: 'pointer' }}
              title="Highlight Selection Yellow"
            />
            <button
              onClick={() => { setActiveHighlightColor('green'); highlightSelection(); }}
              style={{ width: 18, height: 18, borderRadius: '50%', background: '#4dab9a', border: activeHighlightColor === 'green' ? '2px solid #fff' : 'none', cursor: 'pointer' }}
              title="Highlight Selection Green"
            />
            <button
              onClick={() => { setActiveHighlightColor('blue'); highlightSelection(); }}
              style={{ width: 18, height: 18, borderRadius: '50%', background: '#529cca', border: activeHighlightColor === 'blue' ? '2px solid #fff' : 'none', cursor: 'pointer' }}
              title="Highlight Selection Blue"
            />
            <button
              className="btn-ghost"
              onClick={clearHighlights}
              style={{ padding: '2px 4px', fontSize: 11, cursor: 'pointer' }}
              title="Clear all highlights in passage"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <CountdownTimer initialMinutes={60} isActive={true} />
        </div>
      </div>

      {/* Split-Screen Reader View */}
      <div className="reading-split-container">
        {/* Left Passage Pane */}
        <div className="reading-passage-pane">
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
            <div>
              <span className="badge badge-green" style={{ marginBottom: 6 }}>
                Reading Passage {currentPassage.passageNumber}
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, marginTop: 4 }}>
                {currentPassage.title}
              </h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Tip: Select any text and click the highlighter above to mark keywords.
              </div>
            </div>
            <img
              src="/images/mr_crocs_frame3_reading.png"
              alt="Mr. Crocs Reading"
              style={{
                width: 52,
                height: 52,
                objectFit: 'contain',
                filter: 'drop-shadow(0 3px 8px rgba(112, 197, 110, 0.3))',
                flexShrink: 0
              }}
              title="Mr. Crocs Literature Coach"
            />
          </div>

          <div id="passage-content-area" style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
            {currentPassage.text}
          </div>
        </div>

        {/* Right Questions Pane */}
        <div className="reading-questions-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Questions</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Passage {currentPassage.passageNumber} of 3
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {currentPassage.questions.map((q) => {
              if (q.type === 'fill') {
                const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
                return (
                  <div
                    key={q.id}
                    id={`rq-${q.id}`}
                    className={`question-item ${currentQuestion === q.id ? 'active-question' : ''}`}
                    onClick={() => setCurrentQuestion(q.id)}
                  >
                    <div className="question-header">
                      <span className="question-number-badge">Question {q.id}</span>
                      {isReviewed && (
                        <span className={`badge ${isCorrect ? 'badge-green' : 'badge-red'}`}>
                          {isCorrect ? 'Correct (+1)' : `Expected: ${Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14 }}>
                      <span>{q.prompt} </span>
                      <input
                        type="text"
                        className="fill-inline-input"
                        placeholder={`[ ${q.id} ]`}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      />
                      <span> {q.suffix}</span>
                    </div>
                  </div>
                );
              }

              if (q.type === 't_f_ng' || q.type === 'y_n_ng') {
                const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
                const options = q.type === 't_f_ng' 
                  ? ['TRUE', 'FALSE', 'NOT GIVEN'] 
                  : ['YES', 'NO', 'NOT GIVEN'];

                return (
                  <div
                    key={q.id}
                    id={`rq-${q.id}`}
                    className={`question-item ${currentQuestion === q.id ? 'active-question' : ''}`}
                    onClick={() => setCurrentQuestion(q.id)}
                  >
                    <div className="question-header">
                      <span className="question-number-badge">Question {q.id}</span>
                      {isReviewed && (
                        <span className={`badge ${isCorrect ? 'badge-green' : 'badge-red'}`}>
                          {isCorrect ? 'Correct (+1)' : `Expected: ${q.answer}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
                      {q.prompt}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {options.map((opt) => {
                        const isSelected = answers[q.id] === opt;
                        return (
                          <button
                            key={opt}
                            className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleAnswerChange(q.id, opt)}
                            style={{ flex: 1, padding: '6px 10px', fontSize: 12.5 }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (q.type === 'mcq') {
                const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
                return (
                  <div
                    key={q.id}
                    id={`rq-${q.id}`}
                    className={`question-item ${currentQuestion === q.id ? 'active-question' : ''}`}
                    onClick={() => setCurrentQuestion(q.id)}
                  >
                    <div className="question-header">
                      <span className="question-number-badge">Question {q.id}</span>
                      {isReviewed && (
                        <span className={`badge ${isCorrect ? 'badge-green' : 'badge-red'}`}>
                          {isCorrect ? 'Correct (+1)' : `Expected: ${q.answer}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                      {q.prompt}
                    </div>
                    <div className="mcq-options-list">
                      {q.options.map((opt, oIdx) => {
                        const letter = opt.charAt(0);
                        const isSelected = answers[q.id] === letter;
                        return (
                          <div
                            key={oIdx}
                            className={`mcq-option-label ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleAnswerChange(q.id, letter)}
                          >
                            <input
                              type="radio"
                              name={`rq_${q.id}`}
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ marginTop: 3 }}
                            />
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (q.type === 'multi-select') {
                const [q1, q2] = q.questionNumbers;
                const userSelection = answers[q1] || [];
                return (
                  <div
                    key={q.id}
                    id={`rq-${q1}`}
                    className={`question-item ${currentQuestion === q1 || currentQuestion === q2 ? 'active-question' : ''}`}
                    onClick={() => setCurrentQuestion(q1)}
                  >
                    <div className="question-header">
                      <span className="question-number-badge">Questions {q1} & {q2}</span>
                      {isReviewed && (
                        <span className="badge badge-neutral">
                          Answer: {q.answer.join(', ')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                      {q.prompt}
                    </div>
                    <div className="mcq-options-list">
                      {q.options.map((opt, oIdx) => {
                        const letter = opt.charAt(0);
                        const isSelected = userSelection.includes(letter);
                        return (
                          <div
                            key={oIdx}
                            className={`mcq-option-label ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleMultiSelectChange(q.questionNumbers, letter)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              style={{ marginTop: 3 }}
                            />
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>

      {/* Bottom Question Palette with Sticky Next Section Navigation */}
      <QuestionPalette
        totalQuestions={40}
        answers={answers}
        flagged={flagged}
        currentQuestion={currentQuestion}
        onSelectQuestion={(qNum) => {
          setCurrentQuestion(qNum);
          // Auto switch passage if needed
          if (qNum <= 13) setActivePassageIdx(0);
          else if (qNum <= 26) setActivePassageIdx(1);
          else setActivePassageIdx(2);

          setTimeout(() => {
            const el = document.getElementById(`rq-${qNum}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }}
        onToggleFlag={toggleFlag}
        onSubmit={handleSubmit}
        nextSectionText={activePassageIdx < reading.passages.length - 1 ? `Next Section: Passage ${activePassageIdx + 2} →` : null}
        onNextSection={activePassageIdx < reading.passages.length - 1 ? () => {
          const nextIdx = activePassageIdx + 1;
          setActivePassageIdx(nextIdx);
          setCurrentQuestion(nextIdx === 1 ? 14 : 27);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } : null}
        prevSectionText={activePassageIdx > 0 ? `← Passage ${activePassageIdx}` : null}
        onPrevSection={activePassageIdx > 0 ? () => {
          const prevIdx = activePassageIdx - 1;
          setActivePassageIdx(prevIdx);
          setCurrentQuestion(prevIdx === 0 ? 1 : 14);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } : null}
      />

      {/* Exit Confirmation Guard Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Reading Practice Session"
      />
    </div>
  );
}
