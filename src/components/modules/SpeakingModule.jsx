import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Icon } from '../common/Icon';
import { getRandomizedSpeakingTest, getSpeakingTest } from '../../data/speaking/index';
import ExamStartScreen from './ExamStartScreen';
import ExamBottomNav from './ExamBottomNav';
import HtmlContentRenderer from '../common/HtmlContentRenderer';
import { evaluateSpeakingResponses } from '../../utils/evaluation/evaluationEngine';
import { detectSupportedAudioMimeType, saveAudioRecording, getAudioRecording, createAudioBlob } from '../../utils/audio/audioStore';
import { getApiKey, createAttemptId, getTargetBand } from '../../utils/storage';

const FMT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function SpeakingModule({ onComplete, onBack, initialTest, testId, initialPhase = 'intro', isMockMode = false }) {
  const [test] = useState(() => initialTest || (testId ? getSpeakingTest(testId) : getRandomizedSpeakingTest()));
  const [phase, setPhase] = useState(() => initialPhase); // intro | exam | processing | results
  const [partIdx, setPartIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordings, setRecordings] = useState({}); // key: `${partIdx}_${qIdx}` -> { blob, url, duration, transcript }
  const [activePlaybackUrl, setActivePlaybackUrl] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');

  const getTargetSeconds = (p) => {
    return 840; // 14 minutes for full test
  };
  const targetSeconds = getTargetSeconds(partIdx);

  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');
  const recordSecondsRef = useRef(0);

  // Cue card prep timer (Part 2)
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(null);

  // Processing screen state
  const [processingStep, setProcessingStep] = useState(0);

  // Final evaluated result
  const [result, setResult] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const prepIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(recordIntervalRef.current);
      clearInterval(prepIntervalRef.current);
      // Revoke any active object URLs on unmount to prevent memory leaks
      Object.values(recordings).forEach(rec => {
        if (rec && rec.url) URL.revokeObjectURL(rec.url);
      });
    };
  }, [recordings]);

  const currentPart = test.parts[partIdx];
  const isCueCardPart = currentPart?.partNumber === 2;
  const totalQuestionsInPart = currentPart?.questions?.length || 1;
  const currentKey = `${partIdx}_${questionIdx}`;
  const currentRecording = recordings[currentKey];

  // Current question data
  const currentQuestion = currentPart?.questions?.[questionIdx];

  const handleStartExam = () => {
    setPhase('exam');
    setPartIdx(0);
    setQuestionIdx(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mimeType = detectSupportedAudioMimeType();
      const mr = new MediaRecorder(stream, { mimeType });
      setLiveTranscript('');
      liveTranscriptRef.current = '';

      // Live Speech-to-Text transcription via browser API
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
            for (let i = 0; i < e.results.length; i++) {
              full += e.results[i][0].transcript + ' ';
            }
            const clean = full.trim();
            setLiveTranscript(clean);
            liveTranscriptRef.current = clean;
          };
          rec.onerror = () => {};
          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.warn('SpeechRecognition initialization error', e);
        }
      }

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mr.onstop = () => {
        const mimeType = detectSupportedAudioMimeType();
        const blob = createAudioBlob(chunks, mimeType);
        const url = URL.createObjectURL(blob);
        const transcriptText = liveTranscriptRef.current || '';
        const dur = recordSecondsRef.current || 30;
        
        const qId = currentKey;
        const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        saveAudioRecording({
          recordingId,
          attemptId: 'temp_attempt',
          questionId: qId,
          blob,
          mimeType,
          duration: dur
        }).catch(e => console.warn('Failed to save to IndexedDB', e));

        setRecordings(prev => {
          if (prev[qId] && prev[qId].url) {
            URL.revokeObjectURL(prev[qId].url);
          }
          return {
            ...prev,
            [qId]: {
              recordingId,
              blob,
              duration: dur,
              transcript: transcriptText,
              qText: currentQuestion || (currentPart?.questions ? currentPart.questions.join(' ') : 'Speaking prompt')
            }
          };
        });
        setActivePlaybackUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      setActivePlaybackUrl(null);

      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds(s => {
          const next = s + 1;
          recordSecondsRef.current = next;

          // Target reached with 5-second grace period: at +5s automatically stop recording!
          if (next >= targetSeconds + 5) {
            setTimeout(() => {
              stopRecording();
            }, 30);
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      alert('Microphone access is required for IELTS Speaking practice. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    clearInterval(recordIntervalRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const startPrepTimer = (duration = 60) => {
    setPrepSecondsLeft(duration);
    prepIntervalRef.current = setInterval(() => {
      setPrepSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleNext = () => {
    stopRecording();
    setActivePlaybackUrl(null);
    handleFinish();
  };

  const handlePrevious = () => {
    stopRecording();
    setActivePlaybackUrl(null);
  };

  const handleFinish = async () => {
    stopRecording();
    const transcripts = {};
    const durations = {};
    Object.entries(recordings).forEach(([k, rec]) => {
      transcripts[k] = rec.transcript || '';
      durations[k] = rec.duration || 30;
    });

    if (isMockMode) {
      // In Full Mock Mode: evaluate responses and pass directly to MockExamFlow
      const evalResult = await evaluateSpeakingResponses({
        transcripts,
        testMeta: { title: test?.title || 'IELTS Academic Speaking Test' },
        durations
      });
      const computedResult = {
        band: evalResult.overallSpeakingBand,
        recordings,
        transcripts,
        ...evalResult
      };
      if (onComplete) onComplete(computedResult);
      return;
    }

    setPhase('processing');
    setTimeout(() => setProcessingStep(1), 700);
    setTimeout(() => setProcessingStep(2), 1400);
    setTimeout(() => setProcessingStep(3), 2100);

    const evalResult = await evaluateSpeakingResponses({
      transcripts,
      testMeta: { title: test?.title || 'IELTS Academic Speaking Test' },
      durations
    });

    setTimeout(() => {
      setResult({
        band: evalResult.overallBand,
        recordings,
        transcripts,
        recordedCount: Object.keys(recordings).length,
        totalParts: test.parts.length,
        ...evalResult
      });
      setPhase('results');
    }, 2800);
  };

  /* ──────────────────────────────────────────────────────────
     1. INTRO VIEW
     ────────────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <ExamStartScreen
        section="Speaking"
        sectionKey="speaking"
        testTitle={test?.title || 'IELTS Speaking Practice'}
        subtitle="Simulate an authentic face-to-face IELTS interview with simulated examiner prompts, cue card preparation, and speech evaluation."
        metaItems={[
          { label: '3 Parts', sub: 'Interview, Cue Card, Discussion' },
          { label: '14 Minutes', sub: 'Strict timed sequence' },
          { label: 'Band 0–9', sub: 'Official-style scoring' },
        ]}
        rules={[
          'Ensure your microphone is connected and authorized in your browser before starting.',
          'Part 1: Short conversational responses on familiar everyday topics.',
          'Part 2: 1 minute of note preparation followed by a 2-minute sustained monologue.',
          'Part 3: In-depth abstract discussion on broader societal and global themes.',
        ]}
        scoringInfo="Assessed across Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation according to official IELTS band descriptors."
        ctaText="START SPEAKING TEST"
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
            Evaluating official IELTS assessment criteria across your recordings.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
            {[
              { label: 'Fluency & Coherence', active: processingStep >= 0 },
              { label: 'Lexical Resource & Vocabulary', active: processingStep >= 1 },
              { label: 'Grammatical Range & Accuracy', active: processingStep >= 2 },
              { label: 'Pronunciation & Intonation Flow', active: processingStep >= 3 },
            ].map((step, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                fontWeight: 600,
                color: step.active ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color 0.3s ease'
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
     3. RESULTS SCREEN (Cognition Unified Design Language)
     ────────────────────────────────────────────────────────── */
  if (phase === 'results') {
    const isCompleted = result?.status === 'completed' && typeof result?.overallSpeakingBand === 'number';
    const isPartial = result?.status === 'partial';
    const isFailed = result?.status === 'not_attempted' || result?.status === 'failed' || (!isCompleted && !isPartial);

    const handleSaveAndReturn = () => {
      // Create canonical attempt payload
      const attemptId = createAttemptId('speaking');
      const canonicalAttempt = {
        id: attemptId,
        type: 'speaking',
        testId: test?.testId || testId || 'speaking-practice',
        testLabel: test?.title || 'IELTS Speaking Practice',
        startedAt: new Date(Date.now() - 900000).toISOString(),
        completedAt: new Date().toISOString(),
        status: 'completed',
        overallBand: isCompleted ? result.overallSpeakingBand : null,
        speaking: {
          band: isCompleted ? result.overallSpeakingBand : null,
          evaluationStatus: result?.status || 'failed',
          criteria: result?.criteria || null,
          overallSummary: result?.overallSummary || '',
          strengths: result?.strengths || '',
          areasForImprovement: result?.areasForImprovement || '',
          recordedCount: Object.keys(recordings).length,
          recordings,
          transcripts: result?.transcripts || {}
        }
      };

      if (onComplete) {
        onComplete(canonicalAttempt.speaking);
      }
    };

    const criteriaList = [
      {
        id: 'fluency',
        title: 'Fluency & Coherence',
        data: result?.criteria?.fluencyAndCoherence,
        defaultNote: 'Speech continuity, hesitation, linking phrases, and idea development.'
      },
      {
        id: 'lexical',
        title: 'Lexical Resource',
        data: result?.criteria?.lexicalResource,
        defaultNote: 'Topic vocabulary range, academic phrasing, precision, and collocation.'
      },
      {
        id: 'grammar',
        title: 'Grammatical Range & Accuracy',
        data: result?.criteria?.grammaticalRangeAndAccuracy,
        defaultNote: 'Syntactic complexity, tense control, clause variety, and grammatical precision.'
      },
      {
        id: 'pronunciation',
        title: 'Pronunciation',
        data: result?.criteria?.pronunciation,
        defaultNote: 'Phonological clarity, word stress, sentence intonation, and connected speech.'
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

        {/* ── 1. SPEAKING PRACTICE COMPLETE HERO CARD ── */}
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
              SPEAKING PRACTICE COMPLETE
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Speaking Assessment
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {isCompleted ? 'Your Speaking evaluation is ready.' : 'Speaking interview completed. Evaluated using official IELTS descriptors.'}
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
              {isCompleted ? result.overallSpeakingBand.toFixed(1) : (isPartial ? 'Partial' : 'Unavailable')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, fontWeight: 700 }}>
              Target: {getTargetBand() || '8.0'}
            </div>
          </div>
        </div>

        {isFailed && !isPartial && (
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
        
        {isPartial && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1.5px solid #151313',
            borderRadius: 18,
            padding: '20px 24px',
            marginBottom: 32,
            boxShadow: '0 3px 0 #151313',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            <Icon name="alertCircle" size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#151313' }}>
                Partial Attempt Recorded
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                {`You answered ${result?.coverage?.questionsAnswered} out of ${result?.coverage?.questionsExpected} expected questions. An overall IELTS Speaking band requires attempting all 3 parts of the interview.`}
              </div>
            </div>
          </div>
        )}

        {/* ── 3. FOUR ASSESSMENT CRITERIA CARDS ── */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Assessment Criteria
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 36 }}>
          {criteriaList.map((c) => {
            const hasBand = typeof c.data?.band === 'number';
            const isAudioReq = c.data?.status === 'insufficient_audio_evidence';

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

                {isAudioReq && (
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#151313',
                    color: '#BE94F5',
                    alignSelf: 'flex-start'
                  }}>
                    Acoustic Evidence Required
                  </span>
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

        {/* ── 4. PERFORMANCE SUMMARY ── */}
        {(result?.overallSummary || result?.strengths || result?.areasForImprovement) && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid #151313',
            borderRadius: 20,
            padding: '28px 32px',
            marginBottom: 36,
            boxShadow: '0 3px 0 #151313'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px' }}>
              Performance Summary
            </h3>
            {result?.overallSummary && (
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6, margin: '0 0 16px' }}>
                {result.overallSummary}
              </p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {result?.strengths && (
                <div style={{ padding: 16, borderRadius: 14, background: 'rgba(190, 148, 245, 0.12)', border: '1px solid #151313' }}>
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
          </div>
        )}

        {/* ── 5. YOUR RESPONSES (EVIDENCE & PLAYBACK) ── */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Your Responses & Evidence
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 44 }}>
          {Object.entries(recordings).map(([key, item]) => {
            const [pIdx, qI] = key.split('_');
            return (
              <div
                key={key}
                style={{
                  background: 'var(--bg-card)',
                  border: '1.5px solid #151313',
                  borderRadius: 18,
                  padding: '20px 24px',
                  boxShadow: '0 3px 0 #151313',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--c-coral)', textTransform: 'uppercase' }}>
                    Part {Number(pIdx) + 1} · Question {Number(qI) + 1}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-canvas)', border: '1px solid #151313' }}>
                    Duration: {FMT(item.duration)}
                  </div>
                </div>

                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {item.qText || 'Speaking prompt'}
                </div>

                {item.transcript ? (
                  <div style={{
                    fontSize: 13.5,
                    fontStyle: 'italic',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'var(--bg-canvas)',
                    border: '1px solid rgba(21,19,19,0.15)'
                  }}>
                    "{item.transcript}"
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    No speech transcript captured.
                  </div>
                )}

                <div style={{ marginTop: 4 }}>
                  <audio
                    controls
                    src={item.url}
                    style={{
                      width: '100%',
                      maxWidth: 360,
                      height: 38,
                      borderRadius: 10
                    }}
                  />
                </div>
              </div>
            );
          })}
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
            id="save-speaking-result-btn"
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
     4. EXAM INTERFACE (Sections 16, 17, 18, 19, 20)
     ────────────────────────────────────────────────────────── */
  const isPartRecorded = isCueCardPart ? Boolean(currentRecording) : currentPart?.questions?.every((_, qI) => Boolean(recordings[`${partIdx}_${qI}`]));

  return (
    <div className="exam-focus-layout" style={{ maxWidth: 1080 }}>
      {/* ── 1. COMPACT INTERNAL EXAM HEADER ── */}
      <div className="exam-focus-header">
        <div className="exam-focus-header-left">
          <span className="exam-focus-tag" style={{ background: '#151313', color: '#FFFFFF', borderColor: '#151313' }}>
            IELTS SPEAKING PRACTICE
          </span>
          <h2 className="exam-focus-title">
            Part {partIdx + 1} of {test.parts.length} · {currentPart?.title}
          </h2>
        </div>

        <div className="exam-focus-header-right">
          <div className="exam-focus-timer-pill" title="Current question status">
            <Icon name="mic" size={16} />
            <span>Question {questionIdx + 1} of {totalQuestionsInPart}</span>
          </div>

          <button
            type="button"
            className="exam-focus-exit-btn"
            onClick={() => {
              if (window.confirm('Exit speaking practice? Your audio for this session will be discarded.')) {
                onBack();
              }
            }}
            title="Exit interview and return to Dashboard"
          >
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* ── 2. QUESTION SELECTOR FOR MULTI-QUESTION PARTS (PART 1 & 3) ── */}
      {!isCueCardPart && currentPart?.questions && currentPart.questions.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '0 4px'
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Select Question:
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {currentPart.questions.map((q, idx) => {
              const isSelected = idx === questionIdx;
              const hasRec = Boolean(recordings[`${partIdx}_${idx}`]);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    stopRecording();
                    setQuestionIdx(idx);
                    setActivePlaybackUrl(null);
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 800,
                    border: isSelected ? '2px solid #151313' : '1.5px solid #151313',
                    background: isSelected ? '#151313' : hasRec ? 'rgba(16,185,129,0.14)' : 'var(--bg-card)',
                    color: isSelected ? '#FFFFFF' : hasRec ? '#10B981' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? '0 2px 0 #151313' : 'none',
                    transition: 'all 140ms ease'
                  }}
                  title={hasRec ? `Question ${idx + 1} (Recorded)` : `Question ${idx + 1}`}
                >
                  {hasRec && !isSelected ? '✓' : idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. QUESTION PROMPT CARD ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: 'var(--border-dark)',
        borderRadius: 'var(--r-card)',
        padding: '36px 36px',
        boxShadow: '0 3px 0 #151313'
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
          {isCueCardPart ? 'Part 2: Candidate Task Card' : `Question ${questionIdx + 1}`}
        </h3>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-primary)' }}>
          {currentQuestion || (currentPart?.questions ? currentPart.questions.join('\n') : 'No question available.')}
        </p>
      </div>

      {/* ── 4. SUBSTANTIAL RECORDING INTERACTION AREA ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: 'var(--border-dark)',
        borderRadius: 'var(--r-card)',
        padding: '32px 36px',
        boxShadow: '0 3px 0 #151313',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16
      }}>
        {/* STATE 1: READY */}
        {!isRecording && !currentRecording && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Ready to answer this question. Speak clearly into your microphone.
            </div>
            <motion.button
              id="start-record-btn"
              type="button"
              className="speaking-record-cta"
              onClick={startRecording}
              whileHover={{ y: -2, boxShadow: '0 6px 0 #151313' }}
              whileTap={{ y: 2, scale: 0.98, boxShadow: '0 2px 0 #151313' }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Icon name="mic" size={20} />
              <span>Start Recording</span>
            </motion.button>
          </div>
        )}

        {/* STATE 2: RECORDING (Countdown, Grace Period, Auto-Stop) */}
        {isRecording && (
          <div style={{ textAlign: 'center', width: '100%', maxWidth: 480 }}>
            {/* Timer & Status Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 22px',
              borderRadius: 'var(--r-pill)',
              background: recordSeconds >= targetSeconds ? 'rgba(255, 87, 52, 0.12)' : 'var(--surface-sunken)',
              border: `1.5px solid ${recordSeconds >= targetSeconds ? 'var(--coral)' : 'var(--border)'}`,
              marginBottom: 14
            }}>
              <span style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--coral)',
                boxShadow: '0 0 10px var(--coral)',
                animation: 'pulse 1s infinite'
              }} />
              <span style={{
                fontSize: 20,
                fontWeight: 800,
                fontFamily: 'Kodchasan, monospace',
                color: recordSeconds >= targetSeconds ? 'var(--coral)' : (targetSeconds - recordSeconds <= 10 ? 'var(--coral)' : 'var(--text-primary)')
              }}>
                {recordSeconds < targetSeconds
                  ? FMT(targetSeconds - recordSeconds)
                  : `+00:${String(Math.min(5, recordSeconds - targetSeconds)).padStart(2, '0')}`}
              </span>
              <span style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: recordSeconds >= targetSeconds ? 'var(--coral)' : 'var(--text-muted)'
              }}>
                {recordSeconds >= targetSeconds ? 'Finish your answer' : `Target: ${targetSeconds}s`}
              </span>
            </div>

            {/* Subtle Progress Bar */}
            <div style={{
              width: '100%',
              height: 6,
              background: 'var(--surface-sunken)',
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 18,
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (recordSeconds / targetSeconds) * 100)}%`,
                background: recordSeconds >= targetSeconds ? 'var(--coral)' : (targetSeconds - recordSeconds <= 10 ? 'var(--coral)' : 'var(--near-black)'),
                transition: 'width 1s linear, background-color 0.3s ease'
              }} />
            </div>

            {/* Live speech preview if speech detected */}
            {liveTranscript && (
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                marginBottom: 16,
                maxHeight: 52,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                padding: '0 8px'
              }}>
                "{liveTranscript}"
              </div>
            )}

            <div>
              <motion.button
                id="stop-record-btn"
                type="button"
                className="speaking-stop-cta"
                onClick={stopRecording}
                whileHover={{ y: -2, boxShadow: '0 6px 0 #151313' }}
                whileTap={{ y: 2, scale: 0.98, boxShadow: '0 2px 0 #151313' }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <span style={{ width: 12, height: 12, background: 'var(--coral)', borderRadius: 2 }} />
                <span>{recordSeconds >= targetSeconds ? 'Finish Answer' : 'Stop Recording'}</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* STATE 3: RECORDED / AUTO-STOPPED */}
        {!isRecording && currentRecording && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 700,
              color: '#10B981',
              background: 'rgba(16,185,129,0.1)',
              padding: '6px 14px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid rgba(16,185,129,0.3)'
            }}>
              <Icon name="check" size={16} />
              <span>Recording saved ({FMT(currentRecording.duration)})</span>
            </div>

            <audio ref={audioPlayerRef} controls src={currentRecording.url} style={{ width: '100%', maxWidth: 460, height: 40 }} />

            {/* User Spoken Transcript Display */}
            {currentRecording.transcript && (
              <div style={{
                width: '100%',
                maxWidth: 480,
                padding: '12px 16px',
                background: 'var(--surface-sunken)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                textAlign: 'left'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>
                  Spoken Transcript
                </div>
                "{currentRecording.transcript}"
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="speaking-secondary-btn"
                onClick={startRecording}
              >
                <Icon name="mic" size={15} />
                <span>Record Again</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. UNIVERSAL 3-ZONE EXAM BOTTOM NAVIGATION ── */}
      <ExamBottomNav
        onPrevious={() => {}}
        isPreviousDisabled={true}
        previousLabel=""
        sections={[{ label: 'Full Speaking Test', isCompleted: Boolean(recordings['0_0']) }]}
        activeSectionIndex={0}
        onSelectSection={() => {}}
        onNext={handleFinish}
        nextLabel={isMockMode ? 'Submit Mock Test' : 'Finish & Grade Exam'}
        isSubmit={true}
        nextActionId={'finish-speaking-exam'}
      />
    </div>
  );
}
