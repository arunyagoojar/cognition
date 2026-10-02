import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedListeningTest, getListeningTest } from '../../data/listening/index';
import { calculateListeningBand, isAnswerCorrect } from '../../utils/bandCalculator';
import { recordAttemptedQuestionSet } from '../../utils/storage';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import QuestionRenderer from '../common/QuestionRenderer';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function ListeningModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false }) {
  const [test, setTest] = useState(() => initialTest || (testId ? getListeningTest(testId) : getRandomizedListeningTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [partIdx, setPartIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(32 * 60);
  const [result, setResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startTimer = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (initialPhase === 'exam') {
      startTimer();
    }
  }, [initialPhase, startTimer]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleStartExam = () => {
    setPhase('exam');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    startTimer();
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioCurrentTime(audioRef.current.currentTime);
    if (audioRef.current.duration) {
      setAudioProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * audioDuration;
  };

  const handleSubmit = () => {
    clearInterval(timerRef.current);
    if (audioRef.current) audioRef.current.pause();

    // Fetch the test again WITH answers for grading to prevent client-side cheat vectors
    const gradedTest = getListeningTest(test.testId, true);
    const allQ = gradedTest.parts.flatMap(p => p.questions);
    let correct = 0;
    allQ.forEach(q => {
      if (isAnswerCorrect(answers[q.id], q.answer)) correct++;
    });
    const band = calculateListeningBand(correct);
    recordAttemptedQuestionSet('listening', test.testId);
    const computedResult = {
      band,
      raw: correct,
      total: allQ.length,
      percentage: Math.round((correct / allQ.length) * 100),
      answers
    };

    setTest(gradedTest);

    if (isMockMode) {
      // In Full Mock Mode, transition directly to the next section without intermediate results screen
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
        section="Listening"
        sectionKey="listening"
        testTitle={test?.title || 'IELTS Listening Practice'}
        subtitle="Official 4-part IELTS Academic listening exam with authentic audio tracks, note completion, and multiple choice items."
        metaItems={[
          { label: '4 Parts', sub: 'Academic & everyday contexts' },
          { label: '32 Minutes', sub: 'Strict timed sequence' },
          { label: 'Band 0–9', sub: 'Official-style scoring' },
        ]}
        rules={[
          'Audio recordings are played ONCE only during the exam.',
          'Read the instructions and word count limits for each question carefully.',
          'Type your answers directly into the blanks before audio advances.',
        ]}
        scoringInfo="Each correct answer receives 1 mark. The total raw score out of 40 is converted to the official IELTS 9-band scale."
        ctaText="START LISTENING TEST"
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
            Reviewing your responses against verified IELTS answer keys.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
            {[
              { label: 'Note Completion & Spelling Accuracy', active: processingStep >= 0 },
              { label: 'Distractor Rejection & Section Timing', active: processingStep >= 1 },
              { label: 'Official Raw-to-Band Rounding Computation', active: processingStep >= 2 },
              { label: 'Sub-skill Breakdown & Review Generation', active: processingStep >= 3 },
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
     3. RESULTS SCREEN (Section 23: Deterministic Practice Result)
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const isBandHigh = result?.band >= 7.0;

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
              color: '#FCCC42',
              marginBottom: 12
            }}>
              LISTENING PRACTICE COMPLETE
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Listening Assessment
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

        {/* 3 Columns: What Went Well, Needs Attention, Recommended Practice */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 36 }}>
          {/* What went well (3 cards max) */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#10B981', marginBottom: 16 }}>
              <Icon name="check" size={16} /> What Went Well
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Part 1 & 2 Accuracy:</strong> Successfully retrieved basic concrete details and contact information.
              </div>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Pacing:</strong> Kept pace with the recording through transitional discourse markers.
              </div>
              {isBandHigh && (
                <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>Academic Lectures:</strong> Identified core theoretical points during sustained monologues.
                </div>
              )}
            </div>
          </div>

          {/* Needs attention (3 cards max) */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--c-coral)', marginBottom: 16 }}>
              <Icon name="zap" size={16} /> Needs Attention
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Signpost Paraphrases:</strong> Watch for speakers altering vocabulary just prior to delivering the target noun.
              </div>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Distractor Negations:</strong> Speakers often mention an initial proposal, then correct themselves with "actually" or "however".
              </div>
              <div style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <strong>Word Count Restrictions:</strong> Strictly respect "NO MORE THAN ONE WORD AND/OR A NUMBER".
              </div>
            </div>
          </div>

          {/* Recommended next practice (2-3 actions) */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
              <Icon name="arrowRight" size={16} /> Recommended Practice
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 14, background: 'rgba(252, 204, 66, 0.15)', border: '1px solid #151313', borderRadius: 12, fontSize: 13 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Part 4 Monologues</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Practice 10 consecutive note-completion items without pauses.</div>
              </div>
              <div style={{ padding: 14, background: 'rgba(190, 148, 245, 0.12)', border: '1px solid #151313', borderRadius: 12, fontSize: 13 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Learning Hub Masterclass</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Watch "Identifying Paraphrases & Trap Distractors" video lesson.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Answer Breakdown / Review Table */}
        <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 28, marginBottom: 36, boxShadow: '0 3px 0 #151313' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
            Answer Review
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
            {test.parts.flatMap(p => p.questions).map(q => {
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
                      background: isCorrect ? '#10B981' : '#FF5734',
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
            id="save-listening-result-btn"
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

  /* ──────────────────────────────────────────────────────────
     4. EXAM INTERFACE (Sections 16, 17, 18, 19, 20)
     ────────────────────────────────────────────────────────── */
  const currentPart = test.parts[partIdx];

  return (
    <div className="exam-focus-layout">
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: 'var(--c-yellow)', color: '#151313' }}>
            IELTS LISTENING PRACTICE
          </span>
          <h2 className="exam-focus-title">
            Part {partIdx + 1} of {test.parts.length} · {currentPart?.title}
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
              if (window.confirm('Exit listening practice? Your progress will be lost.')) onBack();
            }}
            title="Exit test and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── 2. INSTRUCTIONS / CONTEXT CARD ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: 'var(--border-dark)',
        borderRadius: 'var(--r-card)',
        padding: '22px 28px',
        boxShadow: '0 3px 0 #151313'
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          IELTS LISTENING SECTION {partIdx + 1}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.55 }}>
          {currentPart?.instructions}
        </div>
      </div>

      {/* ── 3. COGNITION NATIVE AUDIO PLAYER ── */}
      {currentPart?.audioFile && (
        <div className="audio-player-cognition">
          <audio
            ref={audioRef}
            src={currentPart.audioFile.replace(/^(\.\.\/)+wp-content/, '/wp-content')}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />

          <button
            type="button"
            onClick={togglePlayAudio}
            className="audio-play-round-btn"
            title={isPlaying ? 'Pause Audio' : 'Play Audio'}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
          </button>

          <span style={{ fontFamily: 'Kodchasan, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 44 }}>
            {FMT(Math.floor(audioCurrentTime))}
          </span>

          {/* Scrubber Timeline */}
          <div className="audio-timeline-track" onClick={handleSeek} title="Audio timeline track">
            <div className="audio-timeline-fill" style={{ width: `${audioProgress}%` }} />
          </div>

          <span style={{ fontFamily: 'Kodchasan, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 44 }}>
            {audioDuration ? FMT(Math.floor(audioDuration)) : '08:15'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <Icon name="volume" size={16} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (audioRef.current) audioRef.current.volume = val;
              }}
              style={{ width: 80, accentColor: 'var(--c-yellow)', cursor: 'pointer' }}
              aria-label="Volume slider"
            />
          </div>
        </div>
      )}

      {/* ── 4. QUESTIONS CONTAINER (COGNITION HTML RENDERER & UI) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 24,
        alignItems: 'start'
      }}>
        {/* Left: Context/Tables (Read-only reference if possible) */}
        <div style={{
          background: 'var(--bg-card)',
          border: 'var(--border-dark)',
          borderRadius: 'var(--r-card)',
          padding: '32px 28px',
          boxShadow: '0 3px 0 #151313',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <HtmlContentRenderer 
            htmlContent={currentPart?.htmlContent} 
            answers={answers}
            setAnswers={setAnswers}
          />
        </div>

        {/* Right: Question Panel */}
        <div style={{
          background: 'var(--surface-sunken)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-card)',
          padding: '24px 20px',
          maxHeight: '600px',
          overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Questions</h3>
          {currentPart?.questionGroups ? (
            currentPart.questionGroups.map((g, idx) => (
              <div key={idx} style={{ marginBottom: 24 }}>
                {g.instructions && (
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)', background: 'var(--surface)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    {g.instructions}
                  </div>
                )}
                {g.options && g.options.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-canvas)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>Options</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {g.options.map((opt, i) => (
                        <div key={opt.id || i} style={{ display: 'flex', gap: 8, fontSize: 14 }}>
                          <strong style={{ minWidth: 20 }}>{opt.id}</strong>
                          <span>{opt.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {g.questions.map(q => (
                  <QuestionRenderer 
                    key={q.id} 
                    question={q} 
                    value={answers[q.id]} 
                    onChange={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))} 
                  />
                ))}
              </div>
            ))
          ) : (
            currentPart?.questions?.map(q => (
              <QuestionRenderer 
                key={q.id} 
                question={q} 
                value={answers[q.id]} 
                onChange={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))} 
              />
            ))
          )}
          {(!currentPart?.questions || currentPart.questions.length === 0) && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              No structured questions detected.
            </div>
          )}
        </div>
      </div>

      {/* ── 5. UNIVERSAL 3-ZONE EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => setPartIdx(p => Math.max(0, p - 1))}
        isPreviousDisabled={partIdx === 0}
        previousLabel="Previous Part"
        sections={test.parts.map((p, i) => ({
          label: `Part ${i + 1}`,
          isCompleted: test.parts[i].questions?.every(q => Boolean(answers[q.id]?.trim()))
        }))}
        activeSectionIndex={partIdx}
        onSelectSection={(idx) => setPartIdx(idx)}
        onNext={partIdx < test.parts.length - 1 ? () => setPartIdx(p => p + 1) : handleSubmit}
        nextLabel={partIdx < test.parts.length - 1 ? 'Next Part' : isMockMode ? 'Next Section: Reading' : 'Finish & Grade Exam'}
        isSubmit={partIdx === test.parts.length - 1 && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-reading' : 'submit-listening-exam'}
      />
    </div>
  );
}
