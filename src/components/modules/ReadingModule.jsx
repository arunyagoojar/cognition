import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedReadingTest, getReadingTest } from '../../data/reading/index';
import { recordAttemptedQuestionSet, createAttemptId } from '../../utils/storage';
import { evaluateReadingResponses } from '../../utils/evaluation/evaluationEngine';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import ReadingPassage from '../reading/ReadingPassage';
import ReadingQuestionGroup from '../reading/ReadingQuestionGroup';
import TextSizeControl, { useExamTextScale } from '../common/TextSizeControl';
import AnswerReviewList from '../common/AnswerReviewList';
import ResultAnalysis from '../common/ResultAnalysis.jsx';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;


export default function ReadingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips }) {
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

  const timerRef = useRef(null);

  const setAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));
  const goToPassage = (idx) => {
    setActiveSectionIndex(idx);
    setMobilePane('passage');
    passagePaneRef.current?.scrollTo({ top: 0 });
    questionPaneRef.current?.scrollTo({ top: 0 });
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (initialPhase === 'exam') {
      startTimer();
    }
  }, [initialPhase]);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const handleStartExam = () => {
    setPhase('exam');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    startTimer();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);

    // Immediately show the processing screen to avoid UI freeze and provide immediate feedback
    setPhase('processing');
    setProcessingStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const stepTimer1 = setTimeout(() => setProcessingStep(1), 600);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1200);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 1800);

    try {
      // Deterministic scoring against the official answer key (zero AI).
      const graded = getReadingTest(test?.testId || testId, true) || test;
      const evalResult = await evaluateReadingResponses({
        passages: graded?.passages || [],
        answers,
        attemptId: attemptIdRef.current
      });

      const computedResult = {
        ...evalResult,
        band: evalResult.band,
        raw: evalResult.raw,
        total: evalResult.total || 40,
        percentage: evalResult.percentage || 0,
        answers
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
      setIsSubmitting(false);
      setPhase('exam');
    }
  };

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
      <div style={{ maxWidth: 960, margin: '40px auto', padding: '0 24px 80px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: 24
          }}
        >
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </button>

        {/* OVERALL HERO CARD */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid #151313',
          borderRadius: 24,
          padding: '40px',
          marginBottom: 32,
          boxShadow: '0 4px 0 #151313',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 24
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: 8,
              background: '#151313',
              color: '#BE94F5',
              marginBottom: 12
            }}>
              {isMockMode ? "READING TEST COMPLETE" : "READING PRACTICE COMPLETE"}
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Reading Assessment
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Score: <strong style={{ color: 'var(--text-primary)' }}>{result?.raw} / {result?.total}</strong> correct ({result?.percentage}%)
            </p>
          </div>

          <div style={{
            background: 'var(--bg-canvas)',
            padding: '24px 36px',
            borderRadius: 20,
            textAlign: 'center',
            border: '1.5px solid #151313',
            boxShadow: '0 2px 0 #151313',
            minWidth: 180
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ESTIMATED BAND
            </div>
            <div style={{
              fontSize: 54,
              fontWeight: 800,
              color: 'var(--c-coral)',
              lineHeight: 1.1,
              marginTop: 6,
              fontFamily: 'Kodchasan, sans-serif'
            }}>
              {result?.band !== null && result?.band !== undefined ? Number(result.band).toFixed(1) : '--'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 700 }}>
              Target: 8.0
            </div>
          </div>
        </div>

        {/* Answer review — correct/incorrect, accepted variants tagged subtly */}
        {result?.itemResults && Object.keys(result.itemResults).length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
              <Icon name="pen" size={15} /> Answer Review
            </div>
            <AnswerReviewList itemResults={result.itemResults} showUnanswered />
          </div>
        )}

        {/* Detailed analysis — question-type performance + recommendations */}
        {!isMockMode && (
          <div style={{ marginBottom: 36 }}>
            <ResultAnalysis skill="reading" resultRecord={{ reading: result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
          </div>
        )}



        {/* PROMINENT CORAL CTA SAVE BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1.5px solid #151313' }}>
          <button
            id="save-reading-result-btn"
            type="button"
            onClick={() => onComplete && onComplete(result)}
            style={{
              padding: '16px 36px',
              borderRadius: 16,
              background: '#FF5734',
              color: '#151313',
              fontSize: 16,
              fontWeight: 800,
              border: '1.5px solid #151313',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 0 #151313',
              fontFamily: 'Kodchasan, sans-serif'
            }}
          >
            <Icon name="check" size={18} />
            <span>Save Score & Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  const passage = test?.passages?.[activeSectionIndex];
  const passageCount = test?.passages?.length || 1;
  const isLast = activeSectionIndex === passageCount - 1;
  const answeredIn = (p) => (p?.questions || []).filter(q => String(answers[q.id] ?? '').trim()).length;

  return (
    <div className="exam-focus-layout reading-split-active">
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
          <div className={`exam-focus-timer-pill ${timeLeft < 300 ? 'urgent' : ''}`} role="timer" aria-label={`Time remaining ${FMT(timeLeft)}`}>
            <Icon name="clock" size={16} />
            <span>{FMT(timeLeft)}</span>
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
