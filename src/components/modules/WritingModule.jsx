import React, { useState, useEffect, useRef } from 'react';
import AiWaitNote from '../common/AiWaitNote';
import { motion } from 'motion/react';
import { Icon } from '../common/Icon';
import { getRandomizedWritingTest, getWritingTest } from '../../data/writing/index';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import { evaluateWritingWithAI } from '../../utils/geminiEvaluator';
import { createAttemptId, getTargetBand } from '../../utils/storage';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
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

export default function WritingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips }) {
  const [test] = useState(() => initialTest || (testId ? getWritingTest(testId) : getRandomizedWritingTest()));
  const [initialSession] = useState(() => readSavedWritingSession());

  const [phase, setPhase] = useState(() => {
    if (initialSession?.phase && ['exam', 'processing', 'results'].includes(initialSession.phase)) {
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
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [textScale, setTextScale] = useExamTextScale();
  const [mobilePane, setMobilePane] = useState('task');

  const timerRef = useRef(null);

  const clearSession = () => {
    try {
      sessionStorage.removeItem(WRITING_SESSION_PREFIX);
    } catch {}
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    if (phase === 'exam' && !timerRef.current) {
      startTimer();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'intro') return;
    try {
      sessionStorage.setItem(WRITING_SESSION_PREFIX, JSON.stringify({
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);
    const wc1 = wordCount(t1);
    const wc2 = wordCount(t2);

    // Immediately show processing screen to prevent UI freeze and multiple clicks
    setPhase('processing');
    setProcessingStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const stepTimer1 = setTimeout(() => setProcessingStep(1), 600);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 1200);
    const stepTimer3 = setTimeout(() => setProcessingStep(3), 1800);

    try {
      const evalResult = await evaluateWritingWithAI({
        task1Text: t1,
        task2Text: t2,
        prompts: {
          task1: test.task1?.prompt || '',
          task2: test.task2?.prompt || ''
        }
      });

      const computedResult = {
        band: evalResult.overallBand,
        task1Band: evalResult.task1Band,
        task2Band: evalResult.task2Band,
        task1Words: wc1,
        task2Words: wc2,
        t1,
        t2,
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
          task2: test?.task2?.prompt || ''
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
      <div className="exam-results-screen" style={{ maxWidth: 1080, margin: '40px auto', padding: '0 24px 80px' }}>
        {/* Navigation Breadcrumb */}
        <button
          onClick={() => {
            clearSession();
            onBack();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
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

        {/* ── 1. {isMockMode ? "WRITING TEST COMPLETE" : "WRITING PRACTICE COMPLETE"} HERO CARD ── */}
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
          gap: 28
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
              color: '#FFFFFF',
              marginBottom: 12
            }}>
              {isMockMode ? "WRITING TEST COMPLETE" : "WRITING PRACTICE COMPLETE"}
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Writing Assessment
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Task 1: <strong style={{ color: 'var(--text-primary)' }}>{result?.task1Words || 0} words</strong> (min 150) · Task 2: <strong style={{ color: 'var(--text-primary)' }}>{result?.task2Words || 0} words</strong> (min 250)
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
              {isCompleted ? 'OVERALL BAND' : 'AI EVALUATION'}
            </div>
            <div style={{
              fontSize: isCompleted ? 54 : 20,
              fontWeight: 800,
              color: isCompleted ? 'var(--c-coral)' : 'var(--text-secondary)',
              lineHeight: 1.1,
              marginTop: 6,
              fontFamily: 'Kodchasan, sans-serif'
            }}>
              {isCompleted ? result.band.toFixed(1) : (isPartial ? 'Partial' : (isFailed ? 'Unavailable' : 'Pending'))}
            </div>
            {isPartial && result?.coverage?.statement && (
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 8, fontWeight: 700, maxWidth: 360 }}>
                {result.coverage.statement}
              </div>
            )}
            {isPartial && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 600, maxWidth: 360 }}>
                Feedback below covers only what you wrote — no overall band.
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 700 }}>
              Target: {getTargetBand() || '8.0'}
            </div>
            {isFailed && (
              <button
                type="button"
                onClick={handleRecheck}
                disabled={isRechecking}
                className="btn-coral-pill-physical"
                style={{
                  marginTop: 10,
                  padding: '6px 14px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isRechecking ? 'wait' : 'pointer'
                }}
              >
                <Icon name="refresh" size={13} />
                <span>{isRechecking ? 'Rechecking…' : 'Recheck'}</span>
              </button>
            )}
          </div>
        </div>

                {!isMockMode && result?.criteria && (
          <ErrorBoundary fallback={null}>
            <div style={{ marginBottom: 36 }}>
              <ResultAnalysis skill="writing" resultRecord={{ writing: { ...result, criteria: result.criteria } }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
            </div>
          </ErrorBoundary>
        )}

        {/* ── 2. AI NOTICE IF KEY MISSING OR FAILED ── */}
        {!isPartial && isFailed && (
          <div style={{
            background: 'rgba(255, 87, 52, 0.08)',
            border: '1.5px solid #151313',
            borderRadius: 18,
            padding: '20px 24px',
            marginBottom: 32,
            boxShadow: '0 3px 0 #151313',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
              <Icon name="alertCircle" size={24} style={{ color: 'var(--c-coral)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#151313' }}>
                  AI Evaluation Unavailable
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {result?.message || 'To receive official IELTS criteria scoring and detailed band feedback, configure your Google Gemini API key in Settings.'}
                </div>
              </div>
            </div>
            <button
              id="recheck-writing-banner-btn"
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                background: 'var(--c-yellow, #F5A623)',
                color: '#151313',
                fontSize: 14,
                fontWeight: 800,
                border: '1.5px solid #151313',
                boxShadow: '0 3px 0 #151313',
                cursor: isRechecking ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
                fontFamily: 'Kodchasan, sans-serif'
              }}
            >
              <Icon name="refresh" size={16} />
              <span>{isRechecking ? 'Rechecking…' : 'Recheck with AI'}</span>
            </button>
          </div>
        )}

        {/* ── 3. FOUR ASSESSMENT CRITERIA CARDS ── */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Official Assessment Criteria
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 36 }}>
          {criteriaList.map((c) => {
            const hasBand = typeof c.data?.band === 'number';

            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid #151313',
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: '0 3px 0 #151313',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {c.title}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: hasBand ? 'var(--c-coral)' : 'var(--text-primary)', fontFamily: 'Kodchasan, sans-serif' }}>
                    {hasBand ? c.data.band.toFixed(1) : (isPartial ? 'Not scored' : '--')}
                  </span>
                  {hasBand && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>/ 9.0</span>}
                </div>
                {hasBand && typeof c.t1?.band === 'number' && typeof c.t2?.band === 'number' && (
                  <div className="writing-criterion-split" aria-label="Band per task">
                    <span>Task 1 · <strong>{c.t1.band}</strong></span>
                    <span>Task 2 · <strong>{c.t2.band}</strong></span>
                  </div>
                )}

                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                  {c.data?.rationale || c.data?.evidence || c.defaultNote}
                </div>

                {c.data?.improvementFocus && (
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(21,19,19,0.1)' }}>
                    <strong style={{ color: 'var(--c-coral)' }}>Focus: </strong>{c.data.improvementFocus}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isCompleted && (result?.scoringMethod || result?.scoringNotes?.length > 0) && (
          <div className="writing-scoring-method">
            {(result.scoringNotes || []).map((n, i) => <p key={i} className="writing-scoring-note">{n}</p>)}
            {result.scoringMethod && <p>{result.scoringMethod}</p>}
          </div>
        )}

        {/* ── 4. PERFORMANCE SUMMARY & FEEDBACK ── */}
        {(result?.overallSummary || result?.task1Feedback || result?.task2Feedback || result?.strengths || result?.areasForImprovement) && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid #151313',
            borderRadius: 20,
            padding: '28px 32px',
            marginBottom: 36,
            boxShadow: '0 3px 0 #151313'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
              Examiner Diagnostic Feedback
            </h3>
            {result?.overallSummary && (
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                {result.overallSummary}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              {result?.task1Feedback && (
                <div style={{ padding: 18, borderRadius: 14, background: 'rgba(252, 204, 66, 0.12)', border: '1px solid #151313' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Task 1 Feedback ({isCompleted && result.task1Band ? `Band ${result.task1Band}` : 'Report'})
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.task1Feedback}
                  </div>
                </div>
              )}

              {result?.task2Feedback && (
                <div style={{ padding: 18, borderRadius: 14, background: 'rgba(190, 148, 245, 0.12)', border: '1px solid #151313' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Task 2 Feedback ({isCompleted && result.task2Band ? `Band ${result.task2Band}` : 'Essay'})
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.task2Feedback}
                  </div>
                </div>
              )}
            </div>

            {(result?.strengths || result?.areasForImprovement) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 20 }}>
                {result?.strengths && (
                  <div style={{ padding: 16, borderRadius: 14, background: 'var(--bg-canvas)', border: '1px solid rgba(21,19,19,0.2)' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Observed Strengths
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {result.strengths}
                    </div>
                  </div>
                )}
                {result?.areasForImprovement && (
                  <div style={{ padding: 16, borderRadius: 14, background: 'rgba(255, 87, 52, 0.08)', border: '1px solid #151313' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Areas for Improvement
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {result.areasForImprovement}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 5. YOUR SUBMISSIONS ── */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Your Submitted Essays
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 44 }}>
          {/* Task 1 */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 18, padding: '24px', boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-coral)', textTransform: 'uppercase' }}>Task 1 Submission</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-canvas)', border: '1px solid #151313' }}>
                {wordCount(t1)} words
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontStyle: 'italic' }}>
              {test.task1?.prompt}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', padding: '16px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)' }}>
              {t1 || '(No response submitted)'}
            </div>
          </div>

          {/* Task 2 */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 18, padding: '24px', boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-coral)', textTransform: 'uppercase' }}>Task 2 Submission</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-canvas)', border: '1px solid #151313' }}>
                {wordCount(t2)} words
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, fontStyle: 'italic' }}>
              {test.task2?.prompt}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', padding: '16px', background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)' }}>
              {t2 || '(No response submitted)'}
            </div>
          </div>
        </div>

        {/* ── 6. PROMINENT SAVE SCORE & RETURN BUTTON + RECHECK ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
          paddingTop: 16,
          borderTop: '1.5px solid #151313',
          flexWrap: 'wrap'
        }}>
          {isFailed && (
            <button
              id="recheck-writing-footer-btn"
              type="button"
              onClick={handleRecheck}
              disabled={isRechecking}
              style={{
                padding: '16px 28px',
                borderRadius: 16,
                background: 'var(--surface-alt)',
                color: 'var(--text-primary)',
                fontSize: 15,
                fontWeight: 700,
                border: '1.5px solid #151313',
                cursor: isRechecking ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 3px 0 #151313',
                fontFamily: 'Kodchasan, sans-serif'
              }}
            >
              <Icon name="refresh" size={16} />
              <span>{isRechecking ? 'Rechecking…' : 'Recheck with AI'}</span>
            </button>
          )}
          <motion.button
            id="save-writing-result-btn"
            type="button"
            onClick={handleSaveAndReturn}
            whileHover={{ y: -3, boxShadow: '0 6px 0 #151313' }}
            whileTap={{ y: 2, scale: 0.98, boxShadow: '0 1px 0 #151313' }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
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
          </motion.button>
        </div>
      </div>
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
          <div className={`exam-focus-timer-pill ${timeLeft < 300 ? 'urgent' : ''}`} title="Time remaining">
            <Icon name="clock" size={16} />
            <span>{FMT(timeLeft)}</span>
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
