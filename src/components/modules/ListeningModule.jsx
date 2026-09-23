import React, { useState } from 'react';
import AudioPlayer from '../common/AudioPlayer';
import QuestionPalette from '../common/QuestionPalette';
import ResultsPage from '../common/ResultsPage';
import ExitConfirmationModal from '../common/ExitConfirmationModal';
import ExitScreen from '../common/ExitScreen';
import { calculateListeningBand, isAnswerCorrect } from '../../utils/bandCalculator';
import { saveSkillScore } from '../../utils/storage';
import { FileText, CheckCircle2, RotateCcw, ArrowLeft, ArrowRight, Send } from 'lucide-react';

export default function ListeningModule({ testData, onComplete, isExamMode = false, onBackToDashboard }) {
  const listening = testData.listening;
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [activePart, setActivePart] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [showAudioscript, setShowAudioscript] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [isReviewed, setIsReviewed] = useState(false);
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

  const handleAnswerChange = (qNum, val) => {
    setAnswers(prev => ({ ...prev, [qNum]: val }));
  };

  const handleMultiSelectChange = (qNumbers, optionLetter) => {
    // For questions like 15-16, where 2 letters are selected
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

  const handleSubmit = () => {
    let rawScore = 0;
    const breakdown = [
      { name: 'Part 1: Buckworth Conservation', score: 0, total: 10 },
      { name: 'Part 2: Tasmania Boat Trip', score: 0, total: 10 },
      { name: 'Part 3: Veterinary Work Experience', score: 0, total: 10 },
      { name: 'Part 4: Labyrinths History', score: 0, total: 10 },
    ];

    listening.parts.forEach((part, pIdx) => {
      part.questions.forEach((q) => {
        if (q.type === 'multi-select') {
          // Check multi-select: user selection vs answer array
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

    const band = calculateListeningBand(rawScore);
    const result = {
      rawScore,
      total: 40,
      bandScore: band,
      breakdown,
      answers
    };

    setScoreResult(result);
    setIsReviewed(true);
    saveSkillScore('listening', result);
    if (onComplete) {
      onComplete(result);
    }
  };

  const currentPartData = listening.parts.find(p => p.part === activePart);

  if (isExited) {
    return (
      <ExitScreen
        sectionTitle="Listening Practice Session"
        onReturnHome={onBackToDashboard}
        onRestartSection={() => {
          setIsExited(false);
          setAnswers({});
          setFlagged({});
          setActivePart(1);
        }}
      />
    );
  }

  // Full-page results view (replaces old modal overlay)
  if (scoreResult) {
    const questionResults = listening.parts.flatMap(part =>
      part.questions.flatMap(q => {
        if (q.type === 'multi-select') {
          const userArr = answers[q.questionNumbers?.[0]] || [];
          return [{ id: q.questionNumbers?.[0], answer: userArr.join(','), expected: (q.answer || []).join(','), correct: userArr.sort().join(',') === (q.answer || []).sort().join(',') }];
        }
        return [{ id: q.id, answer: answers[q.id] || '', expected: q.answer, correct: isAnswerCorrect(answers[q.id], q.answer) }];
      })
    );
    return (
      <ResultsPage
        title="Listening Test Results"
        moduleName="Listening"
        accentColor="var(--accent-blue)"
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
          setActivePart(1);
        }}
        onBackToDashboard={onBackToDashboard}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Audio Player */}
      <AudioPlayer
        src={listening.audioUrl}
        title={`${testData.title} — Listening Test`}
        autoPlay={isExamMode}
      />

      {/* Part Navigation & Script Toggle */}
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
          {listening.parts.map((p) => (
            <button
              key={p.part}
              className={`segmented-btn ${activePart === p.part ? 'active' : ''}`}
              onClick={() => setActivePart(p.part)}
            >
              <span>Part {p.part}</span>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                Q{p.questions[0].type === 'multi-select' ? p.questions[0].questionNumbers[0] : p.questions[0].id}–
                {p.questions[p.questions.length - 1].type === 'multi-select'
                  ? p.questions[p.questions.length - 1].questionNumbers[1]
                  : p.questions[p.questions.length - 1].id}
              </span>
            </button>
          ))}
          </div>
        </div>

        {!isExamMode && (
          <button
            className="btn btn-secondary"
            onClick={() => setShowAudioscript(!showAudioscript)}
          >
            <FileText size={15} />
            <span>{showAudioscript ? 'Hide Audioscript' : 'View Audioscript'}</span>
          </button>
        )}
      </div>

      {/* Optional Audioscript Drawer */}
      {showAudioscript && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          maxHeight: 280,
          overflowY: 'auto',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: 'var(--text-secondary)'
        }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: 10, fontSize: 14 }}>
            Official Audioscript (Reference)
          </h4>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {listening.audioscript}
          </pre>
        </div>
      )}

      {/* Questions Form */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            {currentPartData.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {currentPartData.instructions}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {currentPartData.questions.map((q) => {
            if (q.type === 'fill') {
              const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
              return (
                <div
                  key={q.id}
                  id={`q-${q.id}`}
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
                  <div style={{ fontSize: 14.5 }}>
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

            if (q.type === 'mcq') {
              const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
              return (
                <div
                  key={q.id}
                  id={`q-${q.id}`}
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
                  <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 8 }}>
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
                            name={`q_${q.id}`}
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
                  id={`q-${q1}`}
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
                  <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 8 }}>
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

            if (q.type === 'matching') {
              const isCorrect = isReviewed ? isAnswerCorrect(answers[q.id], q.answer) : null;
              return (
                <div
                  key={q.id}
                  id={`q-${q.id}`}
                  className={`question-item ${currentQuestion === q.id ? 'active-question' : ''}`}
                  onClick={() => setCurrentQuestion(q.id)}
                >
                  <div className="question-header">
                    <span className="question-number-badge">Question {q.id} — {q.moduleName}</span>
                    {isReviewed && (
                      <span className={`badge ${isCorrect ? 'badge-green' : 'badge-red'}`}>
                        {isCorrect ? 'Correct (+1)' : `Expected: ${q.answer}`}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <select
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        fontSize: 13.5,
                        width: '100%',
                        maxWidth: 450
                      }}
                    >
                      <option value="">Select an opinion (A–F)...</option>
                      {q.options.map((opt, optIdx) => (
                        <option key={optIdx} value={opt.charAt(0)}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* CD-IELTS Question Palette with Sticky Next Section Navigation */}
      <QuestionPalette
        totalQuestions={40}
        answers={answers}
        flagged={flagged}
        currentQuestion={currentQuestion}
        onSelectQuestion={(qNum) => {
          setCurrentQuestion(qNum);
          // Auto switch part if needed
          if (qNum <= 10) setActivePart(1);
          else if (qNum <= 20) setActivePart(2);
          else if (qNum <= 30) setActivePart(3);
          else setActivePart(4);

          setTimeout(() => {
            const el = document.getElementById(`q-${qNum}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }}
        onToggleFlag={toggleFlag}
        onSubmit={handleSubmit}
        nextSectionText={activePart < 4 ? `Next Section: Part ${activePart + 1} →` : null}
        onNextSection={activePart < 4 ? () => {
          const nextP = activePart + 1;
          setActivePart(nextP);
          setCurrentQuestion((nextP - 1) * 10 + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } : null}
        prevSectionText={activePart > 1 ? `← Part ${activePart - 1}` : null}
        onPrevSection={activePart > 1 ? () => {
          const prevP = activePart - 1;
          setActivePart(prevP);
          setCurrentQuestion((prevP - 1) * 10 + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } : null}
      />

      {/* Exit Confirmation Guard Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Listening Practice Session"
      />
    </div>
  );
}
