import React, { useState, useEffect } from 'react';
import AudioRecorder from '../common/AudioRecorder';
import SpeakingScoreModal from './SpeakingScoreModal';
import ExitConfirmationModal from '../common/ExitConfirmationModal';
import ExitScreen from '../common/ExitScreen';
import { Clock, Sparkles, ArrowLeft, ArrowRight, Send, Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import { evaluateSpeakingLocally, evaluateSpeakingWithGemini } from '../../utils/speakingScorer';
import { saveSkillScore, getApiKey, recordAttemptedQuestionSet } from '../../utils/storage';
import { getNextSpeakingTest, SPEAKING_TEST_POOLS } from '../../data/questionPools/speakingPool';

export default function SpeakingModule({ testData, onComplete, isExamMode = false, onBackToDashboard }) {
  // Initialize speaking test from unattempted primary pool (randomized initial start)
  const [testSelection, setTestSelection] = useState(() => {
    return getNextSpeakingTest();
  });
  const currentSpeakingTest = testSelection.test;

  const [activePart, setActivePart] = useState(() => Number(new URLSearchParams(window.location.search).get('part')) || 1);
  const [prepTimeRemaining, setPrepTimeRemaining] = useState(60);
  const [isPrepActive, setIsPrepActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [showSampleAnswers, setShowSampleAnswers] = useState(false);

  // Storage for recorded responses & transcripts across all parts
  const [recordings, setRecordings] = useState({});
  const [transcripts, setTranscripts] = useState({});
  const [durations, setDurations] = useState({});

  // Exit Confirmation Modal and Exit Screen state
  const [isExitModalOpen, setIsExitModalOpen] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('showExitModal') === '1';
  });
  const [isExited, setIsExited] = useState(false);

  // Score modal state
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // 1-minute cue card prep timer
  useEffect(() => {
    let interval = null;
    if (isPrepActive && prepTimeRemaining > 0) {
      interval = setInterval(() => {
        setPrepTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (prepTimeRemaining === 0) {
      setIsPrepActive(false);
    }
    return () => clearInterval(interval);
  }, [isPrepActive, prepTimeRemaining]);

  const handleRecordingSaved = (key, blob, url, transcriptText, secs) => {
    if (url) {
      setRecordings(prev => ({ ...prev, [key]: url }));
    }
    if (transcriptText) {
      setTranscripts(prev => ({ ...prev, [key]: transcriptText }));
    }
    if (secs) {
      setDurations(prev => ({ ...prev, [key]: secs }));
    }
  };

  // Retake / Next attempt action: select the next unattempted test set from pool
  const handlePracticeNext = () => {
    setIsScoreModalOpen(false);
    const nextSelection = getNextSpeakingTest(currentSpeakingTest.id);
    setTestSelection(nextSelection);
    setActivePart(1);
    setRecordings({});
    setTranscripts({});
    setDurations({});
    setNotes('');
    setPrepTimeRemaining(60);
    setIsPrepActive(false);
    setScoreResult(null);
    setIsSubmitted(false);
  };

  // Progression check before exiting (only true if there is unsubmitted speech)
  const hasProgress = (Object.keys(recordings).length > 0 || 
                      Object.keys(transcripts).length > 0 || 
                      notes.trim().length > 0) && !isSubmitted;

  const handleBackClick = () => {
    if (hasProgress && !isExamMode) {
      setIsExitModalOpen(true);
    } else if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    // Explicitly discard progression without updating scores or analytics
    setRecordings({});
    setTranscripts({});
    setDurations({});
    setNotes('');
    setIsExited(true);
  };

  const handleCloseScoreModal = () => {
    setIsScoreModalOpen(false);
    if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  // Strict score commit: only runs when user has recorded at least one part
  const handleSubmitSpeaking = async () => {
    // Guard: require at least one recording or transcript from the user
    const hasAnyRecording = Object.keys(recordings).length > 0 || Object.keys(transcripts).length > 0;
    if (!hasAnyRecording) {
      setSubmitError('Please record at least one speaking response before submitting.');
      return;
    }
    setSubmitError('');
    setIsEvaluating(true);
    try {
      const apiKey = getApiKey();
      let result;

      // Only use what the user actually recorded — no fake fallback
      const activeTranscripts = transcripts;
      const activeDurations = durations;

      if (apiKey) {
        try {
          result = await evaluateSpeakingWithGemini(
            apiKey,
            activeTranscripts,
            `${currentSpeakingTest.title} (Parts 1, 2, and 3)`
          );
        } catch (err) {
          console.warn('Gemini evaluation failed, falling back to local scoring:', err);
        }
      }

      if (!result) {
        result = evaluateSpeakingLocally(activeTranscripts, activeDurations);
      }

      setScoreResult(result);
      setIsScoreModalOpen(true);
      setIsSubmitted(true);
      // Only here is the score officially committed to scorecard & analytics
      saveSkillScore('speaking', result);
      // Record in attempted history so it goes into the attempted pool
      recordAttemptedQuestionSet('speaking', currentSpeakingTest.id);

      if (onComplete) {
        onComplete(result);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const currentPartData = currentSpeakingTest.parts.find(p => p.part === activePart) || currentSpeakingTest.parts[0];

  if (isExited) {
    return (
      <ExitScreen
        sectionTitle="IELTS Speaking Interview Session"
        onReturnToDashboard={() => {
          setIsExited(false);
          if (onBackToDashboard) onBackToDashboard();
        }}
        onRestart={() => {
          setIsExited(false);
          handlePracticeNext();
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
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
            {currentSpeakingTest.parts.map((p) => (
              <button
                key={p.part}
                className={`segmented-btn ${activePart === p.part ? 'active' : ''}`}
                onClick={() => setActivePart(p.part)}
              >
                <span>Part {p.part}</span>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                  {p.part === 1 ? 'Interview' : p.part === 2 ? 'Cue Card' : 'Discussion'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Subtle Pool Status Indicator (No interactive shuffle button) */}
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-purple)'
            }} />
            <span>Unattempted Pool • {testSelection.poolInfo?.remainingInPool || 1} of {testSelection.poolInfo?.totalCount || 5}</span>
          </div>

          {!isExamMode && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowSampleAnswers(!showSampleAnswers)}
              style={{ fontSize: 12.5 }}
            >
              <Sparkles size={15} color="var(--accent-purple)" />
              <span>{showSampleAnswers ? 'Hide Model Answers' : 'View Band 8.5 Answers'}</span>
            </button>
          )}

          <span className="badge badge-purple" style={{ fontSize: 13, padding: '4px 10px' }}>
            <Clock size={13} />
            {currentPartData.duration}
          </span>

          <button
            className="btn btn-primary"
            onClick={handleSubmitSpeaking}
            disabled={isEvaluating}
            style={{
              background: 'linear-gradient(135deg, #9065b0, #7c3aed)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13.5
            }}
          >
            {isEvaluating ? (
              <span>Evaluating...</span>
            ) : (
              <>
                <Send size={14} />
                <span>Submit Speaking Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Test Theme Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="badge badge-neutral" style={{ fontSize: 11 }}>
          {currentSpeakingTest.title}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          IELTS Academic Speaking Test Format
        </span>
      </div>

      {/* Submit Validation Error */}
      {submitError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: 13,
          color: 'var(--accent-red)'
        }}>
          <span>⚠️</span>
          <span>{submitError}</span>
        </div>
      )}

      {/* Part 1: Introduction & Familiar Topics */}
      {activePart === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              Part 1: Interview & Familiar Questions
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Theme: {currentPartData.theme} — Respond naturally with 2-3 full sentences for each question.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {currentPartData.questions.map((q, idx) => (
              <div key={q.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-neutral" style={{ marginBottom: 6 }}>Question {idx + 1}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{q.question}</h3>
                  </div>
                </div>

                <AudioRecorder
                  label={`Record Answer for Q${idx + 1}`}
                  onRecordingComplete={(blob, url, text, secs) => handleRecordingSaved(q.id, blob, url, text, secs)}
                />

                {showSampleAnswers && (
                  <div style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    borderLeft: '3px solid var(--accent-purple)'
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-purple)', marginBottom: 4 }}>
                      Band 8.5 Model Response:
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 6 }}>
                      "{q.sampleAnswer}"
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      💡 Examiner Tip: {q.tip}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Part 2: Long Turn (Cue Card) */}
      {activePart === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="speaking-studio-grid">
            {/* Left: Cue Card */}
            <div className="cue-card-box">
              <span className="badge badge-blue" style={{ marginBottom: 12 }}>Candidate Cue Card</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, lineHeight: 1.4 }}>
                {currentPartData.cueCard.topic}
              </h2>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
                You should say:
              </div>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                {currentPartData.cueCard.prompts.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                You have 1 minute to prepare and make notes. You should talk for 1 to 2 minutes.
              </div>
            </div>

            {/* Right: 1-Minute Prep Timer & Notes Scratchpad */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>1-Minute Preparation</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!isPrepActive ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => { setIsPrepActive(true); setPrepTimeRemaining(60); }}
                      style={{ padding: '4px 12px', fontSize: 12.5 }}
                    >
                      <Play size={13} />
                      <span>Start Prep Timer</span>
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      onClick={() => setIsPrepActive(false)}
                      style={{ padding: '4px 12px', fontSize: 12.5 }}
                    >
                      <Pause size={13} />
                      <span>Pause</span>
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setIsPrepActive(false); setPrepTimeRemaining(60); }}
                    style={{ padding: 4 }}
                    title="Reset timer"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Circular Prep Display */}
              <div className="speaking-timer-circle" style={{ borderColor: prepTimeRemaining < 10 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
                <span className="speaking-timer-seconds" style={{ color: prepTimeRemaining < 10 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                  {prepTimeRemaining}s
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>prep remaining</span>
              </div>

              {/* Digital Scratchpad */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Scratchpad (Jot down your keywords & structure during the 1 min):
                </label>
                <textarea
                  style={{ width: '100%', minHeight: 90, fontSize: 13 }}
                  placeholder="e.g. 1. Context & location 2. Key participants 3. Sensory impressions 4. Retrospective perspective..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 2-Minute Speech Recording Box */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Record Your 2-Minute Speech</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Speak continuously without stopping for at least 1 minute and 40 seconds to target Band 7.5+.
            </p>

            <AudioRecorder
              label="Start 2-Minute Speech Recording"
              onRecordingComplete={(blob, url, text, secs) => handleRecordingSaved('part2_speech', blob, url, text, secs)}
            />

            {showSampleAnswers && (
              <div style={{
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                marginTop: 8
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', marginBottom: 8 }}>
                  Band 8.5 Model Monologue Transcript:
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                  {currentPartData.cueCard.modelAnswer}
                </pre>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {currentPartData.cueCard.keyVocabulary.map((word, wIdx) => (
                    <span key={wIdx} className="badge badge-purple">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Part 3: Two-Way Discussion */}
      {activePart === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
              Part 3: In-Depth Discussion
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Theme: {currentPartData.theme} — Provide abstract analysis, contrast viewpoints, and justify opinions.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {currentPartData.questions.map((q, idx) => (
              <div key={q.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-purple" style={{ marginBottom: 6 }}>{q.subtopic}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 600 }}>{q.question}</h3>
                  </div>
                </div>

                <AudioRecorder
                  label={`Record Discussion for Q${idx + 1}`}
                  onRecordingComplete={(blob, url, text, secs) => handleRecordingSaved(q.id, blob, url, text, secs)}
                />

                {showSampleAnswers && (
                  <div style={{
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    borderLeft: '3px solid var(--accent-purple)'
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-purple)', marginBottom: 4 }}>
                      Band 8.5 Model Response:
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 6 }}>
                      "{q.sampleAnswer}"
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      💡 Evaluation Tip: {q.tip}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Action Navigation Bar (Always visible without scrolling) */}
      <div className="sticky-bottom-action-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span className="badge badge-purple" style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}>
            Part {activePart} / 3 — {activePart === 1 ? 'Introduction' : activePart === 2 ? 'Long Turn' : 'Discussion'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activePart > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setActivePart(prev => Math.max(1, prev - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ borderRadius: 'var(--radius-pill)', padding: '9px 18px', fontSize: 13 }}
            >
              <ArrowLeft size={14} />
              <span>Previous: Part {activePart - 1}</span>
            </button>
          )}

          {activePart < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setActivePart(prev => Math.min(3, prev + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 22px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-purple), #7c3aed)',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                fontWeight: 600
              }}
            >
              <span>Next Section: Part {activePart + 1}</span>
              <ArrowRight size={15} />
            </button>
          ) : isSubmitted ? (
            <button
              className="btn btn-primary"
              onClick={onBackToDashboard}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-green), #16a34a)',
                boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CheckCircle2 size={16} />
              <span>Evaluation Complete • Return to Dashboard</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmitSpeaking}
              disabled={isEvaluating}
              style={{
                borderRadius: 'var(--radius-pill)',
                padding: '10px 24px',
                fontSize: 13.5,
                background: 'linear-gradient(135deg, var(--accent-purple), #7c3aed)',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                fontWeight: 600
              }}
            >
              {isEvaluating ? (
                <span>Evaluating Speech with Examiner AI...</span>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Speaking for Evaluation</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scorecard Modal */}
      <SpeakingScoreModal
        isOpen={isScoreModalOpen}
        onClose={handleCloseScoreModal}
        scoreResult={scoreResult}
        onRetake={handlePracticeNext}
      />

      {/* Exit Confirmation Guard Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Speaking Practice Session"
      />
    </div>
  );
}
