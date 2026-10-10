import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedListeningTest, getListeningTest } from '../../data/listening/index';
import { evaluateListeningResponses, isCandidateAnswerCorrect } from '../../utils/evaluation/evaluationEngine';
import { calculateListeningBand } from '../../utils/bandCalculator';
import AnswerReviewList from '../common/AnswerReviewList';
import { MultiChoice } from '../reading/ReadingQuestionGroup';
import { recordAttemptedQuestionSet, getTargetBand } from '../../utils/storage';
import ExamStartScreen from './ExamStartScreen';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
import { ResultPage, ResultItem } from '../common/ResultReveal.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import QuestionRenderer from '../common/QuestionRenderer';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function ListeningModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips, onSave }) {
  const [test, setTest] = useState(() => initialTest || (testId ? getListeningTest(testId) : getRandomizedListeningTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [partIdx, setPartIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(32 * 60);
  const [result, setResult] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Practice mode states (pause timer, overtime notification)
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);

  const timerRef = useRef(null);
  const audioRef = useRef(null);

  // References to prevent stale closure bugs when timer expires or async steps resolve
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

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (isMockMode) {
            // In Mock Exam mode: strict auto-submission upon timeout
            clearInterval(timerRef.current);
            handleSubmitRef.current?.();
            return 0;
          } else {
            // In Practice Mode: DO NOT force-exit! Keep student in the exam with overtime notice
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

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSkipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  };

  const handleSkipForward = () => {
    if (!audioRef.current || !audioDuration) return;
    audioRef.current.currentTime = Math.min(audioDuration, audioRef.current.currentTime + 10);
  };

  const handleSpeedChange = (spd) => {
    setPlaybackSpeed(spd);
    if (audioRef.current) {
      audioRef.current.playbackRate = spd;
    }
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);
    if (audioRef.current) audioRef.current.pause();

    // Full mock: the whole exam is graded once at the end — hand over the
    // answers and move straight on to Reading.
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
      // Fetch the test again WITH answers for grading; scoring is the shared
      // deterministic engine (official key notation, order-free "choose N").
      const gradedTest = getListeningTest(currentTest?.testId || testId, true) || currentTest;
      recordAttemptedQuestionSet('listening', currentTest?.testId || testId);
      const evalResult = await evaluateListeningResponses({ sections: gradedTest.parts, answers: currentAnswers });
      const rawScore = evalResult.raw ?? 0;
      const totalScore = evalResult.total || 40;
      const percentageScore = evalResult.percentage || (totalScore ? Math.round((rawScore / totalScore) * 100) : 0);
      const computedBand = (typeof evalResult.band === 'number' && Number.isFinite(evalResult.band))
        ? evalResult.band
        : calculateListeningBand(rawScore);

      const computedResult = {
        ...evalResult,
        band: computedBand,
        raw: rawScore,
        total: totalScore,
        percentage: percentageScore,
        answers: currentAnswers
      };

      setTest(gradedTest);

      // Ensure user sees the processing steps before advancing
      await new Promise(r => setTimeout(r, 2200));

      if (isMockMode) {
        // In Full Mock Mode, transition directly to the next section without intermediate results screen
        if (onComplete) onComplete(computedResult);
        return;
      }

      setResult(computedResult);
      setPhase('results');
    } catch (err) {
      console.error('Listening submission evaluation error:', err);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      // Robust Fallback: Grade deterministically so candidate is NEVER left stranded without a score!
      try {
        const gradedTest = getListeningTest(currentTest?.testId || testId, true) || currentTest;
        const allQuestions = (gradedTest?.parts || []).flatMap(p => p.questions || []);
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
        const localBand = calculateListeningBand(localRaw);
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
        console.error('Critical evaluation fallback error:', fallbackErr);
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
      <ResultPage skill="listening">
        <ResultItem as="button" type="button" className="result-back-btn" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </ResultItem>

        {/* OVERALL HERO CARD */}
        <ResultItem className="result-hero">
          <div>
            <span className="result-eyebrow">
              {isMockMode ? "LISTENING TEST COMPLETE" : "LISTENING PRACTICE COMPLETE"}
            </span>
            <h1 className="result-title">Listening Assessment</h1>
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

        {/* Detailed analysis — question-type performance + recommendations */}
        {!isMockMode && result?.itemResults && (
          <ResultItem>
            <ResultAnalysis skill="listening" resultRecord={{ listening: result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
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

        {/* PROMINENT CORAL CTA SAVE BUTTON */}
        <ResultItem className="result-actions">
          <button
            id="save-listening-result-btn"
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

  /* ──────────────────────────────────────────────────────────
     4. EXAM INTERFACE (Sections 16, 17, 18, 19, 20)
     ────────────────────────────────────────────────────────── */
  const currentPart = test.parts[partIdx];

  return (
    <div className="exam-focus-layout">
      <ScrollToTop />
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: 'var(--c-yellow)', color: '#151313' }}>
            {isMockMode ? 'IELTS ACADEMIC LISTENING' : 'IELTS LISTENING PRACTICE'}
          </span>
          <h2 className="exam-focus-title">
            Part {partIdx + 1} of {test.parts.length} · {currentPart?.title}
          </h2>
        </div>

        <div className="exam-focus-header-right">
          {!isMockMode && (
            <button
              type="button"
              className={`exam-focus-pause-btn ${isTimerPaused ? 'paused' : ''}`}
              onClick={toggleTimerPause}
              title={isTimerPaused ? "Resume Exam Timer" : "Pause Exam Timer"}
            >
              <Icon name={isTimerPaused ? 'play' : 'pause'} size={14} />
              <span>{isTimerPaused ? 'Resume Timer' : 'Pause Timer'}</span>
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
              if (window.confirm('Exit listening practice? Your progress will be lost.')) onBack();
            }}
            title="Exit test and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── 2. PRACTICE OVERTIME NOTIFICATION (Non-strict exit in Practice Mode) ── */}
      {isOvertime && !isMockMode && (
        <div className="practice-overtime-banner">
          <div className="practice-overtime-content">
            <Icon name="clock" size={20} style={{ color: '#8A6D00', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: '#151313' }}>
                Standard Practice Time Elapsed (32 Minutes)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                In Practice Mode, the exam does not force-exit. Take all the time you need to complete remaining questions! When finished, click &ldquo;Finish &amp; Grade Exam&rdquo; below.
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

      {/* ── 3. COGNITION NATIVE AUDIO PLAYER ── */}
      {currentPart?.audioFile && (
        <div className="audio-player-cognition">
          <audio
            ref={audioRef}
            src={currentPart.audioFile}
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

          {!isMockMode && (
            <button
              type="button"
              onClick={handleSkipBackward}
              className="audio-skip-btn"
              title="Rewind 10 seconds"
            >
              <span>-10s</span>
            </button>
          )}

          {!isMockMode && (
            <button
              type="button"
              onClick={handleSkipForward}
              className="audio-skip-btn"
              title="Forward 10 seconds"
            >
              <span>+10s</span>
            </button>
          )}

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

          {!isMockMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[0.75, 1, 1.25, 1.5].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  className={`audio-speed-btn ${playbackSpeed === spd ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(spd)}
                  title={`Set audio speed to ${spd}x`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

          {!isMockMode && (
            <button
              type="button"
              onClick={handleReplay}
              className="audio-skip-btn"
              title="Replay from beginning"
            >
              <Icon name="refreshCw" size={12} />
              <span>Restart</span>
            </button>
          )}

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
              style={{ width: 70, accentColor: 'var(--c-yellow)', cursor: 'pointer' }}
              aria-label="Volume slider"
            />
          </div>

          {!isMockMode && (
            <div className="practice-mode-badge" title="Full pause, rewind & variable speed enabled in practice mode">
              <Icon name="check" size={12} />
              <span>Practice Audio Controls</span>
            </div>
          )}
        </div>
      )}

      {/* ── 4. UNIFIED EXAM FORM (single full-width column) ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        width: '100%',
      }}>
        {currentPart?.questionGroups?.map((g, gIdx) => {
          // Questions whose blank already renders as an inline input in the stimulus
          // are part of the form itself; only standalone questions get a block below.
          const inlineIds = new Set(
            [...(g.htmlContent || '').matchAll(/data-qid="(q\d+)"/g)].map(m => m[1])
          );
          const standalone = g.selection ? [] : (g.questions || []).filter(q => !inlineIds.has(q.id));
          const multi = g.selection ? (
            <MultiChoice
              group={{ startQ: g.questions[0]?.questionNumber, endQ: g.questions[g.questions.length - 1]?.questionNumber,
                questions: g.questions, selectCount: g.selection.selectCount, optionPool: { options: g.selection.options } }}
              prompt={g.selection.prompt}
              answers={answers}
              onAnswer={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))}
            />
          ) : null;
          const hasVisual = Boolean(g.visualHtml);
          // Visual-aware layout: map/diagram-style stimuli leave meaningful space
          // beside them; table/notes groups keep the visual full-width.
          const visualAware = hasVisual && !['table', 'notes'].includes(g.groupType);
          const qRange = g.questions?.length
            ? `${g.questions[0].questionNumber}${g.questions.length > 1 ? `–${g.questions[g.questions.length - 1].questionNumber}` : ''}`
            : '';
          const visual = <div className="exam-visual" dangerouslySetInnerHTML={{ __html: g.visualHtml }} />;
          const items = (
            <div className="exam-visual-items">
              <HtmlContentRenderer
                htmlContent={g.htmlContent}
                answers={answers}
                setAnswers={setAnswers}
              />
              {multi}
              {standalone.map(q => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))}
                />
              ))}
            </div>
          );
          return (
            <div key={g.groupId || gIdx} className="exam-doc" style={{
              background: 'var(--bg-card)',
              border: 'var(--border-dark)',
              borderRadius: 'var(--r-card)',
              padding: '20px 26px',
              boxShadow: '0 3px 0 #151313',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {/* consolidated group header — range + instruction appear ONCE */}
              <div style={{
                fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: 8, marginBottom: 4
              }}>
                <span style={{ fontWeight: 800 }}>Questions {qRange}</span>
                {g.instructions && <span>. {g.instructions}</span>}
                {g.wordLimit && <span style={{ color: 'var(--text-secondary)' }}> — {g.wordLimit}</span>}
              </div>
              {visualAware ? (
                <div className="exam-visual-row">
                  {visual}
                  {items}
                </div>
              ) : (
                <>
                  {hasVisual && <div className="exam-visual" style={{ marginBottom: 10 }}>{visual}</div>}
                  <HtmlContentRenderer
                    htmlContent={g.htmlContent}
                    answers={answers}
                    setAnswers={setAnswers}
                  />
                  {multi}
                  {standalone.map(q => (
                    <QuestionRenderer
                      key={q.id}
                      question={q}
                      value={answers[q.id]}
                      onChange={(id, val) => setAnswers(prev => ({ ...prev, [id]: val }))}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 5. UNIVERSAL 3-ZONE EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => setPartIdx(p => Math.max(0, p - 1))}
        isPreviousDisabled={partIdx === 0}
        previousLabel="Previous Part"
        sections={test.parts.map((p, i) => ({
          label: `Part ${i + 1}`,
          isCompleted: test.parts[i].questions?.every(q => String(answers[q.id] ?? '').trim() !== '')
        }))}
        activeSectionIndex={partIdx}
        onSelectSection={(idx) => setPartIdx(idx)}
        onNext={partIdx < test.parts.length - 1 ? () => setPartIdx(p => p + 1) : handleSubmit}
        isNextDisabled={isSubmitting}
        nextLabel={partIdx < test.parts.length - 1 ? 'Next Part' : isMockMode ? 'Next Section: Reading' : 'Finish & Grade Exam'}
        isSubmit={partIdx === test.parts.length - 1 && !isMockMode}
        nextActionId={isMockMode ? 'next-mock-reading' : 'submit-listening-exam'}
      />
    </div>
  );
}
