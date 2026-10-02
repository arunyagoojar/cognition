import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../common/Icon';
import { getRandomizedWritingTest, getWritingTest } from '../../data/writing/index';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import { evaluateWritingWithAI } from '../../utils/geminiEvaluator';
import { getApiKey, createAttemptId, getTargetBand } from '../../utils/storage';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const wordCount = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

export default function WritingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false }) {
  const [test] = useState(() => initialTest || (testId ? getWritingTest(testId) : getRandomizedWritingTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [task, setTask] = useState(1);
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const [result, setResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [showModelAnswer, setShowModelAnswer] = useState(false);

  const timerRef = useRef(null);

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
    clearInterval(timerRef.current);
    const wc1 = wordCount(t1);
    const wc2 = wordCount(t2);

    if (isMockMode) {
      // In Full Mock Mode: evaluate responses and transition directly to Speaking
      const evalResult = await evaluateWritingWithAI(getApiKey(), {
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
      if (onComplete) onComplete(computedResult);
      return;
    }

    setPhase('processing');
    setTimeout(() => setProcessingStep(1), 600);
    setTimeout(() => setProcessingStep(2), 1200);
    setTimeout(() => setProcessingStep(3), 1800);

    const evalResult = await evaluateWritingWithAI(getApiKey(), {
      task1Text: t1,
      task2Text: t2,
      prompts: {
        task1: test.task1?.prompt || '',
        task2: test.task2?.prompt || ''
      }
    });

    setTimeout(() => {
      setResult({
        band: evalResult.overallBand,
        task1Band: evalResult.task1Band,
        task2Band: evalResult.task2Band,
        task1Words: wc1,
        task2Words: wc2,
        t1,
        t2,
        ...evalResult
      });
      setPhase('results');
    }, 2400);
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
            Analysing your writing...
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Evaluating word count thresholds, paragraph coherence, and official criteria.
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
                  color: step.active ? '#10B981' : 'transparent',
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
     3. RESULTS SCREEN (Section 23 & 25)
     ────────────────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────────────────
     3. RESULTS SCREEN (Cognition Unified Design Language)
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const isCompleted = result?.evaluationStatus === 'completed' && typeof result?.band === 'number';
    const isFailed = result?.evaluationStatus === 'failed' || result?.band === null;

    const handleSaveAndReturn = () => {
      const attemptId = createAttemptId('writing');
      const canonicalAttempt = {
        id: attemptId,
        type: 'writing',
        testId: test?.testId || testId || 'writing-practice',
        testLabel: test?.title || 'IELTS Writing Practice',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
        status: 'completed',
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

      if (onComplete) {
        onComplete(canonicalAttempt.writing);
      }
    };

    const criteriaList = [
      {
        id: 'ta',
        title: 'Task Achievement / Response',
        data: result?.criteria?.taskAchievement || result?.criteria?.taskResponse,
        defaultNote: 'Fulfillment of prompt requirements, clear overview in Task 1, and developed position in Task 2.'
      },
      {
        id: 'cc',
        title: 'Coherence & Cohesion',
        data: result?.criteria?.coherenceAndCohesion,
        defaultNote: 'Logical progression between paragraphs, clear central topic per paragraph, and linking device balance.'
      },
      {
        id: 'lr',
        title: 'Lexical Resource',
        data: result?.criteria?.lexicalResource,
        defaultNote: 'Academic register, vocabulary range, collocations, precision, and spelling accuracy.'
      },
      {
        id: 'gra',
        title: 'Grammatical Range & Accuracy',
        data: result?.criteria?.grammaticalRangeAndAccuracy || result?.criteria?.grammaticalRange,
        defaultNote: 'Variety of complex sentence structures, punctuation control, and frequency of error-free sentences.'
      }
    ];

    return (
      <div className="exam-results-screen" style={{ maxWidth: 1080, margin: '40px auto', padding: '0 24px 80px' }}>
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
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

        {/* ── 1. WRITING PRACTICE COMPLETE HERO CARD ── */}
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
              WRITING PRACTICE COMPLETE
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
              {isCompleted ? result.band.toFixed(1) : (isFailed ? 'Unavailable' : 'Pending')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 700 }}>
              Target: {getTargetBand() || '8.0'}
            </div>
          </div>
        </div>

        {/* ── 2. AI NOTICE IF KEY MISSING OR FAILED ── */}
        {isFailed && (
          <div style={{
            background: 'rgba(255, 87, 52, 0.08)',
            border: '1.5px solid #151313',
            borderRadius: 18,
            padding: '20px 24px',
            marginBottom: 32,
            boxShadow: '0 3px 0 #151313',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
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
                    {hasBand ? c.data.band.toFixed(1) : '--'}
                  </span>
                  {hasBand && <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>/ 9.0</span>}
                </div>

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
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#151313', textTransform: 'uppercase', marginBottom: 6 }}>
                    Task 1 Feedback ({isCompleted && result.task1Band ? `Band ${result.task1Band}` : 'Report'})
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {result.task1Feedback}
                  </div>
                </div>
              )}

              {result?.task2Feedback && (
                <div style={{ padding: 18, borderRadius: 14, background: 'rgba(190, 148, 245, 0.12)', border: '1px solid #151313' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#151313', textTransform: 'uppercase', marginBottom: 6 }}>
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
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#151313', textTransform: 'uppercase', marginBottom: 6 }}>
                      Observed Strengths
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {result.strengths}
                    </div>
                  </div>
                )}
                {result?.areasForImprovement && (
                  <div style={{ padding: 16, borderRadius: 14, background: 'rgba(255, 87, 52, 0.08)', border: '1px solid #151313' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#151313', textTransform: 'uppercase', marginBottom: 6 }}>
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

        {/* ── 6. PROMINENT SAVE SCORE & RETURN BUTTON ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
          paddingTop: 16,
          borderTop: '1.5px solid #151313'
        }}>
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
    <div className="exam-focus-layout">
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: 'var(--c-coral)', color: '#FFFFFF', borderColor: '#151313' }}>
            IELTS WRITING PRACTICE
          </span>
          <h2 className="exam-focus-title">
            {test?.title || 'Academic Writing Test'}
          </h2>
        </div>

        <div className="exam-focus-header-right">
          <div className={`exam-focus-timer-pill ${timeLeft < 300 ? 'urgent' : ''}`} title="Time remaining">
            <Icon name="clock" size={16} />
            <span>{FMT(timeLeft)}</span>
          </div>

          <button
            type="button"
            className="exam-focus-exit-btn"
            onClick={() => {
              if (window.confirm('Exit writing practice? Your response will be lost.')) onBack();
            }}
            title="Exit test and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── 2. WRITING WORKSPACE (Single Task View) ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: 'var(--border-dark)',
        borderRadius: 'var(--r-card)',
        padding: '32px 40px',
        boxShadow: '0 3px 0 #151313',
        minHeight: 'calc(100vh - 210px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 960,
        margin: '0 auto'
      }}>
        {/* PROMPT AREA */}
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Task {task}</h3>
          
          {task === 1 ? (
            <>
              <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                {test.task1?.promptHtml ? (
                  <span dangerouslySetInnerHTML={{ __html: test.task1.promptHtml }} />
                ) : (
                  test.task1?.instructions || test.task1?.prompt
                )}
              </div>
              {test.task1?.image?.file && (
                <img 
                  src={test.task1.image.file} 
                  alt="Task 1 Diagram" 
                  style={{ width: '100%', maxWidth: '500px', display: 'block', margin: '16px auto', borderRadius: 8, border: '1px solid var(--border-subtle)' }} 
                />
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                {test.task2?.promptHtml ? (
                  <span dangerouslySetInnerHTML={{ __html: test.task2.promptHtml }} />
                ) : (
                  test.task2?.instructions || test.task2?.prompt
                )}
              </div>
            </>
          )}
        </div>

        {/* RESPONSE AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-canvas)',
            border: '1.5px solid #151313',
            borderRadius: 14,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Target: <strong style={{ color: 'var(--text-primary)' }}>{minWords} words</strong>
            </span>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              color: metMin ? '#10B981' : 'var(--c-coral)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}>
              {metMin ? <Icon name="check" size={14} /> : null}
              {currentWc} words
            </span>
          </div>
          <textarea
            value={task === 1 ? t1 : t2}
            onChange={(e) => task === 1 ? setT1(e.target.value) : setT2(e.target.value)}
            placeholder={`Write your Task ${task} response here...`}
            style={{
              width: '100%', flex: 1, minHeight: 300, padding: '18px 20px', borderRadius: 16, background: '#FFFFFF',
              border: '1.5px solid #151313', fontFamily: 'Kodchasan, sans-serif', fontSize: 15, resize: 'vertical'
            }}
          />
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
        nextLabel={task === 1 ? 'Next Task' : (isMockMode ? 'Next Section: Speaking' : 'Submit & Evaluate Writing')}
        isSubmit={task === 2 && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-speaking' : 'submit-writing-exam'}
      />
    </div>
  );
}
