import React, { useState, useRef, useEffect } from 'react';
import AiWaitNote from '../common/AiWaitNote';
import SpeechModelStatus from '../speaking/SpeechModelStatus';
import { needsLocalStt, prepareLocalStt, transcribeRecording, subscribeLocalStt, unloadLocalStt } from '../../utils/speech/localStt';
import { motion } from 'motion/react';
import { Icon } from '../common/Icon';
import { getRandomizedSpeakingTest, getSpeakingTest } from '../../data/speaking/index';
import ExamStartScreen from './ExamStartScreen';
import ResultAnalysis from '../common/ResultAnalysis.jsx';
import { ResultPage, ResultItem } from '../common/ResultReveal.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';
import CriterionFeedbackCard from '../common/CriterionFeedbackCard.jsx';
import ExamBottomNav from './ExamBottomNav';
import { evaluateSpeakingResponses } from '../../utils/evaluation/evaluationEngine';
import { detectSupportedAudioMimeType, saveAudioRecording, getAudioRecording, createAudioBlob, eradicateAllAudioRecordings } from '../../utils/audio/audioStore';
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

/** Transcription progress for one saved answer (on-device model). */
function TranscriptState({ rec, onRetry }) {
  if (!rec) return null;
  if (rec.transcriptStatus === 'pending') {
    return (
      <div className="speaking-transcribing" role="status">
        <span className="stt-dot" aria-hidden="true" />
        {rec.transcript
          ? 'Quick preview shown — Whisper is refining it into the final transcript…'
          : 'Transcribing on this device…'}
      </div>
    );
  }
  if (rec.transcriptStatus === 'failed') {
    return (
      <div className="speaking-transcribing" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>Transcription failed for this answer. Your audio is saved.</span>
        {onRetry && (
          <button type="button" onClick={onRetry} style={{ padding: '4px 10px', borderRadius: 8, border: '1.5px solid #151313', background: 'var(--c-yellow, #fccc42)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            Retry transcription
          </button>
        )}
      </div>
    );
  }
  if (rec.transcriptStatus === 'done' && !rec.transcript) {
    return <div className="speaking-transcribing" role="status">No audible speech recognized in this answer.</div>;
  }
  return null;
}

export default function SpeakingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false, onOpenLesson, onOpenTips, onSave }) {
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

  // Practice results are saved the moment they exist, so leaving via Back,
  // refreshing or closing never loses them.
  useEffect(() => {
    if (phase !== 'results' || !result || isMockMode) return;
    const completed = result.evaluationState === 'COMPLETED' && typeof result.overallSpeakingBand === 'number';
    onSave?.({
      attemptId: result.attemptId,
      testId: test?.testId || testId,
      testLabel: test?.title || 'IELTS Speaking Practice',
      status: completed ? 'completed' : 'partial',
      band: completed ? result.overallSpeakingBand : null,
      overallBand: completed ? result.overallSpeakingBand : null,
      evaluationState: result.evaluationState,
      evaluationStatus: result.status || 'failed',
      provisional: Boolean(result.provisional),
      scoringMethod: result.scoringMethod || '',
      criteria: result.criteria || null,
      overallSummary: result.overallSummary || '',
      priorityWeaknesses: result.priorityWeaknesses || [],
      strengths: result.strengths || '',
      areasForImprovement: result.areasForImprovement || '',
      partFeedback: result.partFeedback || {},
      recordedCount: result.recordedCount || 0,
      transcripts: result.transcripts || {},
      sttEngine: result.sttEngine || '',
      sttModelVersion: result.sttModelVersion || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, isMockMode]);

  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');
  const recordSecondsRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const prepIntervalRef = useRef(null);
  const speakIntervalRef = useRef(null);
  const notesRef = useRef('');
  notesRef.current = notes;
  // On-device transcription (default in every browser): one job per recording,
  // keyed by question; a re-recording supersedes an older job.
  const useLocalStt = React.useMemo(() => needsLocalStt(), []);
  const transcriptJobsRef = useRef({});   // qKey → { recordingId, promise }
  const transcriptsRef = useRef({});      // qKey → { recordingId, text }

  const [sttStatus, setSttStatus] = useState(useLocalStt ? 'idle' : 'ready');
  useEffect(() => {
    if (!useLocalStt) return undefined;
    const unsub = subscribeLocalStt(st => setSttStatus(st.status));
    prepareLocalStt().catch(() => { /* status component reports it */ });
    return unsub;
  }, [useLocalStt]);
  // recording only starts once the on-device model can transcribe it
  const recordLocked = useLocalStt && sttStatus !== 'ready';

  const recordingsRef = useRef(recordings);
  recordingsRef.current = recordings;

  /** Transcribes one saved answer on the device (also used to retry). */
  const runTranscription = (qId, recordingId, blob, fallbackText = '') => {
    setRecState(REC_STATE.TRANSCRIBING);
    setRecordings(prev => (prev[qId]?.recordingId === recordingId
      ? { ...prev, [qId]: { ...prev[qId], transcriptStatus: 'pending' } } : prev));
    const promise = transcribeRecording(blob).then((res) => {
      if (transcriptJobsRef.current[qId]?.recordingId !== recordingId) return; // superseded
      const text = typeof res === 'string' ? res : (res?.text || '');
      const words = res?.words || [];
      const engine = res?.engine || 'whisper-small.en';
      const version = res?.version || 'small.en';
      const finalText = text.trim() || (typeof fallbackText === 'string' ? fallbackText.trim() : '') || (liveTranscriptRef.current || '').trim();
      transcriptsRef.current[qId] = { recordingId, text: finalText, words, engine, version };
      setRecordings(prev => (prev[qId]?.recordingId === recordingId
        ? {
            ...prev,
            [qId]: {
              ...prev[qId],
              transcript: finalText,
              words,
              sttEngine: text.trim() ? engine : (finalText ? 'native_fallback' : engine),
              sttModelVersion: version,
              transcriptStatus: 'done'
            }
          }
        : prev));
      setRecState(REC_STATE.COMPLETED);
    }).catch((err) => {
      console.error('Transcription error on device:', err);
      if (transcriptJobsRef.current[qId]?.recordingId !== recordingId) return;
      const finalText = (typeof fallbackText === 'string' ? fallbackText.trim() : '') || (liveTranscriptRef.current || '').trim();
      if (finalText) {
        transcriptsRef.current[qId] = { recordingId, text: finalText, words: [], engine: 'native_fallback', version: 'browser' };
        setRecordings(prev => (prev[qId]?.recordingId === recordingId
          ? {
              ...prev,
              [qId]: {
                ...prev[qId],
                transcript: finalText,
                words: [],
                sttEngine: 'native_fallback',
                sttModelVersion: 'browser',
                transcriptStatus: 'done'
              }
            }
          : prev));
        setRecState(REC_STATE.COMPLETED);
      } else {
        setRecordings(prev => (prev[qId]?.recordingId === recordingId
          ? { ...prev, [qId]: { ...prev[qId], transcriptStatus: 'failed' } } : prev));
        setRecState(REC_STATE.COMPLETED);
      }
    });
    transcriptJobsRef.current[qId] = { recordingId, promise };
    return promise;
  };

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
      Object.values(recordingsRef.current).forEach(rec => {
        if (rec?.url) URL.revokeObjectURL(rec.url);
      });
      // Leaving the test (exit, back, navigation) must not leave the
      // candidate's voice recordings behind in IndexedDB.
      eradicateAllAudioRecordings();
    };
  }, []);

  /* ── Part 2: preparation → speaking, official timings ── */
  const startPreparation = () => {
    if (recordLocked) return;
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
    if (recordLocked) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeType = detectSupportedAudioMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      // native recognition runs simultaneously for live display and instant fallback
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
        const blob = createAudioBlob(chunks, mimeType);
        const url = URL.createObjectURL(blob);
        const fallbackText = liveTranscriptRef.current || '';
        const dur = recordSecondsRef.current || 0;
        const qId = currentKey;
        const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        saveAudioRecording({ recordingId, attemptId: 'temp_attempt', questionId: qId, blob, mimeType, duration: dur })
          .catch(() => {});
        if (!useLocalStt) transcriptsRef.current[qId] = { recordingId, text: fallbackText };
        setRecordings(prev => ({
          ...prev,
          [qId]: {
            recordingId, blob, url, duration: dur, transcript: fallbackText,
            transcriptStatus: useLocalStt ? 'pending' : 'done',
            qText: isPart2 ? currentPart?.cueCard?.topic : currentQuestion,
            // notes are planning material — stored with the response, never evaluated
            notes: isPart2 ? notesRef.current : undefined,
          }
        }));
        setActivePlaybackUrl(url);
        setRecState(REC_STATE.TRANSCRIBING);
        if (useLocalStt) {
          runTranscription(qId, recordingId, blob, fallbackText);
        } else {
          setRecState(REC_STATE.COMPLETED);
        }
        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (_) {} recognitionRef.current = null; }
        stream.getTracks().forEach(t => t.stop());
      };

      if (mimeType && mimeType.includes('mp4')) {
        mr.start(); // In Safari, audio/mp4 timeslices produce fragmented fMP4 chunks that fail audio decode & playback
      } else {
        mr.start(250);
      }
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
    } else if (useLocalStt) {
      setPhase('review');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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

    // every answer's on-device transcript must be finished before scoring
    await Promise.allSettled(Object.values(transcriptJobsRef.current).map(j => j.promise));
    if (useLocalStt) unloadLocalStt(); // free memory; the model stays cached for next time
    const transcripts = {};
    const durations = {};
    const audioRecordings = {};
    Object.entries(recordings).forEach(([k, rec]) => {
      const t = transcriptsRef.current[k];
      transcripts[k] = (t && t.recordingId === rec.recordingId ? t.text : rec.transcript) || '';
      durations[k] = rec.duration || 30;
      audioRecordings[k] = rec.blob || null;
    });

    const activeEngine = Object.values(transcriptsRef.current)[0]?.engine || 'whisper-small.en';
    const activeVersion = Object.values(transcriptsRef.current)[0]?.version || 'small.en';

    // Full mock: the combined report evaluates all four skills together, so the
    // Speaking module hands over its answers instead of showing its own results
    if (isMockMode) {
      // Eradicate audio from IndexedDB and release object URLs to eliminate cache/storage footprint
      eradicateAllAudioRecordings();
      Object.values(recordings).forEach(rec => {
        if (rec?.url) URL.revokeObjectURL(rec.url);
      });
      if (activePlaybackUrl) {
        URL.revokeObjectURL(activePlaybackUrl);
        setActivePlaybackUrl(null);
      }
      if (onComplete) onComplete({
        transcripts,
        recordings,
        durations,
        sttEngine: activeEngine,
        sttModelVersion: activeVersion,
        recordedCount: Object.keys(recordings).length
      });
      return;
    }

    const expectedQuestions = (test?.parts || []).reduce((n, p) => n + (p.questions?.length || 0), 0);
    const cueCardTopic = test?.parts?.[1]?.cueCard?.topic;
    const cueCardBullets = (test?.parts?.[1]?.cueCard?.bulletPrompts || []).join(', ');
    const cueCardStr = cueCardTopic ? `${cueCardTopic}${cueCardBullets ? ` (Prompts: ${cueCardBullets})` : ''}` : undefined;


    const evalResult = await evaluateSpeakingResponses({
      transcripts,
      testMeta: {
        title: test?.title || 'IELTS Speaking Practice',
        cueCard: cueCardStr,
      },
      audioRecordings,
      durations,
      attemptId: createAttemptId('speaking'),
      expectedQuestions,
    });

    // Eradicate audio from IndexedDB and release object URLs to eliminate cache/storage footprint
    eradicateAllAudioRecordings();
    Object.values(recordings).forEach(rec => {
      if (rec?.url) URL.revokeObjectURL(rec.url);
    });
    if (activePlaybackUrl) {
      URL.revokeObjectURL(activePlaybackUrl);
      setActivePlaybackUrl(null);
    }

    // Strip heavy binary blobs from memory state
    const strippedRecordings = {};
    Object.entries(recordings).forEach(([k, rec]) => {
      strippedRecordings[k] = { ...rec, blob: null, url: null };
    });
    setRecordings(strippedRecordings);

    setTimeout(() => {
      setEvalStages(s => ({ ...s, fluency: 'done', lexical: 'done', grammar: 'done' }));
      setResult({
        band: evalResult.overallSpeakingBand,
        recordings: strippedRecordings,
        transcripts,
        sttEngine: activeEngine,
        sttModelVersion: activeVersion,
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
        notice={<SpeechModelStatus variant="card" />}
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
        <ScrollToTop />
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
          giving the final answers to AI to get a final report.
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
      { id: 'fluency', key: 'fluencyAndCoherence', title: 'Fluency & Coherence', data: result?.criteria?.fluencyAndCoherence, defaultNote: 'Speech continuity, idea development, pacing, and linking phrases.' },
      { id: 'lexical', key: 'lexicalResource', title: 'Lexical Resource', data: result?.criteria?.lexicalResource, defaultNote: 'Topic vocabulary range, natural phrasing, precision, and collocation.' },
      { id: 'grammar', key: 'grammaticalRangeAndAccuracy', title: 'Grammatical Range & Accuracy', data: result?.criteria?.grammaticalRangeAndAccuracy, defaultNote: 'Syntactic variety, complex sentence control, clause structures, and grammatical precision.' },
      { id: 'pronunciation', key: 'pronunciation', title: 'Pronunciation', data: result?.criteria?.pronunciation, defaultNote: 'Phonological control: intelligibility, word stress, rhythm, and intonational variation.' },
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
          overallBand: isFull ? result.overallSpeakingBand : null,
          evaluationState: state,
          evaluationStatus: result?.status || 'failed',
          provisional: Boolean(result?.provisional),
          scoringMethod: result?.scoringMethod || '',
          criteria: result?.criteria || null,
          overallSummary: result?.overallSummary || '',
          priorityWeaknesses: result?.priorityWeaknesses || [],
          strengths: result?.strengths || '',
          areasForImprovement: result?.areasForImprovement || '',
          partFeedback: result?.partFeedback || {},
          recordedCount: Object.keys(recordings).length,
          recordings,
          transcripts: result?.transcripts || {},
          sttEngine: result?.sttEngine || 'whisper-small.en',
          sttModelVersion: result?.sttModelVersion || 'small.en',
        }
      };
      if (onComplete) onComplete(canonicalAttempt.speaking);
    };

    const priorityItems = Array.isArray(result?.priorityWeaknesses) && result.priorityWeaknesses.length > 0
      ? result.priorityWeaknesses
      : (result?.areasForImprovement ? [result.areasForImprovement] : []);

    const isProvisional = isFull && Boolean(result.provisional || result.criteria?.pronunciation?.band === null);
    const evaluatorPill = result?.modelUsed ? (
      <span className="result-meta-pill">
        Evaluator: {result.providerUsed === 'groq' ? 'Groq' : 'Gemini'} ({result.modelUsed})
        {result.evaluationTier === 'client_local_key' ? ' · Local API Key' : ''}
      </span>
    ) : null;

    return (
      <ResultPage skill="speaking" className="exam-results-screen">
        <ResultItem as="button" type="button" className="result-back-btn" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Back to Dashboard
        </ResultItem>

        {/* 1. OVERALL ESTIMATE & LIMITATIONS HERO CARD */}
        {isFull ? (
          <ResultItem className="result-hero">
            <div>
              <span className={`result-eyebrow${isProvisional ? ' is-warning' : ''}`}>
                {isProvisional ? 'PROVISIONAL SPEAKING ESTIMATE (TRANSCRIPT-ONLY)' : 'FULL SPEAKING ASSESSMENT (4 CRITERIA)'}
              </span>
              <h1 className="result-title">Speaking Assessment</h1>
              <p className="result-lead">
                {isProvisional
                  ? 'Official IELTS Speaking requires all four criteria including Pronunciation assessed from live audio. Because pronunciation cannot be assessed from transcripts alone, this score is a provisional 3-criterion estimate (FC, LR, GRA), not an official 4-criterion IELTS Speaking band.'
                  : 'Assessed across all four criteria: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation.'}
              </p>
              {evaluatorPill}
            </div>
            <div className="result-band-box">
              <div className="result-band-label">
                {isProvisional ? 'Provisional band' : 'Overall band'}
              </div>
              <div className={`result-band-value${typeof result.overallSpeakingBand === 'number' ? '' : ' is-empty'}`}>
                {typeof result.overallSpeakingBand === 'number' ? result.overallSpeakingBand.toFixed(1) : '—'}
              </div>
              <div className="result-band-sub">
                {isProvisional ? '3 of 4 criteria' : 'Overall Speaking Band'}
              </div>
            </div>
          </ResultItem>
        ) : (
          <ResultItem className="result-hero is-stacked">
            <div>
              <span className="result-eyebrow is-warning">PARTIAL SPEAKING ASSESSMENT</span>
              <h1 className="result-title">
                {state === 'NOT_CONFIGURED' && 'AI evaluation is unavailable'}
                {state === 'NOT_ASSESSED' && 'Not enough speech was recorded'}
                {state === 'FAILED' && 'Evaluation could not be completed'}
                {isPartial && 'Response-level feedback — not a band score'}
              </h1>
              {result?.coverage?.statement && (
                <p className="result-text" style={{ fontWeight: 700, marginBottom: 8 }}>{result.coverage.statement}</p>
              )}
              <p className="result-lead">
                {state === 'NOT_CONFIGURED' && (result?.message || 'Add an API key in Settings to receive criterion-level feedback.')}
                {state === 'NOT_ASSESSED' && (result?.message || 'Record at least one full answer to receive feedback.')}
                {state === 'FAILED' && (result?.message || 'You can retry the evaluation.')}
                {isPartial && 'A full IELTS Speaking band requires all three parts of the interview. Band scores are withheld; the feedback below covers only what you said.'}
              </p>
              {evaluatorPill}
              {state === 'NOT_CONFIGURED' && (
                <p className="result-text is-muted" style={{ marginTop: 12 }}>
                  Your recordings are kept on this page. Add your Gemini or Groq key in Settings (profile menu), then press Retry evaluation.
                </p>
              )}
              {(state === 'FAILED' || state === 'NOT_CONFIGURED') && (
                <button type="button" onClick={handleFinish} className="result-btn is-yellow is-small" style={{ marginTop: 16 }}>
                  <Icon name="refresh" size={15} />
                  <span>Retry evaluation</span>
                </button>
              )}
            </div>
          </ResultItem>
        )}

        {/* 2. HIGHEST-PRIORITY WEAKNESSES & EXAMINER COACHING SUMMARY */}
        {(state === 'COMPLETED' || state === 'PARTIAL') && (result.overallSummary || priorityItems.length > 0 || result.strengths) && (
          <ResultItem as="section" className="result-card">
            <div className="result-card-head">
              <h3 className="result-card-title"><span aria-hidden="true">📋</span> Coaching Overview & Key Priorities</h3>
            </div>

            {result.overallSummary && (
              <p className="result-text" style={{ marginBottom: 18 }}>{result.overallSummary}</p>
            )}

            {/* Concise summary of candidate's 2-3 highest-priority weaknesses */}
            {priorityItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="result-label is-accent">Top Priority Improvements for Next Band</div>
                <ol className="result-list">
                  {priorityItems.map((item, idx) => (
                    <li key={idx} className="result-list-item">
                      <span className="result-list-num">{idx + 1}.</span>
                      <span className="result-list-body">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {result.strengths && (
              <p className="result-text is-muted">
                <strong style={{ color: 'var(--success-icon)' }}>Demonstrated Strengths:</strong> {result.strengths}
              </p>
            )}
          </ResultItem>
        )}

        {!isMockMode && (
          <ResultItem>
            <ResultAnalysis skill="speaking" resultRecord={{ speaking: result?.canonical || result }} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} />
          </ResultItem>
        )}

        {/* 3. SEPARATE SECTION FOR EVERY ASSESSABLE CRITERION */}
        <ResultItem as="section">
          <div className="result-section-head">
            <h2 className="result-section-title">Assessment Criteria & Coaching Feedback</h2>
            <p className="result-section-sub">
              Detailed evaluation grounded in your actual responses against official IELTS Band Descriptors.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {criteriaList.map(c => {
              const isPron = c.id === 'pronunciation';
              const hasEval = state === 'COMPLETED' || state === 'PARTIAL';
              const assessmentText = c.data?.personalizedAssessment || c.data?.rationale || c.data?.feedback || c.data?.notes;
              const adviceText = c.data?.nextBandAdvice || c.data?.improvementFocus;
              const corrections = Array.isArray(c.data?.corrections) ? c.data.corrections : [];
              return (
                <CriterionFeedbackCard
                  key={c.id}
                  title={c.title}
                  subtitle={c.defaultNote}
                  band={c.data?.band}
                  bandFallback={isPron ? 'Not Assessed (Audio Required)' : hasEval ? 'Not Scored' : 'Unavailable'}
                  assessment={isPron
                    ? (c.data?.reason || c.data?.personalizedAssessment || 'Pronunciation requires acoustic audio recordings (evaluating intelligibility, individual sounds, word stress, connected speech, rhythm, and intonation) and cannot be assessed from transcripts. To preserve scoring integrity, no synthetic score is awarded.')
                    : assessmentText
                      ? assessmentText
                      : hasEval
                        ? `${c.title} band scores are issued for a full interview. Your answers were reviewed qualitatively against the descriptors.`
                        : c.defaultNote}
                  corrections={corrections}
                  advice={adviceText}
                />
              );
            })}
          </div>
        </ResultItem>

        <ResultItem className="result-actions">
          <button type="button" onClick={handleSaveAndReturn} className="result-btn is-primary">
            <Icon name="check" size={18} />
            <span>Save & Return to Dashboard</span>
          </button>
        </ResultItem>
      </ResultPage>
    );
  }

  /* ──────────────────────────────────────────────────────────
     4. EXAM — 3-part interview
     ────────────────────────────────────────────────────────── */
  const partDone = isPart2
    ? Boolean(currentRecording)
    : questions.length > 0 && questions.every((_, qI) => Boolean(recordings[`${partIdx}_${qI}`]));

  /* ──────────────────────────────────────────────────────────
     REVIEW — every recorded answer transcribed before submitting
     ────────────────────────────────────────────────────────── */
  if (phase === 'review') {
    const items = test.parts.flatMap((p, pi) => (p.questions || []).map((q, qi) => {
      const key = `${pi}_${qi}`;
      return { key, part: p.partNumber, label: p.partNumber === 2 ? (p.cueCard?.topic || q) : q, rec: recordings[key] };
    }));
    const recorded = items.filter(i => i.rec);
    const pendingCount = recorded.filter(i => i.rec.transcriptStatus === 'pending').length;
    const failedCount = recorded.filter(i => i.rec.transcriptStatus === 'failed').length;
    const canSubmit = recorded.length > 0 && pendingCount === 0 && failedCount === 0;
    return (
      <div className="speaking-review">
        <p className="rd-eyebrow">Before you submit</p>
        <h1 className="speaking-review-title">Check your answers</h1>
        <p className="speaking-review-sub">
          Each recorded answer has been turned into text on this device. This text is what the examiner scores.
          {pendingCount > 0 && ` Transcribing ${pendingCount} answer${pendingCount > 1 ? 's' : ''}…`}
        </p>
        <ol className="speaking-review-list">
          {items.map((i, idx) => (
            <li key={i.key} className={`speaking-review-item${i.rec ? '' : ' is-empty'}`}>
              <div className="speaking-review-q"><span className="rd-badge">{idx + 1}</span><span>Part {i.part} · {i.label}</span></div>
              {!i.rec && <p className="speaking-review-note">Not answered</p>}
              {i.rec?.transcriptStatus === 'pending' && <p className="speaking-transcribing"><span className="stt-dot" aria-hidden="true" />Transcribing on this device…</p>}
              {i.rec?.transcriptStatus === 'failed' && (
                <p className="speaking-review-note">
                  Transcription failed.{' '}
                  <button type="button" className="speaking-review-retry" onClick={() => runTranscription(i.key, i.rec.recordingId, i.rec.blob)}>Retry</button>
                </p>
              )}
              {i.rec?.transcriptStatus === 'done' && (
                <p className="speaking-review-text">{i.rec.transcript || 'No speech was detected in this answer.'}</p>
              )}
            </li>
          ))}
        </ol>
        <div className="speaking-review-actions">
          <button type="button" className="speaking-review-back" onClick={() => setPhase('exam')}>Back to questions</button>
          <button type="button" className="speaking-review-submit" disabled={!canSubmit} onClick={handleFinish}>
            {pendingCount > 0 ? 'Waiting for transcripts…' : failedCount > 0 ? 'Retry failed transcripts first' : 'Submit for scoring'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-focus-layout" style={{ maxWidth: 1080 }}>
      <ScrollToTop />
      {/* header */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: '#151313', color: '#fff' }}>{isMockMode ? 'IELTS ACADEMIC SPEAKING' : 'IELTS SPEAKING PRACTICE'}</span>
          <h2 className="exam-focus-title">Part {currentPart?.partNumber} of {test.parts.length} · {currentPart?.title}</h2>
        </div>
        <div className="exam-focus-header-right speaking-header-bar">
          <div className="exam-focus-timer-pill" title="Recording status">
            <Icon name="mic" size={16} />
            <span>{isPart2 ? (recState === REC_STATE.PREPARING ? `Prep ${FMT(prepSecondsLeft ?? 0)}` : recState === REC_STATE.RECORDING ? FMT(recordSeconds) : 'Part 2') : `Question ${questionIdx + 1} of ${totalQuestionsInPart}`}</span>
          </div>
          <SpeechModelStatus variant="pill" />
          <button type="button" className="exam-focus-exit-btn" onClick={() => { if (window.confirm('Exit speaking practice? Your audio for this session will be discarded.')) onBack(); }}>
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {recordLocked && (
        <div className="speaking-record-lock" role="status">
          Recording unlocks as soon as speech recognition is ready — your answers are transcribed on this device.
        </div>
      )}

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
              <button type="button" disabled={recordLocked} aria-disabled={recordLocked} onClick={startPreparation} style={{ opacity: recordLocked ? 0.5 : 1,  padding: '14px 28px', borderRadius: 14, background: 'var(--c-yellow)', border: '1.5px solid #151313', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #151313', fontFamily: 'var(--font-family)' }}>
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
                <button type="button" disabled={recordLocked} aria-disabled={recordLocked} onClick={startRecording} style={{ opacity: recordLocked ? 0.5 : 1,  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 999, background: '#FF5734', border: '1.5px solid #151313', color: '#151313', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #151313' }}>
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
                <button type="button" onClick={() => {
                  if (currentRecording?.url) {
                    try { URL.revokeObjectURL(currentRecording.url); } catch (_) {}
                  }
                  setActivePlaybackUrl(null);
                  setRecState(REC_STATE.READY_TO_SPEAK);
                  setRecordings(prev => { const n = { ...prev }; delete n[currentKey]; return n; });
                }} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>Re-record</button>
              </div>
              {activePlaybackUrl && <audio src={activePlaybackUrl} controls style={{ width: '100%' }} />}
              <TranscriptState rec={currentRecording} onRetry={() => runTranscription(currentKey, currentRecording.recordingId, currentRecording.blob, liveTranscriptRef.current)} />
              {currentRecording.transcript && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {currentRecording.transcriptStatus === 'pending' ? 'QUICK PREVIEW (BEING REFINED)' : 'YOUR TRANSCRIPT'}
                  </div>
                  <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-exam)', ...(currentRecording.transcriptStatus === 'pending' ? { opacity: 0.6, fontStyle: 'italic' } : {}) }}>
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
              <button type="button" disabled={recordLocked} aria-disabled={recordLocked} onClick={startRecording} style={{ opacity: recordLocked ? 0.5 : 1,  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, background: '#FF5734', border: '1.5px solid #151313', color: '#151313', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', boxShadow: '0 3px 0 #151313' }}>
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
                <TranscriptState rec={currentRecording} onRetry={() => runTranscription(currentKey, currentRecording.recordingId, currentRecording.blob, liveTranscriptRef.current)} />
                {currentRecording.transcript && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {currentRecording.transcriptStatus === 'pending' ? 'QUICK PREVIEW (BEING REFINED)' : 'YOUR TRANSCRIPT'}
                    </div>
                    <div style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 14, lineHeight: 1.55, fontFamily: 'var(--font-exam)', ...(currentRecording.transcriptStatus === 'pending' ? { opacity: 0.6, fontStyle: 'italic' } : {}) }}>
                      {currentRecording.transcript || '(no speech detected)'}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button type="button" onClick={replayRecording} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>▶ Replay</button>
                  <button type="button" disabled={recordLocked} onClick={() => {
                    if (currentRecording?.url) {
                      try { URL.revokeObjectURL(currentRecording.url); } catch (_) {}
                    }
                    setActivePlaybackUrl(null);
                    setRecordings(prev => { const n = { ...prev }; delete n[currentKey]; return n; });
                    startRecording();
                  }} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #151313', background: 'var(--bg-card)', fontWeight: 700, cursor: 'pointer' }}>Re-record</button>
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
        nextLabel={isLastInteraction ? 'Submit Test' : 'Next'}
        isSubmit={isLastInteraction}
      />
    </div>
  );
}
