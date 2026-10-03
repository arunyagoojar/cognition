import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedReadingTest, getReadingTest } from '../../data/reading/index';
import { calculateReadingBand, isAnswerCorrect } from '../../utils/bandCalculator';
import { recordAttemptedQuestionSet, createAttemptId } from '../../utils/storage';
import { evaluateReadingResponses } from '../../utils/evaluation/evaluationEngine';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import QuestionRenderer from '../common/QuestionRenderer';
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
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

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

    if (isMockMode) {
      if (onComplete) onComplete(computedResult);
      return;
    }

    setPhase('processing');
    setTimeout(() => setProcessingStep(1), 600);
    setTimeout(() => setProcessingStep(2), 1200);
    setTimeout(() => setProcessingStep(3), 1800);
    setTimeout(() => {
      setResult(computedResult);
      setPhase('results');
    }, 2400);
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
            Analysing your performance...
          </h2>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32 }}>
            Verifying your responses against official IELTS academic answer keys.
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
            <AnswerReviewList itemResults={result.itemResults} />
          </div>
        )}

        {/* Detailed analysis — question-type performance + recommendations */}
        {!isMockMode && (
          <div style={{ marginBottom: 36 }}>
            <ResultAnalysis skill="reading" resultRecord={{ reading: result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
          </div>
        )}

        {/* 3 Columns: What Went Well, Needs Attention, Recommended Practice */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 36 }}>
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--success-icon)', marginBottom: 16 }}>
              <Icon name="check" size={16} /> What Went Well
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Passage 1 Accuracy:</strong> High rate of factual precision on introductory narrative sections.
              </div>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Scanning Speed:</strong> Found technical terms and historical dates promptly.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--c-coral)', marginBottom: 16 }}>
              <Icon name="zap" size={16} /> Needs Attention
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>True / False / Not Given:</strong> Differentiate between contradictory statements and unverified information.
              </div>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Passage 3 Timing:</strong> Allow at least 22 minutes for the final, most complex passage.
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
              <Icon name="arrowRight" size={16} /> Recommended Practice
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 14, background: 'rgba(190, 148, 245, 0.12)', border: '1px solid #151313', borderRadius: 12, fontSize: 13 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Matching Headings Drill</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Practice reading topic sentences and identifying paragraph thesis.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Answer Breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 28, marginBottom: 36, boxShadow: '0 3px 0 #151313' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
            Answer Review
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
            {test.passages.flatMap(p => p.questions).map(q => {
              const userAns = (answers[q.id] || '').trim();
              const isCorrect = isAnswerCorrect(userAns, q.answer);
              const correctStr = Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer;

              return (
                <div key={q.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(255,87,52,0.08)',
                  border: isCorrect ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,87,52,0.3)',
                  fontSize: 13,
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <span style={{
                      fontWeight: 800,
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isCorrect ? 'var(--success-icon)' : '#FF5734',
                      color: isCorrect ? '#fff' : '#151313',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12
                    }}>
                      {q.id}
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {q.prompt} <span style={{ textDecoration: 'underline', fontWeight: 700 }}>{userAns || '(no answer)'}</span> {q.suffix}
                    </span>
                  </div>

                  {!isCorrect && (
                    <div style={{ fontSize: 12, color: 'var(--c-coral)', fontWeight: 700 }}>
                      Correct: {correctStr}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
          <div className={`exam-focus-timer-pill ${timeLeft < 300 ? 'urgent' : ''}`} title="Time remaining">
            <Icon name="clock" size={16} />
            <span>{FMT(timeLeft)}</span>
          </div>

          <button
            type="button"
            className="exam-focus-exit-btn"
            onClick={() => {
              if (window.confirm('Exit reading exam? Your progress will be lost.')) onBack();
            }}
            title="Exit test and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── 2. READING WORKSPACE — split-screen (passage | questions) ── */}
      <div className="reading-split-panes">
        {/* LEFT: passage, independently scrollable on desktop */}
        <div className="reading-pane">
          <div className="exam-doc" style={{
            background: 'var(--bg-card)',
            border: 'var(--border-dark)',
            borderRadius: 'var(--r-card)',
            padding: '24px 30px',
            boxShadow: '0 3px 0 #151313'
          }}>
            {test?.passages?.[activeSectionIndex] && (
              <HtmlContentRenderer
                htmlContent={test.passages[activeSectionIndex].htmlContent}
                answers={answers}
                setAnswers={setAnswers}
              />
            )}
          </div>
        </div>

        {/* RIGHT: questions, independently scrollable on desktop */}
        <div className="reading-pane">
        {/* Question groups — full-width, same pattern as Listening */}
        {(test?.passages?.[activeSectionIndex]?.questionGroups || []).map((g, idx) => {
          const inlineIds = new Set(
            [...(g.htmlContent || '').matchAll(/data-qid="(q\d+)"/g)].map(m => m[1])
          );
          const standalone = (g.questions || []).filter(q => !inlineIds.has(q.id));
          const qRange = g.questions?.length
            ? `${g.questions[0].questionNumber}${g.questions.length > 1 ? `–${g.questions[g.questions.length - 1].questionNumber}` : ''}`
            : '';
          return (
            <div key={g.groupId || idx} className="exam-doc" style={{
              background: 'var(--bg-card)',
              border: 'var(--border-dark)',
              borderRadius: 'var(--r-card)',
              padding: '20px 26px',
              boxShadow: '0 3px 0 #151313',
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              {g.instructions && (
                <div style={{
                  fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                  borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 4
                }}>
                  <span style={{ fontWeight: 800 }}>Questions {qRange}</span>
                  {g.instructions && <span>. {g.instructions}</span>}
                  {g.wordLimit && <span style={{ color: 'var(--text-secondary)' }}> — {g.wordLimit}</span>}
                </div>
              )}
              {g.options && g.options.length > 0 && (
                <div className="stimulus-options" style={{ margin: '0 0 8px' }}>
                  {g.options.map((opt, i) => (
                    <div key={opt.id || i} style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 3 }}>
                      <strong style={{ minWidth: 20 }}>{opt.id}</strong>
                      <span>{opt.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {g.htmlContent && (
                <HtmlContentRenderer htmlContent={g.htmlContent} answers={answers} setAnswers={setAnswers} />
              )}
              {standalone.map(q => (
                <QuestionRenderer key={q.id} question={q} value={answers[q.id]}
                  onChange={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))} />
              ))}
            </div>
          );
        })}
      </div>
      </div>

      {/* ── 3. UNIVERSAL EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => setActiveSectionIndex(Math.max(0, activeSectionIndex - 1))}
        isPreviousDisabled={activeSectionIndex === 0}
        previousLabel="Previous Passage"
        sections={(test?.passages || []).map((p, i) => ({
          label: `Passage ${p.passageNumber}`,
          isCompleted: p.questions?.every(q => answers[q.id]?.trim()) || false
        }))}
        activeSectionIndex={activeSectionIndex}
        onSelectSection={setActiveSectionIndex}
        onNext={() => {
          if (activeSectionIndex < (test?.passages?.length || 1) - 1) {
            setActiveSectionIndex(activeSectionIndex + 1);
          } else {
            handleSubmit();
          }
        }}
        nextLabel={activeSectionIndex < (test?.passages?.length || 1) - 1 ? 'Next Passage' : (isMockMode ? 'Next Section: Writing' : 'Finish & Grade Exam')}
        isSubmit={activeSectionIndex === (test?.passages?.length || 1) - 1 && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-writing' : 'submit-reading-exam'}
      />
    </div>
  );
}
