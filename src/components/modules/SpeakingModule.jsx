import React, { useState, useRef, useEffect } from 'react';
import AiWaitNote from '../common/AiWaitNote';
import { motion } from 'motion/react';
import { Icon } from '../common/Icon';
import { getRandomizedSpeakingTest, getSpeakingTest } from '../../data/speaking/index';
import ExamStartScreen from './ExamStartScreen';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
import ExamBottomNav from './ExamBottomNav';
import { evaluateSpeakingResponses } from '../../utils/evaluation/evaluationEngine';
import { detectSupportedAudioMimeType, saveAudioRecording, getAudioRecording, createAudioBlob } from '../../utils/audio/audioStore';
import { createAttemptId, getTargetBand } from '../../utils/storage';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ── Recording state machine (mutually exclusive states) ──
   IDLE → PREPARING → READY_TO_SPEAK → RECORDING → (TIME_REACHED|SAVED)
   → TRANSCRIBING → EVALUATING → COMPLETED | FAILED                            */
const REC_STATE = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  READY_TO_SPEAK: 'ready_to_speak',
  RECORDING: 'recording',
  TIME_REACHED: 'time_reached',
  SAVED: 'saved',
  TRANSCRIBING: 'transcribing',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

const PART1_SECONDS = 45;      // per-question guidance
const PART2_PREP_SECONDS = 60; // official: 1 minute preparation
const PART2_SPEAK_SECONDS = 120; // official: up to 2 minutes
const PART3_SECONDS = 45;

export default function SpeakingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips }) {
  const [test] = useState(() => initialTest || (testId ? getSpeakingTest(testId) : getRandomizedSpeakingTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [partIdx, setPartIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [recState, setRecState] = useState(REC_STATE.IDLE);

  // Part 2 flow state
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(null);
  const [notes, setNotes] = useState('');
  const [speakSeconds, setSpeakSeconds] = useState(0);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordings, setRecordings] = useState({}); // key: `${partIdx}_${qIdx}` → { blob, url, duration, transcript, notes }
  const [activePlaybackUrl, setActivePlaybackUrl] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Processing / evaluation
  const [evalStages, setEvalStages] = useState({});
  const [result, setResult] = useState(null);

  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');
  const recordSecondsRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const prepIntervalRef = useRef(null);
  const speakIntervalRef = useRef(null);
  const notesRef = useRef('');
  notesRef.current = notes;

  const currentPart = test?.parts?.[partIdx];
  const isPart2 = currentPart?.partNumber === 2;
  const questions = currentPart?.questions || [];
  const totalQuestionsInPart = questions.length || 1;
  const currentQuestion = questions[questionIdx];
  const currentKey = `${partIdx}_${questionIdx}`;
  const currentRecording = recordings[currentKey];
  const targetSeconds = isPart2 ? PART2_SPEAK_SECONDS : PART1_SECONDS;

  useEffect(() => {
    return () => {
      clearInterval(recordIntervalRef.current);
      clearInterval(prepIntervalRef.current);
      clearInterval(speakIntervalRef.current);
      Object.values(recordings).forEach(rec => {
        if (rec?.url) URL.revokeObjectURL(rec.url);
      });
    };
  }, [recordings]);

  /* ── Part 2: preparation → speaking, official timings ── */
  const startPreparation = () => {
    setRecState(REC_STATE.PREPARING);
    setPrepSecondsLeft(PART2_PREP_SECONDS);
    prepIntervalRef.current = setInterval(() => {
      setPrepSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current);
          setRecState(REC_STATE.READY_TO_SPEAK);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipPreparation = () => {
    clearInterval(prepIntervalRef.current);
    setPrepSecondsLeft(0);
    setRecState(REC_STATE.READY_TO_SPEAK);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeType = detectSupportedAudioMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';
          rec.onresult = (e) => {
            let full = '';
            for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
            const clean = full.trim();
            setLiveTranscript(clean);
            liveTranscriptRef.current = clean;
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch (e) { /* transcription optional */ }
      }

      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = createAudioBlob(chunks, detectSupportedAudioMimeType());
        const url = URL.createObjectURL(blob);
        const transcriptText = liveTranscriptRef.current || '';
        const dur = recordSecondsRef.current || 0;
        const qId = currentKey;
        const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        saveAudioRecording({ recordingId, attemptId: 'temp_attempt', questionId: qId, blob, mimeType, duration: dur })
          .catch(() => {});
        setRecordings(prev => ({
          ...prev,
          [qId]: {
            recordingId, blob, url, duration: dur, transcript: transcriptText,
            qText: isPart2 ? currentPart?.cueCard?.topic : currentQuestion,
            // notes are planning material — stored with the response, never evaluated
            notes: isPart2 ? notesRef.current : undefined,
          }
        }));
        setActivePlaybackUrl(url);
        setRecState(REC_STATE.SAVED);
        setRecState(prev => prev === REC_STATE.SAVED ? REC_STATE.TRANSCRIBING : prev);
        setTimeout(() => setRecState(REC_STATE.COMPLETED), 700);
        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} recognitionRef.current = null; }
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecState(REC_STATE.RECORDING);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      setActivePlaybackUrl(null);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => {
          const next = s + 1;
          recordSecondsRef.current = next;
          if (isPart2 && next >= PART2_SPEAK_SECONDS) {
            setRecState(REC_STATE.TIME_REACHED);
            setTimeout(() => stopRecording(), 60);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setRecState(REC_STATE.FAILED);
    }
  };

  const stopRecording = () => {
    clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const replayRecording = () => {
    if (!currentRecording?.url) return;
    setActivePlaybackUrl(currentRecording.url);
  };

  const hasNextQuestion = () => questionIdx < totalQuestionsInPart - 1;
  const hasNextPart = () => partIdx < test.parts.length - 1;
  const isLastInteraction = !hasNextQuestion() && !hasNextPart();

  const handleNext = () => {
    stopRecording();
    setActivePlaybackUrl(null);
    setRecState(REC_STATE.IDLE);
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    if (hasNextQuestion()) {
      setQuestionIdx(i => i + 1);
    } else if (hasNextPart()) {
      setPartIdx(p => p + 1);
      setQuestionIdx(0);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    stopRecording();
    // honest staged analysis, then evaluation
    setPhase('processing');
    const stages = { recordings: 'working', transcript: 'queued', fluency: 'queued', lexical: 'queued', grammar: 'queued', pronunciation: 'not_assessed' };
    setEvalStages({ ...stages });
    setTimeout(() => setEvalStages(s => ({ ...s, recordings: 'done', transcript: 'working' })), 500);
    setTimeout(() => setEvalStages(s => ({ ...s, transcript: 'done', fluency: 'working' })), 1100);
    setTimeout(() => setEvalStages(s => ({ ...s, fluency: 'analysing', lexical: 'analysing', grammar: 'analysing' })), 1800);

    const transcripts = {};
    const durations = {};
    const audioRecordings = {};
    Object.entries(recordings).forEach(([k, rec]) => {
      transcripts[k] = rec.transcript || '';
      durations[k] = rec.duration || 30;
      audioRecordings[k] = rec.blob || null;
    });

    // Full mock: the combined report evaluates all four skills together, so the
    // Speaking module hands over its answers instead of showing its own results
    if (isMockMode) {
      if (onComplete) onComplete({ transcripts, recordings, durations, recordedCount: Object.keys(recordings).length });
      return;
    }

    const expectedQuestions = (test?.parts || []).reduce((n, p) => n + (p.questions?.length || 0), 0);
    const evalResult = await evaluateSpeakingResponses({
      transcripts,
      testMeta: { title: test?.title || 'IELTS Speaking Practice' },
      audioRecordings,
      attemptId: createAttemptId('speaking'),
      expectedQuestions,
    });

    setTimeout(() => {
      setEvalStages(s => ({ ...s, fluency: 'done', lexical: 'done', grammar: 'done' }));
      setResult({
        band: evalResult.overallSpeakingBand,
        recordings,
        transcripts,
        recordedCount: Object.keys(recordings).length,
        totalParts: test.parts.length,
        ...evalResult
      });
      setPhase('results');
    }, 2500);
  };

  /* ──────────────────────────────────────────────────────────
     1. INTRO
     ────────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    const fullCoverage = (test.parts || []).length >= 3;
    return (
      <ExamStartScreen
        section="Speaking"
        sectionKey="speaking"
        testTitle={test?.title || 'IELTS Speaking Practice'}
        subtitle="A three-part IELTS interview: introduction, cue-card long turn, and abstract discussion with recording and response-level evaluation."
        metaItems={[
          { label: fullCoverage ? '3 Parts' : 'Part 2 Cue Cards', sub: fullCoverage ? 'Interview · Long Turn · Discussion' : 'Source coverage: cue cards (Part 1/3 practice content)' },
          { label: '11–14 Minutes', sub: 'Official interview timing' },
          { label: 'Band 0–9', sub: 'Official-style criteria' },
        ]}
        rules={[
          'Ensure your microphone is connected and authorized in your browser before starting.',
          'Part 1: short conversational responses on familiar topics.',
          'Part 2: 1 minute of note preparation followed by a 2-minute sustained monologue.',
          'Part 3: extended discussion connected to your Part 2 topic.',
        ]}
        scoringInfo="Assessed across Fluency & Coherence, Lexical Resource, and Grammatical Range & Accuracy from your transcript. Pronunciation requires audio analysis and is reported as Not assessed."
        ctaText="START SPEAKING TEST"
        onStart={() => { setPhase('exam'); setPartIdx(0); setQuestionIdx(0); }}
        onBack={onBack}
      />
    );
  }

  /* ──────────────────────────────────────────────────────────
     2. PROCESSING (staged, honest)
     ────────────────────────────────────────────────────────── */
  if (phase === 'processing') {
    const STAGE_LABELS = {
      recordings: 'Recordings processed',
      transcript: 'Transcript prepared',
      fluency: 'Fluency & Coherence',
      lexical: 'Lexical Resource',
      grammar: 'Grammar',
      pronunciation: 'Pronunciation',
    };
    return (
      <div style={{ maxWidth: 640, margin: '100px auto', padding: '0 24px', textAlign: 'center' }}>
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 84, height: 84, margin: '0 auto 28px', position: 'relative',
            borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--coral, #FF5734)',
            borderRightColor: 'var(--c-yellow, #F5C518)',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              border: '2px dashed var(--border-subtle)',
            }}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="mic" size={30} />
          </div>
        </motion.div>

        <h2 style={{ fontSize: 25, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Analysing your interview…
        </h2>
        <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginBottom: 30 }}>
          Processing each recorded turn against the official IELTS criteria.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', maxWidth: 380, margin: '0 auto' }}>
          {Object.entries(STAGE_LABELS).map(([k, label]) => {
            const st = evalStages[k] || 'queued';
            const color = st === 'done' ? 'var(--success-icon)' : st === 'working' || st === 'analysing' ? 'var(--text-primary)' : 'var(--text-secondary)';
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
                fontSize: 14, fontWeight: 600, color,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {st === 'done' && <Icon name="check" size={15} />}
                  {label}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {st === 'done' ? '✓' : st === 'working' ? 'Analysing…' : st === 'analysing' ? 'Analysing…' : st === 'not_assessed' ? 'Requires audio analysis' : 'Queued'}
                </span>
              </div>
            );
          })}
        </div>
        <AiWaitNote what="your interview" />
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     3. RESULTS
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const state = result?.evaluationState;
    const isFull = state === 'COMPLETED';
    const isPartial = state === 'PARTIAL';
    const criteriaList = [
      { id: 'fluency', title: 'Fluency & Coherence', data: result?.criteria?.fluencyAndCoherence, defaultNote: 'Speech continuity, hesitation, linking phrases, and idea development.' },
      { id: 'lexical', title: 'Lexical Resource', data: result?.criteria?.lexicalResource, defaultNote: 'Topic vocabulary range, academic phrasing, precision, and collocation.' },
      { id: 'grammar', title: 'Grammatical Range & Accuracy', data: result?.criteria?.grammaticalRangeAndAccuracy, defaultNote: 'Syntactic complexity, tense control, clause variety, and grammatical precision.' },
      { id: 'pronunciation', title: 'Pronunciation', data: result?.criteria?.pronunciation, defaultNote: '' },
    ];

    const handleSaveAndReturn = () => {
      const attemptId = createAttemptId('speaking');
      const canonicalAttempt = {
        id: attemptId,
        type: 'speaking',
        testId: test?.testId || testId || 'speaking-practice',
        testLabel: test?.title || 'IELTS Speaking Practice',
        startedAt: new Date(Date.now() - 900000).toISOString(),
        completedAt: new Date().toISOString(),
        status: isFull ? 'completed' : 'partial',
        overallBand: isFull ? result.overallSpeakingBand : null,
        speaking: {
          band: isFull ? result.overallSpeakingBand : null,
          evaluationState: state,
          evaluationStatus: result?.status || 'failed',
          criteria: result?.criteria || null,
          overallSummary: result?.overallSummary || '',
          strengths: result?.strengths || '',
          areasForImprovement: result?.areasForImprovement || '',
          recordedCount: Object.keys(recordings).length,
          recordings,
          transcripts: result?.transcripts || {},
        }
      };
      if (onComplete) onComplete(canonicalAttempt.speaking);
    };

    return (
      <div className="exam-results-screen" style={{ maxWidth: 1080, margin: '40px auto', padding: '0 24px 80px' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24 }}>
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </button>

        {/* header card: PARTIAL vs FULL, never both */}
        <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 24, padding: '34px 40px', marginBottom: 28, boxShadow: '0 4px 0 #151313' }}>
          {isFull ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>FULL SPEAKING ASSESSMENT</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
                <span style={{ fontSize: 52, fontWeight: 800 }}>{typeof result.overallSpeakingBand === 'number' ? result.overallSpeakingBand.toFixed(1) : '—'}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>Overall Speaking Band</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>PARTIAL SPEAKING ASSESSMENT</div>
              <div style={{ fontSize: 21, fontWeight: 800, marginTop: 10 }}>
                {state === 'NOT_CONFIGURED' && 'AI evaluation is unavailable'}
                {state === 'NOT_ASSESSED' && 'Not enough speech was recorded'}
                {state === 'FAILED' && 'Evaluation could not be completed'}
                {isPartial && 'Response-level feedback — not a band score'}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 10, fontFamily: 'var(--font-family)' }}>
                {result?.coverage?.statement || ''}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 640 }}>
                {state === 'NOT_CONFIGURED' && (result?.message || 'Add an API key in Settings to receive criterion-level feedback.')}
                {state === 'NOT_ASSESSED' && (result?.message || 'Record at least one full answer to receive feedback.')}
                {state === 'FAILED' && (result?.message || 'You can retry the evaluation.')}
                {isPartial && 'A full IELTS Speaking band requires all three parts of the interview. Band scores are withheld; the feedback below covers only what you said.'}
              </div>
              {state === 'NOT_CONFIGURED' && (
                <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                  Your recordings are kept on this page. Add your Gemini key in Settings (profile menu), then press Retry evaluation.
                </p>
              )}
              {(state === 'FAILED' || state === 'NOT_CONFIGURED') && (
                <button onClick={handleFinish} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 12, fontWeight: 800, border: '1.5px solid #151313', background: 'var(--c-yellow)', cursor: 'pointer' }}>
                  Retry evaluation
                </button>
              )}
            </>
          )}
        </div>

                {!isMockMode && (
          <div style={{ marginBottom: 36 }}>
            <ResultAnalysis skill="speaking" resultRecord={{ speaking: result?.canonical || result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
          </div>
        )}

{/* criteria: scores exist ONLY when evaluation produced them */}
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 14px' }}>Assessment Criteria</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
          {criteriaList.map(c => {
            const hasBand = typeof c.data?.band === 'number';
            const isPron = c.id === 'pronunciation';
            const hasEval = state === 'COMPLETED' || state === 'PARTIAL';
            return (
              <div key={c.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{c.title}</div>
                  {hasBand ? (
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{c.data.band.toFixed(1)}</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {isPron ? 'Not assessed' : hasEval ? 'Not scored' : 'Unavailable'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {isPron
                    ? (c.data?.reason || 'Audio pronunciation analysis is not currently available.')
                    : hasBand
                      ? (c.data?.notes || c.defaultNote)
                      : hasEval
                        ? (c.data?.feedback || c.data?.notes || `${c.title} band scores are issued only for a full interview. Your answers were reviewed qualitatively.`)
                        : c.defaultNote}
                </div>
              </div>
            );
          })}
        </div>

        {(state === 'COMPLETED' || state === 'PARTIAL') && (result.overallSummary || result.strengths || result.areasForImprovement) && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
            <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 800 }}>Examiner Summary</h3>
            {result.overallSummary && <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.overallSummary}</p>}
            {result.strengths && <p style={{ fontSize: 14, lineHeight: 1.6 }}><strong>Strengths:</strong> {result.strengths}</p>}
            {result.areasForImprovement && <p style={{ fontSize: 14, lineHeight: 1.6 }}><strong>Focus areas:</strong> {result.areasForImprovement}</p>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1.5px solid #151313', paddingTop: 16 }}>
          <button onClick={handleSaveAndReturn} style={{ padding: '14px 30px', borderRadius: 16, background: '#FF5734', color: '#151313', fontSize: 15, fontWeight: 800, border: '1.5px solid #151313', cursor: 'pointer', boxShadow: '0 4px 0 #151313', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check" size={17} />
            <span>Save & Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────
     4. EXAM — 3-part interview
     ────────────────────────────────────────────────────────── */
  const partDone = isPart2
    ? Boolean(currentRecording)
    : questions.length > 0 && questions.every((_, qI) => Boolean(recordings[`${partIdx}_${qI}`]));

  return (
    <div className="exam-focus-layout" style={{ maxWidth: 1080 }}>
      {/* header */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: '#151313', color: '#fff' }}>{isMockMode ? 'IELTS ACADEMIC SPEAKING' : 'IELTS SPEAKING PRACTICE'}</span>
          <h2 className="exam-focus-title">Part {currentPart?.partNumber} of {test.parts.length} · {currentPart?.title}</h2>
        </div>
        <div className="exam-focus-header-right">
          <div className="exam-focus-timer-pill" title="Recording status">
            <Icon name="mic" size={16} />
            <span>{isPart2 ? (recState === REC_STATE.PREPARING ? `Prep ${FMT(prepSecondsLeft ?? 0)}` : recState === REC_STATE.RECORDING ? FMT(recordSeconds) : 'Part 2') : `Question ${questionIdx + 1} of ${totalQuestionsInPart}`}</span>
          </div>
          <button type="button" className="exam-focus-exit-btn" onClick={() => { if (window.confirm('Exit speaking practice? Your audio for this session will be discarded.')) onBack(); }}>
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* Part selector chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {test.parts.map((p, i) => {
          const done = p.partNumber === 2
            ? Boolean(recordings[`${i}_0`])
            : (p.questions || []).every((_, qI) => Boolean(recordings[`${i}_${qI}`]));
          const active = i === partIdx;
          return (
            <button key={i} type="button" onClick={() => { stopRecording(); setPartIdx(i); setQuestionIdx(0); setRecState(REC_STATE.IDLE); }}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                border: active ? '2px solid #151313' : '1.5px solid #151313',
                background: active ? '#151313' : done ? 'rgba(16,185,129,0.14)' : 'var(--bg-card)',
                color: active ? '#fff' : done ? 'var(--success-icon)' : 'var(--text-primary)',
              }}>
              {done && !active ? '✓ ' : ''}Part {p.partNumber}
            </button>
          );
        })}
      </div>

      {/* ── PART 2: cue card + notes side-by-side + speaking ── */}
      {isPart2 && (
        <>
          <div className="speaking-cue-card-row" style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '26px 30px', boxShadow: '0 3px 0 #151313', flex: '1 1 380px', maxWidth: 560, fontSize: 15.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #151313', paddingBottom: 10, marginBottom: 16, fontFamily: 'var(--font-family)' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--text-secondary)' }}>PART 2</div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em' }}>LONG TURN</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Practice topic · prompts in the IELTS format</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.35, fontFamily: 'var(--font-family)', marginBottom: 16 }}>
                {currentPart?.cueCard?.topic}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6, fontFamily: 'var(--font-family)' }}>You should say:</div>
              <ul style={{ margin: '0 0 14px 0', paddingLeft: 20, fontSize: 15.5, lineHeight: 1.7 }}>
                {(currentPart?.cueCard?.bulletPrompts || []).map((b, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
              <div style={{ fontStyle: 'italic', fontSize: 15.5, fontWeight: 600, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, fontFamily: 'var(--font-family)' }}>
                {currentPart?.cueCard?.finalInstruction}
              </div>
            </div>

            {/* NOTES — visible during preparation AND while speaking */}
            {(recState === REC_STATE.IDLE || recState === REC_STATE.PREPARING || recState === REC_STATE.READY_TO_SPEAK || recState === REC_STATE.RECORDING || recState === REC_STATE.TIME_REACHED) && (
              <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '20px 24px', boxShadow: '0 3px 0 #151313', flex: '1 1 300px', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-secondary)', fontFamily: 'var(--font-family)' }}>
                    {recState === REC_STATE.PREPARING ? 'PREPARE YOUR RESPONSE' : 'YOUR NOTES'}
                  </div>
                  {recState === REC_STATE.PREPARING && (
                    <div style={{ fontFamily: 'Kodchasan, monospace', fontSize: 26, fontWeight: 800 }}>{FMT(prepSecondsLeft ?? 0)}</div>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Make notes while you prepare. These are for you only — they are not sent for evaluation."
                  style={{ minHeight: 200, flex: 1, resize: 'vertical', borderRadius: 12, border: '1.5px solid var(--border)', padding: '12px 14px', fontSize: 14.5, lineHeight: 1.6, background: 'var(--surface-sunken)', color: 'var(--text-primary)' }}
                />
                {recState === REC_STATE.PREPARING && (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={skipPreparation} style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 700, border: '1.5px solid #151313', background: 'var(--bg-card)', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>
                      Skip preparation
                    </button>
                    <button type="button" onClick={() => { clearInterval(prepIntervalRef.current); setRecState(REC_STATE.READY_TO_SPEAK); }} style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 700, border: '1.5px solid #151313', background: 'var(--c-yellow)', cursor: 'pointer', fontFamily: 'var(--font-family)' }}>
                      Ready to speak now
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {recState === REC_STATE.IDLE && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={startPreparation} style={{ padding: '14px 28px', borderRadius: 14, background: 'var(--c-yellow)', border: '1.5px solid #151313', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #151313', fontFamily: 'var(--font-family)' }}>
                Begin 1-minute preparation
              </button>
            </div>
          )}

          {(recState === REC_STATE.READY_TO_SPEAK || recState === REC_STATE.RECORDING || recState === REC_STATE.TIME_REACHED) && (
            <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '26px 30px', boxShadow: '0 3px 0 #151313', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: isRecording ? '#FF5734' : 'var(--text-secondary)' }}>
                {recState === REC_STATE.RECORDING ? '● SPEAK NOW — RECORDING' : recState === REC_STATE.TIME_REACHED ? 'TIME REACHED' : 'READY TO SPEAK'}
              </div>
              <div style={{ fontFamily: 'Kodchasan, monospace', fontSize: 40, fontWeight: 800 }}>
                {isRecording ? `${FMT(Math.max(PART2_SPEAK_SECONDS - recordSeconds, 0))}` : '02:00'}
              </div>
              {recState === REC_STATE.READY_TO_SPEAK && (
                <button type="button" onClick={startRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 999, background: '#FF5734', border: '1.5px solid #151313', color: '#151313', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #151313' }}>
                  <Icon name="mic" size={17} /> Start speaking
                </button>
              )}
              {isRecording && (
                <button type="button" onClick={stopRecording} style={{ padding: '12px 24px', borderRadius: 999, background: '#151313', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', border: '1.5px solid #151313' }}>
                  Stop recording
                </button>
              )}
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Recording stops automatically at 2 minutes. You may stop earlier.
              </div>
              {isRecording && liveTranscript && (
                <div style={{ width: '100%', maxHeight: 110, overflowY: 'auto', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {liveTranscript}…
                </div>
              )}
            </div>
          )}

          {(recState === REC_STATE.SAVED || recState === REC_STATE.TRANSCRIBING || recState === REC_STATE.COMPLETED) && currentRecording && (
            <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '20px 26px', boxShadow: '0 3px 0 #151313', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 700, color: 'var(--success-icon)' }}>
                <Icon name="check" size={16} /> Response saved · {FMT(currentRecording.duration)} recorded
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={replayRecording} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>▶ Replay</button>
                <button type="button" onClick={() => { setRecState(REC_STATE.READY_TO_SPEAK); setRecordings(prev => { const n = { ...prev }; delete n[currentKey]; return n; }); }} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>Re-record</button>
              </div>
              {activePlaybackUrl && <audio src={activePlaybackUrl} controls style={{ width: '100%' }} />}
              {currentRecording.transcript && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>RECEIVED TEXT</div>
                  <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-exam)' }}>
                    {currentRecording.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PART 1 / PART 3: interview questions ── */}
      {!isPart2 && (
        <>
          {questions.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '0 4px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>Select question:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {questions.map((q, idx) => {
                  const isSelected = idx === questionIdx;
                  const hasRec = Boolean(recordings[`${partIdx}_${idx}`]);
                  return (
                    <button key={idx} type="button" onClick={() => { stopRecording(); setQuestionIdx(idx); setActivePlaybackUrl(null); setRecState(REC_STATE.IDLE); }}
                      style={{
                        width: 38, height: 38, borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
                        border: isSelected ? '2px solid #151313' : '1.5px solid #151313',
                        background: isSelected ? '#151313' : hasRec ? 'rgba(16,185,129,0.14)' : 'var(--bg-card)',
                        color: isSelected ? '#fff' : hasRec ? 'var(--success-icon)' : 'var(--text-primary)',
                      }}>
                      {hasRec && !isSelected ? '✓' : idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '30px 36px', boxShadow: '0 3px 0 #151313' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'var(--text-secondary)', marginBottom: 12, fontFamily: 'var(--font-family)' }}>
              PART {currentPart?.partNumber} · {(currentPart?.questionTopics?.[questionIdx] || (currentPart?.partNumber === 1 ? currentPart?.topicSetTopic : 'Discussion') || '').toUpperCase()}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.4, fontFamily: 'var(--font-family)' }}>
              {currentQuestion}
            </div>
            <div className="speaking-provenance-note">Practice question written in the IELTS format</div>
          </div>

          {/* recording control */}
          <div style={{ background: 'var(--bg-card)', border: 'var(--border-dark)', borderRadius: 'var(--r-card)', padding: '24px 30px', boxShadow: '0 3px 0 #151313', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: isRecording ? '#FF5734' : 'var(--text-secondary)' }}>
              {isRecording ? '● RECORDING' : recState === REC_STATE.COMPLETED && currentRecording ? 'RESPONSE SAVED' : 'READY'}
            </div>
            {!isRecording && !currentRecording && (
              <button type="button" onClick={startRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#FF5734', border: '1.5px solid #151313', color: '#151313', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 3px 0 #151313' }}>
                <Icon name="mic" size={16} /> Record answer
              </button>
            )}
            {isRecording && (
              <>
                <div style={{ fontFamily: 'Kodchasan, monospace', fontSize: 28, fontWeight: 800 }}>{FMT(recordSeconds)}</div>
                <button type="button" onClick={stopRecording} style={{ padding: '11px 22px', borderRadius: 999, background: '#151313', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Stop</button>
              </>
            )}
            {isRecording && liveTranscript && (
              <div style={{ width: '100%', maxHeight: 110, overflowY: 'auto', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {liveTranscript}…
              </div>
            )}
            {currentRecording && !isRecording && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {currentRecording.transcript && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>RECEIVED TEXT</div>
                    <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-exam)' }}>
                      {currentRecording.transcript || '(no speech detected)'}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button" onClick={replayRecording} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>▶ Replay</button>
                  <button type="button" onClick={() => startRecording()} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>Re-record</button>
                </div>
                {activePlaybackUrl && <audio src={activePlaybackUrl} controls style={{ width: '100%' }} />}
              </div>
            )}
          </div>
        </>
      )}

      {/* bottom nav: Next advances question → part, Submit Test on the final question */}
      <ExamBottomNav
        onPrevious={partIdx > 0 || questionIdx > 0 ? () => { stopRecording(); if (questionIdx > 0) { setQuestionIdx(q => q - 1); } else { setPartIdx(p => p - 1); setQuestionIdx(0); } setRecState(REC_STATE.IDLE); } : undefined}
        isPreviousDisabled={partIdx === 0 && questionIdx === 0}
        sections={test.parts.map((p, i) => ({
          label: `Part ${p.partNumber}`,
          isCompleted: p.partNumber === 2
            ? Boolean(recordings[`${i}_0`])
            : (p.questions || []).length > 0 && (p.questions || []).every((_, qI) => Boolean(recordings[`${i}_${qI}`])),
        }))}
        activeSectionIndex={partIdx}
        onSelectSection={(i) => { stopRecording(); setPartIdx(i); setQuestionIdx(0); setRecState(REC_STATE.IDLE); }}
        onNext={handleNext}
        isNextDisabled={false}
        nextLabel={isLastInteraction ? 'Submit Test' : 'Next →'}
        isSubmit={isLastInteraction}
      />
    </div>
  );
}
