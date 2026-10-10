import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedReadingTest, getReadingTest } from '../../data/reading/index';
import { recordAttemptedQuestionSet, createAttemptId, getTargetBand } from '../../utils/storage';
import { evaluateReadingResponses, isCandidateAnswerCorrect } from '../../utils/evaluation/evaluationEngine';
import { calculateReadingBand } from '../../utils/bandCalculator';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import ReadingPassage from '../reading/ReadingPassage';
import ReadingQuestionGroup from '../reading/ReadingQuestionGroup';
import TextSizeControl, { useExamTextScale } from '../common/TextSizeControl';
import AnswerReviewList from '../common/AnswerReviewList';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
import { ResultPage, ResultItem } from '../common/ResultReveal.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;


export default function ReadingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips, onSave }) {
  const [test] = useState(() => initialTest || (testId ? getReadingTest(testId) : getRandomizedReadingTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [answers, setAnswers] = useState({});
  const attemptIdRef = useRef(createAttemptId('reading'));
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [result, setResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  // Compact widths show one pane at a time; regular widths show both side by side.
  const [mobilePane, setMobilePane] = useState('passage');
  const [textScale, setTextScale] = useExamTextScale();
  const passagePaneRef = useRef(null);
  const questionPaneRef = useRef(null);

  // Practice mode timer controls
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  const timerRef = useRef(null);

  // Guard against stale closures when timer expires or during async grading
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const testRef = useRef(test);
  useEffect(() => {
    testRef.current = test;
  }, [test]);

  const handleSubmitRef = useRef();

  // Practice results are saved the moment they exist, so leaving via Back,
  // refreshing or closing the tab never loses the score.
  useEffect(() => {
    if (phase === 'results' && result && !isMockMode) onSave?.(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, isMockMode]);

  const setAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const goToPassage = (idx) => {
    setActiveSectionIndex(idx);
    setMobilePane('passage');
    passagePaneRef.current?.scrollTo({ top: 0 });
    questionPaneRef.current?.scrollTo({ top: 0 });
  };

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (isMockMode) {
            clearInterval(timerRef.current);
            handleSubmitRef.current?.();
            return 0;
          } else {
            // Practice Mode: do not force-exit!
            setIsOvertime(true);
            return 0;
          }
        }
        return t - 1;
      });
    }, 1000);
  }, [isMockMode]);

  useEffect(() => {
    if (initialPhase === 'exam') {
      startTimer();
    }
  }, [initialPhase, startTimer]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const handleStartExam = () => {
    setPhase('exam');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    startTimer();
  };

  const toggleTimerPause = () => {
    if (isMockMode) return;
    if (isTimerPaused) {
      setIsTimerPaused(false);
      startTimer();
    } else {
      setIsTimerPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);

    // Full mock: the whole exam is graded once at the end — hand over the
    // answers and move straight on to Writing.
    if (isMockMode) {
      onComplete?.({ answers: { ...(answersRef.current || answers) }, status: 'submitted' });
      return;
    }

    // Immediately show the processing screen to avoid UI freeze and provide immediate feedback
    setPhase('processing');
    setProcessingStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const stepTimer1 = setTimeout(() => setProcessingStep(1), 600);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1200);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 1800);

    const currentAnswers = answersRef.current || answers;
    const currentTest = testRef.current || test;

    try {
      // Deterministic scoring against the official answer key (zero AI).
      const graded = getReadingTest(currentTest?.testId || testId, true) || currentTest;
      recordAttemptedQuestionSet('reading', currentTest?.testId || testId);
      const evalResult = await evaluateReadingResponses({
        passages: graded?.passages || [],
        answers: currentAnswers,
        attemptId: attemptIdRef.current
      });

      const rawScore = evalResult.raw ?? 0;
      const totalScore = evalResult.total || 40;
      const percentageScore = evalResult.percentage || (totalScore ? Math.round((rawScore / totalScore) * 100) : 0);
      const computedBand = (typeof evalResult.band === 'number' && Number.isFinite(evalResult.band))
        ? evalResult.band
        : calculateReadingBand(rawScore);

      const computedResult = {
        ...evalResult,
        band: computedBand,
        raw: rawScore,
        total: totalScore,
        percentage: percentageScore,
        answers: currentAnswers
      };

      // Ensure user sees the processing steps before advancing
      await new Promise(r => setTimeout(r, 2200));

      if (isMockMode) {
        if (onComplete) onComplete(computedResult);
        return;
      }

      setResult(computedResult);
      setPhase('results');
    } catch (err) {
      console.error('Reading submission evaluation error:', err);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      // Resilient fallback
      try {
        const graded = getReadingTest(currentTest?.testId || testId, true) || currentTest;
        const allQuestions = (graded?.passages || []).flatMap(p => p.questions || []);
        let localRaw = 0;
        const itemResults = {};
        for (const q of allQuestions) {
          const userAns = currentAnswers[q.id];
          const isCorrect = isCandidateAnswerCorrect(userAns, q.acceptedAnswers || q.answer);
          if (isCorrect) localRaw++;
          itemResults[q.id] = {
            deterministicCorrect: isCorrect,
            finalResult: isCorrect ? 'CORRECT' : 'INCORRECT',
            officialAnswer: q.answer,
            candidateAnswer: userAns || null,
            questionNumber: q.questionNumber ?? null,
            questionType: q.type || q.questionType || null,
          };
        }
        const localBand = calculateReadingBand(localRaw);
        const fallbackResult = {
          status: 'completed',
          band: localBand,
          raw: localRaw,
          total: allQuestions.length || 40,
          percentage: allQuestions.length ? Math.round((localRaw / allQuestions.length) * 100) : 0,
          answers: currentAnswers,
          itemResults
        };

        if (isMockMode) {
          if (onComplete) onComplete(fallbackResult);
          return;
        }

        setResult(fallbackResult);
        setPhase('results');
      } catch (fallbackErr) {
        console.error('Critical reading fallback error:', fallbackErr);
        setIsSubmitting(false);
        setPhase('exam');
      }
    }
  };

  handleSubmitRef.current = handleSubmit;

  /* ──────────────────────────────────────────────────────────
     1. INTRO SCREEN
     ────────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <ExamStartScreen
        section="Reading"
        sectionKey="reading"
        testTitle={test?.title || 'IELTS Reading Practice'}
        subtitle="Three full-length authentic IELTS Academic passages with 40 questions under official 60-minute examination conditions."
        metaItems={[
          { label: '3 Passages', sub: 'Authentic academic texts' },
          { label: '60 Minutes', sub: 'Strict exam timing' },
          { label: 'Band 0–9', sub: 'Official Academic conversion' },
        ]}
        rules={[
          'You have exactly 60 minutes to complete all 40 questions across Passages 1, 2, and 3.',
          'There is no additional transfer time—record all answers directly into test fields.',
          'Pay close attention to True / False / Not Given distinctions and word limits.',
        ]}
        scoringInfo="Each correct answer earns 1 mark. Total score out of 40 converts directly to standard IELTS Academic 0–9 band score."
        ctaText="START READING TEST"
        onStart={handleStartExam}
        onBack={onBack}
      />
    );
  }

  /* ──────────────────────────────────────────────────────────
     2. PROCESSING SCREEN (Section 22)
     ────────────────────────────────────────────────────────── */
  if (phase === 'processing') {
    return (
      <div style={{ maxWidth: 640, margin: '100px auto', padding: '0 24px', textAlign: 'center' }}>
        <ScrollToTop />
        <div style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-container)',
          padding: '56px 40px'
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--coral)',
            margin: '0 auto 24px',
            animation: 'spin 0.8s linear infinite'
          }} />

          <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>
            The exam is being processed...
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
            giving the final answers to AI to get a final report.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
            {[
              { label: 'Passage Keyword Matching & Synonyms', active: processingStep >= 0 },
              { label: 'Sentence Completion & Capitalization Check', active: processingStep >= 1 },
              { label: 'Academic Band Scale Rounding', active: processingStep >= 2 },
              { label: 'Error Distribution & Priority Feedback', active: processingStep >= 3 },
            ].map((step, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                fontWeight: 600,
                color: step.active ? 'var(--text-primary)' : 'var(--text-muted)'
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: step.active ? 'rgba(16,185,129,0.15)' : 'var(--surface-sunken)',
                  color: step.active ? 'var(--success-icon)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11
                }}>
                  <Icon name="check" size={12} />
                </div>
                {step.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     3. RESULTS SCREEN (Section 23: Deterministic Practice Result)
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    return (
      <ResultPage skill="reading">
        <ResultItem as="button" type="button" className="result-back-btn" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </ResultItem>

        {/* OVERALL HERO CARD */}
        <ResultItem className="result-hero">
          <div>
            <span className="result-eyebrow">
              {isMockMode ? "READING TEST COMPLETE" : "READING PRACTICE COMPLETE"}
            </span>
            <h1 className="result-title">Reading Assessment</h1>
            <p className="result-lead">
              Score: <strong>{result?.raw} / {result?.total}</strong> correct ({result?.percentage}%)
              {result?.unresolvedCount > 0 && (
                <span className="result-warn-line">
                  Provisional range: {result.rawMin}–{result.rawMax} correct ({result.unresolvedCount} answer{result.unresolvedCount > 1 ? 's' : ''} pending review)
                </span>
              )}
            </p>
          </div>

          <div className="result-band-box">
            <div className="result-band-label">
              {result?.unresolvedCount > 0 ? 'Provisional band' : 'Estimated band'}
            </div>
            {result?.unresolvedCount > 0 && result?.bandMin !== result?.bandMax ? (
              <div className="result-band-value is-range">
                {`${result.bandMin.toFixed(1)}–${result.bandMax.toFixed(1)}`}
              </div>
            ) : (
              <div className={`result-band-value${result?.band !== null && result?.band !== undefined ? '' : ' is-empty'}`}>
                {result?.band !== null && result?.band !== undefined ? Number(result.band).toFixed(1) : '--'}
              </div>
            )}
            <div className="result-band-sub">
              {result?.unresolvedCount > 0 ? 'Range pending review' : `Target: ${getTargetBand() || '8.0'}`}
            </div>
          </div>
        </ResultItem>

        {result?.unresolvedCount > 0 && (
          <ResultItem className="result-callout" role="note">
            <span className="result-callout-icon"><Icon name="alertCircle" size={22} /></span>
            <div className="result-callout-body">
              <div className="result-callout-title">Unresolved answers pending review</div>
              <div className="result-callout-text">
                {result.unresolvedCount} free-text answer{result.unresolvedCount > 1 ? 's' : ''} could not be automatically confirmed against the official answer key.
                Per official IELTS marking principles, credit is not awarded automatically without verified equivalence. Your confirmed score is {result.raw} (Band {result.bandMin.toFixed(1)}), with a potential score of up to {result.rawMax} (Band {result.bandMax.toFixed(1)}) if resolved.
              </div>
            </div>
          </ResultItem>
        )}

        {/* Answer review — every question, from the evaluated item results */}
        {result?.itemResults && Object.keys(result.itemResults).length > 0 && (
          <ResultItem as="section">
            <div className="result-section-head">
              <h2 className="result-section-title"><Icon name="pen" size={20} /> Answer review</h2>
              <p className="result-section-sub">Every question with your answer and the official key. Use “To review” to focus on the ones you missed.</p>
            </div>
            <AnswerReviewList itemResults={result.itemResults} showUnanswered />
          </ResultItem>
        )}

        {/* Detailed analysis — question-type performance + recommendations */}
        {!isMockMode && (
          <ResultItem>
            <ResultAnalysis skill="reading" resultRecord={{ reading: result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
          </ResultItem>
        )}

        {/* PROMINENT CORAL CTA SAVE BUTTON */}
        <ResultItem className="result-actions">
          <button
            id="save-reading-result-btn"
            type="button"
            className="result-btn is-primary"
            onClick={() => onComplete && onComplete(result)}
          >
            <Icon name="check" size={18} />
            <span>Save Score & Return to Dashboard</span>
          </button>
        </ResultItem>
      </ResultPage>
    );
  }

  const passage = test?.passages?.[activeSectionIndex];
  const passageCount = test?.passages?.length || 1;
  const isLast = activeSectionIndex === passageCount - 1;
  const answeredIn = (p) => (p?.questions || []).filter(q => String(answers[q.id] ?? '').trim()).length;

  return (
    <div className="exam-focus-layout reading-split-active">
      <ScrollToTop />
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: 'var(--c-lavender)', color: '#151313' }}>
            {isMockMode ? 'IELTS ACADEMIC READING' : 'IELTS READING PRACTICE'}
          </span>
          <h2 className="exam-focus-title">
            Reading Assessment
          </h2>
        </div>

        <div className="exam-focus-header-right">
          <TextSizeControl scale={textScale} onChange={setTextScale} />

          {!isMockMode && (
            <button
              type="button"
              className={`exam-focus-pause-btn ${isTimerPaused ? 'paused' : ''}`}
              onClick={toggleTimerPause}
              title={isTimerPaused ? "Resume Exam Timer" : "Pause Exam Timer"}
            >
              <Icon name={isTimerPaused ? 'play' : 'pause'} size={14} />
              <span>{isTimerPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <div
            className={`exam-focus-timer-pill ${timeLeft < 300 && !isOvertime ? 'urgent' : ''} ${isTimerPaused ? 'paused' : ''} ${isOvertime ? 'overtime' : ''}`}
            role="timer"
            aria-label={`Time remaining ${FMT(timeLeft)}`}
          >
            <Icon name="clock" size={16} />
            <span>{isTimerPaused ? `${FMT(timeLeft)} [PAUSED]` : isOvertime ? '00:00 (Overtime)' : FMT(timeLeft)}</span>
          </div>

          <button
            type="button"
            className="exam-focus-exit-btn"
            onClick={() => {
              if (window.confirm('Exit the Reading test? Your answers will not be saved.')) onBack();
            }}
          >
            <span>Exit Test</span>
          </button>
        </div>
      </div>

      {/* ── PRACTICE OVERTIME BANNER (Non-strict exit in Practice Mode) ── */}
      {isOvertime && !isMockMode && (
        <div className="practice-overtime-banner" style={{ margin: '16px 24px 0' }}>
          <div className="practice-overtime-content">
            <Icon name="clock" size={20} style={{ color: '#8A6D00', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#151313' }}>
                Standard Practice Time Elapsed (60 Minutes)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                In Practice Mode, the exam does not force-exit. Take all the time you need to answer any remaining questions! When finished, click &ldquo;Finish &amp; Grade Exam&rdquo; below.
              </div>
            </div>
          </div>
          <div className="practice-overtime-actions">
            <button
              type="button"
              className="practice-add-time-btn"
              onClick={() => {
                setTimeLeft(t => t + 5 * 60);
                setIsOvertime(false);
              }}
              title="Add 5 minutes of practice time"
            >
              +5 Mins
            </button>
            <button
              type="button"
              className="practice-submit-now-btn"
              onClick={() => handleSubmit()}
              title="Finish test and grade answers now"
            >
              Finish &amp; Grade
            </button>
          </div>
        </div>
      )}

      {/* Compact widths: one pane at a time */}
      <div className="rd-pane-switch" role="tablist" aria-label="Reading workspace">
        <button type="button" role="tab" aria-selected={mobilePane === 'passage'}
          className={mobilePane === 'passage' ? 'is-active' : ''} onClick={() => setMobilePane('passage')}>
          Passage
        </button>
        <button type="button" role="tab" aria-selected={mobilePane === 'questions'}
          className={mobilePane === 'questions' ? 'is-active' : ''} onClick={() => setMobilePane('questions')}>
          Questions <span className="rd-pane-count">{answeredIn(passage)}/{passage?.questions?.length || 0}</span>
        </button>
      </div>

      {/* ── 2. READING WORKSPACE — passage | questions ── */}
      <div className={`reading-split-panes rd-show-${mobilePane}`} style={{ '--exam-text-scale': textScale }}>
        <div className="reading-pane rd-pane-passage" ref={passagePaneRef}>
          <div className="rd-sheet">
            <ReadingPassage passage={passage} />
          </div>
        </div>

        <div className="reading-pane rd-pane-questions" ref={questionPaneRef}>
          {(passage?.questionGroups || []).map(g => (
            <ReadingQuestionGroup key={g.groupId} group={g} answers={answers} onAnswer={setAnswer} />
          ))}
        </div>
      </div>

      {/* ── 3. UNIVERSAL EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => goToPassage(Math.max(0, activeSectionIndex - 1))}
        isPreviousDisabled={activeSectionIndex === 0}
        previousLabel="Previous Passage"
        sections={(test?.passages || []).map(p => ({
          label: `Passage ${p.passageNumber} · ${answeredIn(p)}/${p.questions?.length || 0}`,
          shortLabel: String(p.passageNumber),
          isCompleted: (p.questions?.length || 0) > 0 && answeredIn(p) === p.questions.length,
        }))}
        activeSectionIndex={activeSectionIndex}
        onSelectSection={goToPassage}
        onNext={() => {
          if (!isLast) goToPassage(activeSectionIndex + 1);
          else handleSubmit();
        }}
        isNextDisabled={isSubmitting}
        nextLabel={!isLast ? 'Next Passage' : (isMockMode ? 'Next Section: Writing' : 'Finish & Grade Test')}
        isSubmit={isLast && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-writing' : 'submit-reading-exam'}
      />
    </div>
  );
}
