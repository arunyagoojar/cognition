import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiWaitNote from '../common/AiWaitNote';
import { Icon } from '../common/Icon';
import { getRandomizedWritingTest, getWritingTest } from '../../data/writing/index';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import { evaluateWritingWithAI } from '../../utils/geminiEvaluator';
import { createAttemptId, getTargetBand } from '../../utils/storage';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
import { ResultPage, ResultItem } from '../common/ResultReveal.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';
import CriterionFeedbackCard from '../common/CriterionFeedbackCard.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import TextSizeControl, { useExamTextScale } from '../common/TextSizeControl';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const wordCount = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
const WRITING_SESSION_PREFIX = 'cognition_writing_active_session';

function readSavedWritingSession() {
  try {
    const raw = sessionStorage.getItem(WRITING_SESSION_PREFIX);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function WritingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips, onSave }) {
  const [test] = useState(() => initialTest || (testId ? getWritingTest(testId) : getRandomizedWritingTest()));
  // Restore only the same test in the same mode — never carry a practice
  // essay into a mock (or into a different practice test).
  const [initialSession] = useState(() => {
    const saved = readSavedWritingSession();
    const sameTest = saved && saved.testId === (test?.testId || testId) && Boolean(saved.isMockMode) === Boolean(isMockMode);
    return sameTest ? saved : null;
  });

  const [phase, setPhase] = useState(() => {
    if (initialSession?.phase && ['exam', 'processing', 'results'].includes(initialSession.phase)) {
      // a reload mid-evaluation has no result yet — reopen the essays instead
      if (initialSession.phase !== 'exam' && !initialSession.result) return 'exam';
      return initialSession.phase === 'processing' ? 'results' : initialSession.phase;
    }
    return initialPhase;
  });
  const [task, setTask] = useState(() => initialSession?.task || 1);
  const [t1, setT1] = useState(() => initialSession?.t1 || '');
  const [t2, setT2] = useState(() => initialSession?.t2 || '');
  const [timeLeft, setTimeLeft] = useState(() => (typeof initialSession?.timeLeft === 'number' ? initialSession.timeLeft : 60 * 60));
  const [result, setResult] = useState(() => initialSession?.result || null);
  const [processingStep, setProcessingStep] = useState(0);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textScale, setTextScale] = useExamTextScale();
  const [mobilePane, setMobilePane] = useState('task');

  // Practice mode timer controls
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  const timerRef = useRef(null);

  // Guards against stale closure bugs
  const t1Ref = useRef(t1);
  useEffect(() => {
    t1Ref.current = t1;
  }, [t1]);

  const t2Ref = useRef(t2);
  useEffect(() => {
    t2Ref.current = t2;
  }, [t2]);

  const handleSubmitRef = useRef();

  // Practice results are saved the moment they exist (and again after a
  // re-check), so leaving via Back, refreshing or closing never loses them.
  // The attempt id lives in the result so a restored session updates the
  // same record instead of creating a duplicate.
  useEffect(() => {
    if (phase !== 'results' || !result || isMockMode) return;
    if (!result.attemptId) {
      setResult(r => (r && !r.attemptId ? { ...r, attemptId: createAttemptId('writing') } : r));
      return;
    }
    const completed = typeof result.band === 'number' && Number.isFinite(result.band);
    onSave?.({
      attemptId: result.attemptId,
      testId: test?.testId || testId,
      testLabel: test?.title || 'IELTS Writing Practice',
      status: completed ? 'completed' : 'partial',
      band: completed ? result.band : null,
      task1Band: result.task1Band ?? null,
      task2Band: result.task2Band ?? null,
      evaluationStatus: result.evaluationStatus || result.status || (completed ? 'completed' : 'failed'),
      criteria: result.criteria || null,
      taskCriteria: result.taskCriteria || null,
      overallSummary: result.overallSummary || '',
      task1Feedback: result.task1Feedback || '',
      task2Feedback: result.task2Feedback || '',
      strengths: result.strengths || '',
      areasForImprovement: result.areasForImprovement || '',
      task1Words: result.task1Words || 0,
      task2Words: result.task2Words || 0,
      t1: result.t1 ?? t1,
      t2: result.t2 ?? t2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, isMockMode]);

  const clearSession = () => {
    try {
      sessionStorage.removeItem(WRITING_SESSION_PREFIX);
    } catch {}
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
            // In Practice Mode: do not force-exit!
            setIsOvertime(true);
            return 0;
          }
        }
        return t - 1;
      });
    }, 1000);
  }, [isMockMode]);

  useEffect(() => {
    if (phase === 'exam' && !timerRef.current) {
      startTimer();
    }
  }, [phase, startTimer]);

  useEffect(() => {
    if (phase === 'intro') return;
    try {
      sessionStorage.setItem(WRITING_SESSION_PREFIX, JSON.stringify({
        testId: test?.testId || testId,
        isMockMode,
        phase,
        task,
        t1,
        t2,
        timeLeft,
        result
      }));
    } catch {}
  }, [phase, task, t1, t2, timeLeft, result]);

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
    const currentT1 = t1Ref.current ?? t1;
    const currentT2 = t2Ref.current ?? t2;
    const wc1 = wordCount(currentT1);
    const wc2 = wordCount(currentT2);

    // Full mock: the essays are evaluated once with the whole exam at the end.
    if (isMockMode) {
      clearSession();
      onComplete?.({ t1: currentT1, t2: currentT2, task1Words: wc1, task2Words: wc2, status: 'submitted' });
      return;
    }

    // Immediately show processing screen to prevent UI freeze and multiple clicks
    setPhase('processing');
    setProcessingStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const stepTimer1 = setTimeout(() => setProcessingStep(1), 600);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1200);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 1800);

    try {
      const evalResult = await evaluateWritingWithAI({
        task1Text: currentT1,
        task2Text: currentT2,
        prompts: {
          task1: test?.task1?.prompt || '',
          task2: test?.task2?.prompt || '',
          task1Data: test?.task1 ? {
            visualType: test.task1.visualType,
            table: test.task1.table,
            image: test.task1.image?.file,
          } : null,
        }
      });

      const computedResult = {
        band: evalResult.overallBand,
        task1Band: evalResult.task1Band,
        task2Band: evalResult.task2Band,
        task1Words: wc1,
        task2Words: wc2,
        t1: currentT1,
        t2: currentT2,
        ...evalResult
      };

      await new Promise(r => setTimeout(r, 2200));

      if (isMockMode) {
        if (onComplete) onComplete(computedResult);
        return;
      }

      setResult(computedResult);
      setPhase('results');
    } catch (err) {
      console.error('Writing evaluation error:', err);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsSubmitting(false);
      setPhase('exam');
    }
  };

  handleSubmitRef.current = handleSubmit;

  const handleRecheck = async () => {
    if (isRechecking) return;
    setIsRechecking(true);
    setPhase('processing');
    setProcessingStep(0);
    const s1 = setTimeout(() => setProcessingStep(1), 500);
    const s2 = setTimeout(() => setProcessingStep(2), 1000);
    const s3 = setTimeout(() => setProcessingStep(3), 1500);

    const essayT1 = result?.t1 ?? t1 ?? '';
    const essayT2 = result?.t2 ?? t2 ?? '';
    const wcT1 = wordCount(essayT1);
    const wcT2 = wordCount(essayT2);

    try {
      const evalResult = await evaluateWritingWithAI({
        task1Text: essayT1,
        task2Text: essayT2,
        prompts: {
          task1: test?.task1?.prompt || '',
          task2: test?.task2?.prompt || '',
          task1Data: test?.task1 ? {
            visualType: test.task1.visualType,
            table: test.task1.table,
            image: test.task1.image?.file,
          } : null,
        }
      });

      setResult({
        band: evalResult.overallBand,
        task1Band: evalResult.task1Band,
        task2Band: evalResult.task2Band,
        task1Words: wcT1,
        task2Words: wcT2,
        t1: essayT1,
        t2: essayT2,
        ...evalResult
      });
    } catch (err) {
      console.error('Recheck failed:', err);
      setResult(prev => ({
        ...prev,
        evaluationStatus: 'failed',
        message: err?.message || 'AI evaluation failed. Please check your connection and retry.'
      }));
    } finally {
      clearTimeout(s1);
      clearTimeout(s2);
      clearTimeout(s3);
      setIsRechecking(false);
      setPhase('results');
    }
  };

  /* ──────────────────────────────────────────────────────────
     1. INTRO SCREEN
     ────────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <ExamStartScreen
        section="Writing"
        sectionKey="writing"
        testTitle={test?.title || 'IELTS Writing Practice'}
        subtitle="Two authentic IELTS Academic tasks under official timed test conditions: Task 1 Visual Report & Task 2 Discursive Essay."
        metaItems={[
          { label: '2 Tasks', sub: 'Report (T1) & Essay (T2)' },
          { label: '60 Minutes', sub: 'Strict timed sequence' },
          { label: 'Band 0–9', sub: 'Official-style scoring' },
        ]}
        rules={[
          'Task 1: Summarize visual information by selecting and reporting the main features (min 150 words).',
          'Task 2: Write a formal discursive essay presenting a supported argument (min 250 words).',
          'Underlength submissions are penalized. Task 2 carries twice the weight of Task 1 in final score.',
        ]}
        scoringInfo="Assessed across Task Achievement / Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy."
        ctaText="START WRITING TEST"
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
              { label: 'Task Response & Overview Presence', active: processingStep >= 0 },
              { label: 'Coherence & Cohesion Paragraphing', active: processingStep >= 1 },
              { label: 'Lexical Variety & Academic Collocations', active: processingStep >= 2 },
              { label: 'Grammatical Complexity & Punctuation', active: processingStep >= 3 },
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
          <AiWaitNote what="your essays" />
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     3. RESULTS SCREEN (Section 23 & 25)
     ────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────
     3. RESULTS SCREEN (Cognition Unified Design Language)
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const isCompleted = result?.evaluationStatus === 'completed' && typeof result?.band === 'number';
    const isPartial = result?.evaluationStatus === 'partial';
    const isFailed = result?.evaluationStatus === 'failed' || (!isCompleted && !isPartial);

    const handleSaveAndReturn = () => {
      const attemptId = createAttemptId('writing');
      const canonicalAttempt = {
        id: attemptId,
        type: 'writing',
        testId: test?.testId || testId || 'writing-practice',
        testLabel: test?.title || 'IELTS Writing Practice',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
        status: isCompleted ? 'completed' : (isPartial ? 'partial' : 'failed'),
        overallBand: isCompleted ? result.band : null,
        writing: {
          band: isCompleted ? result.band : null,
          task1Band: isCompleted ? result.task1Band : null,
          task2Band: isCompleted ? result.task2Band : null,
          evaluationStatus: result?.evaluationStatus || 'failed',
          criteria: result?.criteria || null,
          overallSummary: result?.overallSummary || '',
          task1Feedback: result?.task1Feedback || '',
          task2Feedback: result?.task2Feedback || '',
          strengths: result?.strengths || '',
          areasForImprovement: result?.areasForImprovement || '',
          task1Words: result?.task1Words || 0,
          task2Words: result?.task2Words || 0,
          t1,
          t2
        }
      };

      clearSession();
      if (onComplete) {
        onComplete(canonicalAttempt.writing);
      }
    };

    const perTask = result?.taskCriteria || null;
    const criteriaList = [
      {
        id: 'ta',
        t1: perTask?.task1?.taskAchievement, t2: perTask?.task2?.taskResponse,
        title: 'Task Achievement / Response',
        data: result?.criteria?.taskAchievement || result?.criteria?.taskResponse,
        defaultNote: 'Fulfillment of prompt requirements, clear overview in Task 1, and developed position in Task 2.'
      },
      {
        id: 'cc',
        t1: perTask?.task1?.coherenceAndCohesion, t2: perTask?.task2?.coherenceAndCohesion,
        title: 'Coherence & Cohesion',
        data: result?.criteria?.coherenceAndCohesion,
        defaultNote: 'Logical progression between paragraphs, clear central topic per paragraph, and linking device balance.'
      },
      {
        id: 'lr',
        t1: perTask?.task1?.lexicalResource, t2: perTask?.task2?.lexicalResource,
        title: 'Lexical Resource',
        data: result?.criteria?.lexicalResource,
        defaultNote: 'Academic register, vocabulary range, collocations, precision, and spelling accuracy.'
      },
      {
        id: 'gra',
        t1: perTask?.task1?.grammaticalRangeAndAccuracy, t2: perTask?.task2?.grammaticalRangeAndAccuracy,
        title: 'Grammatical Range & Accuracy',
        data: result?.criteria?.grammaticalRangeAndAccuracy || result?.criteria?.grammaticalRange,
        defaultNote: 'Variety of complex sentence structures, punctuation control, and frequency of error-free sentences.'
      }
    ];

    return (
      <ResultPage skill="writing" className="exam-results-screen">
        {/* Navigation Breadcrumb */}
        <ResultItem
          as="button"
          type="button"
          className="result-back-btn"
          onClick={() => {
            clearSession();
            onBack();
          }}
        >
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </ResultItem>

        {/* ── 1. HERO CARD ── */}
        <ResultItem className="result-hero">
          <div>
            <span className="result-eyebrow">
              {isMockMode ? "WRITING TEST COMPLETE" : "WRITING PRACTICE COMPLETE"}
            </span>
            <h1 className="result-title">Writing Assessment</h1>
            <p className="result-lead">
              Task 1: <strong>{result?.task1Words || 0} words</strong> (min 150) · Task 2: <strong>{result?.task2Words || 0} words</strong> (min 250)
            </p>
            {result?.modelUsed && (
              <span className="result-meta-pill">
                Evaluator: {result.providerUsed === 'groq' ? 'Groq' : 'Gemini'} ({result.modelUsed})
                {result.evaluationTier === 'client_local_key' ? ' · Local API Key' : ''}
              </span>
            )}
          </div>

          <div className="result-band-box">
            <div className="result-band-label">
              {isCompleted ? 'Overall band' : 'AI evaluation'}
            </div>
            <div className={`result-band-value${isCompleted ? '' : ' is-text'}`}>
              {isCompleted ? result.band.toFixed(1) : (isPartial ? 'Partial' : (isFailed ? 'Unavailable' : 'Pending'))}
            </div>
            {isPartial && result?.coverage?.statement && (
              <div className="result-band-note">{result.coverage.statement}</div>
            )}
            {isPartial && (
              <div className="result-band-note" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                Feedback below covers only what you wrote — no overall band.
              </div>
            )}
            <div className="result-band-sub" style={{ marginTop: 6 }}>
              Target: {getTargetBand() || '8.0'}
            </div>
            {isFailed && (
              <button
                type="button"
                onClick={handleRecheck}
                disabled={isRechecking}
                className="result-btn is-yellow is-small"
                style={{ marginTop: 12 }}
              >
                <Icon name="refresh" size={14} />
                <span>{isRechecking ? 'Rechecking…' : 'Recheck'}</span>
              </button>
            )}
          </div>
        </ResultItem>

        {/* ── 2. AI NOTICE IF KEY MISSING OR FAILED ── */}
        {!isPartial && isFailed && (
          <ResultItem className="result-callout is-error has-action" role="alert">
            <span className="result-callout-icon"><Icon name="alertCircle" size={24} /></span>
            <div className="result-callout-body">
              <div className="result-callout-title">AI Evaluation Unavailable</div>
              <div className="result-callout-text">
                {result?.message || 'To receive official IELTS criteria scoring and detailed band feedback, configure your Google Gemini API key in Settings.'}
              </div>
            </div>
            <button
              id="recheck-writing-banner-btn"
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              className="result-btn is-yellow is-small"
            >
              <Icon name="refresh" size={16} />
              <span>{isRechecking ? 'Rechecking…' : 'Recheck with AI'}</span>
            </button>
          </ResultItem>
        )}

        {!isMockMode && result?.criteria && (
          <ErrorBoundary fallback={null}>
            <ResultItem>
              <ResultAnalysis skill="writing" resultRecord={{ writing: { ...result, criteria: result.criteria } }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
            </ResultItem>
          </ErrorBoundary>
        )}

        {/* ── 3. FOUR ASSESSMENT CRITERIA CARDS ── */}
        <ResultItem as="section">
          <div className="result-section-head">
            <h2 className="result-section-title">Official Assessment Criteria</h2>
            <p className="result-section-sub">How your writing measured against each IELTS band descriptor.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {criteriaList.map((c) => {
              const hasBand = typeof c.data?.band === 'number';
              // Prefer the richer per-criterion feedback; fall back to the
              // older evidence/rationale/improvementFocus fields.
              const taskCorrections = [
                ...(Array.isArray(c.t1?.corrections) ? c.t1.corrections.map(x => ({ task: 1, ...x })) : []),
                ...(Array.isArray(c.t2?.corrections) ? c.t2.corrections.map(x => ({ task: 2, ...x })) : []),
              ];
              const corrections = Array.isArray(c.data?.corrections) && c.data.corrections.length > 0
                ? c.data.corrections
                : taskCorrections;
              return (
                <CriterionFeedbackCard
                  key={c.id}
                  title={c.title}
                  subtitle={c.defaultNote}
                  band={hasBand ? c.data.band : null}
                  bandFallback={isPartial ? 'Not scored' : 'Unavailable'}
                  assessment={c.data?.personalizedAssessment || c.data?.rationale || c.data?.evidence || (hasBand ? null : c.defaultNote)}
                  corrections={corrections}
                  advice={c.data?.nextBandAdvice || c.data?.improvementFocus}
                >
                  {hasBand && typeof c.t1?.band === 'number' && typeof c.t2?.band === 'number' && (
                    <div className="result-feedback-split" aria-label="Band per task">
                      <span className="result-badge">Task 1 · <strong>{c.t1.band}</strong></span>
                      <span className="result-badge">Task 2 · <strong>{c.t2.band}</strong></span>
                    </div>
                  )}
                </CriterionFeedbackCard>
              );
            })}
          </div>
        </ResultItem>

        {isCompleted && (result?.scoringMethod || result?.scoringNotes?.length > 0) && (
          <ResultItem className="writing-scoring-method">
            {(result.scoringNotes || []).map((n, i) => <p key={i} className="writing-scoring-note">{n}</p>)}
            {result.scoringMethod && <p>{result.scoringMethod}</p>}
          </ResultItem>
        )}

        {/* ── 4. PERFORMANCE SUMMARY & FEEDBACK ── */}
        {(result?.overallSummary || result?.priorityWeaknesses?.length > 0 || result?.task1Feedback || result?.task2Feedback || result?.strengths || result?.areasForImprovement) && (
          <ResultItem as="section" className="result-card">
            <div className="result-card-head">
              <h3 className="result-card-title">Examiner Diagnostic Feedback</h3>
            </div>
            {result?.overallSummary && (
              <p className="result-text" style={{ marginBottom: 20 }}>{result.overallSummary}</p>
            )}

            {Array.isArray(result?.priorityWeaknesses) && result.priorityWeaknesses.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="result-label is-accent">Top priorities for your next band</div>
                <ol className="result-list">
                  {result.priorityWeaknesses.map((item, idx) => (
                    <li key={idx} className="result-list-item">
                      <span className="result-list-num">{idx + 1}.</span>
                      <span className="result-list-body">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="result-grid is-wide">
              {result?.task1Feedback && (
                <div className="result-subcard is-yellow">
                  <div className="result-label">
                    Task 1 Feedback ({isCompleted && result.task1Band ? `Band ${result.task1Band}` : 'Report'})
                  </div>
                  <p className="result-text">{result.task1Feedback}</p>
                </div>
              )}
              {result?.task2Feedback && (
                <div className="result-subcard is-lavender">
                  <div className="result-label">
                    Task 2 Feedback ({isCompleted && result.task2Band ? `Band ${result.task2Band}` : 'Essay'})
                  </div>
                  <p className="result-text">{result.task2Feedback}</p>
                </div>
              )}
            </div>

            {(result?.strengths || result?.areasForImprovement) && (
              <div className="result-grid is-wide" style={{ marginTop: 18 }}>
                {result?.strengths && (
                  <div className="result-subcard">
                    <div className="result-label is-good">Observed Strengths</div>
                    <p className="result-text">{result.strengths}</p>
                  </div>
                )}
                {result?.areasForImprovement && (
                  <div className="result-subcard is-coral">
                    <div className="result-label is-accent">Areas for Improvement</div>
                    <p className="result-text">{result.areasForImprovement}</p>
                  </div>
                )}
              </div>
            )}
          </ResultItem>
        )}

        {/* ── 5. YOUR SUBMISSIONS ── */}
        <ResultItem as="section">
          <div className="result-section-head">
            <h2 className="result-section-title">Your Submitted Essays</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { key: 't1', label: 'Task 1 Submission', prompt: test.task1?.prompt, text: t1 },
              { key: 't2', label: 'Task 2 Submission', prompt: test.task2?.prompt, text: t2 },
            ].map(sub => (
              <div key={sub.key} className="result-card">
                <div className="result-card-head" style={{ alignItems: 'center' }}>
                  <span className="result-label is-accent" style={{ margin: 0 }}>{sub.label}</span>
                  <span className="result-badge">{wordCount(sub.text)} words</span>
                </div>
                {sub.prompt && <p className="result-essay-prompt">{sub.prompt}</p>}
                <div className="result-essay">{sub.text || '(No response submitted)'}</div>
              </div>
            ))}
          </div>
        </ResultItem>

        {/* ── 6. PROMINENT SAVE SCORE & RETURN BUTTON + RECHECK ── */}
        <ResultItem className="result-actions">
          {isFailed && (
            <button
              id="recheck-writing-footer-btn"
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              className="result-btn is-secondary"
            >
              <Icon name="refresh" size={16} />
              <span>{isRechecking ? 'Rechecking…' : 'Recheck with AI'}</span>
            </button>
          )}
          <button
            id="save-writing-result-btn"
            type="button"
            onClick={handleSaveAndReturn}
            className="result-btn is-primary"
          >
            <Icon name="check" size={18} />
            <span>Save Score & Return to Dashboard</span>
          </button>
        </ResultItem>
      </ResultPage>
    );
  }

  /* ──────────────────────────────────────────────────────────
     4. EXAM INTERFACE (Focused Document Editor)
     ────────────────────────────────────────────────────────── */
  const wc1 = wordCount(t1);
  const wc2 = wordCount(t2);
  const currentTask = task === 1 ? test.task1 : test.task2;
  const minWords = task === 1 ? 150 : 250;
  const currentWc = task === 1 ? wc1 : wc2;
  const metMin = currentWc >= minWords;

  return (
    <div className="exam-focus-layout reading-split-active writing-split">
      <ScrollToTop />
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: 'var(--c-coral)', color: '#FFFFFF', borderColor: '#151313' }}>
            {isMockMode ? 'IELTS ACADEMIC WRITING' : 'IELTS WRITING PRACTICE'}
          </span>
          <h2 className="exam-focus-title">
            {test?.title || 'Academic Writing Test'}
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
            title={isTimerPaused ? 'Exam timer paused' : isOvertime ? 'Standard time elapsed (Practice overtime)' : 'Time remaining'}
          >
            <Icon name="clock" size={16} />
            <span>{isTimerPaused ? `${FMT(timeLeft)} [PAUSED]` : isOvertime ? '00:00 (Overtime)' : FMT(timeLeft)}</span>
          </div>

          <button
            type="button"
            className="exam-focus-exit-btn"
            onClick={() => {
              if (window.confirm('Exit writing practice? Your response will be lost.')) {
                clearSession();
                onBack();
              }
            }}
            title="Exit test and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── PRACTICE OVERTIME NOTIFICATION (Non-strict exit in Practice Mode) ── */}
      {isOvertime && !isMockMode && (
        <div className="practice-overtime-banner" style={{ margin: '16px 24px 0' }}>
          <div className="practice-overtime-content">
            <Icon name="clock" size={20} style={{ color: '#8A6D00', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#151313' }}>
                Standard Practice Time Elapsed (60 Minutes)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                In Practice Mode, the exam does not force-exit. Take all the time you need to complete both writing tasks! When finished, click &ldquo;Finish &amp; Grade Exam&rdquo; below.
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
              title="Finish test and grade essays now"
            >
              Finish &amp; Grade
            </button>
          </div>
        </div>
      )}

      {/* Compact widths: one pane at a time */}
      <div className="rd-pane-switch" role="tablist" aria-label="Writing workspace">
        <button type="button" role="tab" aria-selected={mobilePane === 'task'}
          className={mobilePane === 'task' ? 'is-active' : ''} onClick={() => setMobilePane('task')}>
          Task {task}
        </button>
        <button type="button" role="tab" aria-selected={mobilePane === 'answer'}
          className={mobilePane === 'answer' ? 'is-active' : ''} onClick={() => setMobilePane('answer')}>
          Your answer <span className="rd-pane-count">{currentWc} words</span>
        </button>
      </div>

      {/* ── 2. WRITING WORKSPACE — task | answer ── */}
      <div className={`reading-split-panes wr-show-${mobilePane}`} style={{ '--exam-text-scale': textScale }}>
        <div className="reading-pane wr-pane-task">
          <div className="rd-sheet wr-task">
            <p className="rd-eyebrow">{task === 1 ? 'Task 1 · about 20 minutes' : 'Task 2 · about 40 minutes'}</p>
            <div className="wr-prompt">
              {currentTask?.promptHtml
                ? <span dangerouslySetInnerHTML={{ __html: currentTask.promptHtml }} />
                : (currentTask?.instructions || currentTask?.prompt)}
            </div>
            {task === 1 && test.task1?.image?.file && (
              <img className="wr-visual" src={test.task1.image.file} alt="Task 1 chart or diagram" />
            )}
          </div>
        </div>

        <div className="reading-pane wr-pane-answer">
          <div className="rd-sheet wr-answer">
            <div className="wr-count">
              <span>Write at least <strong>{minWords} words</strong></span>
              <span className={metMin ? 'is-met' : ''}>
                {metMin ? <Icon name="check" size={14} /> : null}
                {currentWc} words
              </span>
            </div>
            <textarea
              className="wr-editor"
              value={task === 1 ? t1 : t2}
              onChange={(e) => task === 1 ? setT1(e.target.value) : setT2(e.target.value)}
              placeholder={`Write your Task ${task} response here…`}
              aria-label={`Task ${task} response`}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* ── 3. UNIVERSAL 3-ZONE EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => setTask(1)}
        isPreviousDisabled={task === 1}
        previousLabel="Previous Task"
        sections={[
          { label: 'Task 1', isCompleted: wc1 >= 150 },
          { label: 'Task 2', isCompleted: wc2 >= 250 }
        ]}
        activeSectionIndex={task - 1}
        onSelectSection={(idx) => setTask(idx + 1)}
        onNext={() => {
          if (task === 1) {
            setTask(2);
          } else {
            handleSubmit();
          }
        }}
        isNextDisabled={isSubmitting}
        nextLabel={task === 1 ? 'Next Task' : (isMockMode ? 'Next Section: Speaking' : 'Submit & Evaluate Writing')}
        isSubmit={task === 2 && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-speaking' : 'submit-writing-exam'}
      />
    </div>
  );
}
