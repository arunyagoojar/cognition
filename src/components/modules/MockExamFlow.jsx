import React, { useState } from 'react';
import { Icon } from '../common/Icon';
import { getRandomizedFullExam } from '../../data/exams/examAssembler';
import {
  saveActiveMockSession,
  getActiveMockSession,
  clearActiveMockSession
} from '../../utils/storage';
import { evaluateFullMockExam } from '../../utils/evaluation/evaluationEngine';
import ExamStartScreen from './ExamStartScreen';
import ListeningModule from './ListeningModule';
import ReadingModule from './ReadingModule';
import WritingModule from './WritingModule';
import SpeakingModule from './SpeakingModule';

const STEPS = ['listening', 'reading', 'writing', 'speaking'];

export default function MockExamFlow({ onComplete, onBack }) {
  // Restore existing in-progress session if user refreshed or navigated back.
  // Sessions carrying legacy V2 manifests (generationId) are discarded — the
  // production database replaced that content layer in Phases 3–6.
  const existingSession = getActiveMockSession();
  const hasActiveSession = existingSession && existingSession.status === 'in_progress'
    && existingSession.examMeta && !existingSession.manifest?.generationId
    && getProductionWritingTest(existingSession.examMeta.testId);

  const [examData, setExamData] = useState(() => {
    if (hasActiveSession) {
      // Reassemble all four sections from production by the saved exam id
      const testId = existingSession.examMeta.testId;
      return getRandomizedFullExam(testId);
    }
    return getRandomizedFullExam();
  });

  const [step, setStep] = useState(() => {
    if (hasActiveSession && existingSession.currentSection) {
      const idx = STEPS.indexOf(existingSession.currentSection);
      return idx >= 0 ? idx : 0;
    }
    return -1; // -1 = intro, 0-3 = modules, 4 = evaluation/results
  });

  const [results, setResults] = useState(() => {
    if (hasActiveSession && existingSession.sectionAnswers) {
      return existingSession.sectionAnswers;
    }
    return {};
  });

  // Canonical Evaluation State Machine
  const [evaluationStatus, setEvaluationStatus] = useState('idle'); // 'idle' | 'evaluating' | 'completed' | 'failed'
  const [evaluationProgress, setEvaluationProgress] = useState(null);
  const [canonicalEvaluation, setCanonicalEvaluation] = useState(null);

  const handleStartExam = () => {
    saveActiveMockSession({
      examId: examData.testId,
      examMeta: {
        testId: examData.testId,
        title: examData.title,
        book: examData.book,
        isRandomized: examData.isRandomized
      },
      manifest: null,
      currentSection: 'listening',
      sectionAnswers: {},
      startedAt: new Date().toISOString(),
      status: 'in_progress'
    });
    setStep(0);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const runFullEvaluation = async (answersToEvaluate) => {
    setEvaluationStatus('evaluating');
    setStep(STEPS.length); // Results step
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    try {
      const evalRecord = await evaluateFullMockExam({
        testId: examData.testId,
        testLabel: examData.title,
        rawExamPackage: examData,
        sectionAnswers: answersToEvaluate,
        onProgress: (p) => setEvaluationProgress(p)
      });

      setCanonicalEvaluation(evalRecord);
      setEvaluationStatus(evalRecord.status === 'failed' ? 'failed' : 'completed');
    } catch (err) {
      console.error('Full mock examination evaluation error:', err);
      setEvaluationStatus('failed');
    }
  };

  const handleStepComplete = (skill, data) => {
    const updated = { ...results, [skill]: data };
    setResults(updated);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    if (step < STEPS.length - 1) {
      // Transition to next module in official sequence: Listening -> Reading -> Writing -> Speaking
      const nextSkill = STEPS[step + 1];
      saveActiveMockSession({
        examId: examData.testId,
        examMeta: {
          testId: examData.testId,
          title: examData.title,
          book: examData.book,
          isRandomized: examData.isRandomized
        },
        manifest: examData.manifest,
        currentSection: nextSkill,
        sectionAnswers: updated,
        status: 'in_progress'
      });
      setStep(step + 1);
    } else {
      // Completed all 4 modules: clear active session, run evaluation pipeline
      clearActiveMockSession();
      runFullEvaluation(updated);
    }
  };

  /* ──────────────────────────────────────────────────────────
     ACTIVE SKILL MODULE (Listening, Reading, Writing, Speaking)
     ────────────────────────────────────────────────────────── */
  if (step >= 0 && step < STEPS.length) {
    const skill = STEPS[step];
    const ModuleComponents = {
      listening: ListeningModule,
      reading:   ReadingModule,
      writing:   WritingModule,
      speaking:  SpeakingModule,
    };
    const Mod = ModuleComponents[skill];
    return (
      <Mod
        initialTest={examData[skill]}
        initialPhase="exam"
        isMockMode={true}
        onComplete={(data) => handleStepComplete(skill, data)}
        onBack={() => {
          if (window.confirm(`Exit the full mock exam? Your progress will be discarded and the test will not be completed.`)) {
            clearActiveMockSession();
            onBack();
          }
        }}
      />
    );
  }

  /* ──────────────────────────────────────────────────────────
     STEP 4: EVALUATION & RESULTS SCREEN
     ────────────────────────────────────────────────────────── */
  if (step === STEPS.length) {
    // 1. Evaluating Phase
    if (evaluationStatus === 'evaluating') {
      return (
        <div style={{ maxWidth: 760, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid #151313',
            borderRadius: 24,
            padding: '50px 36px',
            boxShadow: '0 4px 0 #151313'
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '6px 16px',
              borderRadius: 20,
              background: '#fccc42',
              border: '1px solid #151313',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 20
            }}>
              AI EVALUATION IN PROGRESS
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)' }}>
              Analysing your examination responses...
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.6 }}>
              Verifying objective answer keys and evaluating writing criteria and spoken speech against official IELTS Band Descriptors.
            </p>

            <div style={{
              background: 'var(--bg-canvas)',
              borderRadius: 16,
              padding: '20px 24px',
              border: '1px solid #151313',
              maxWidth: 480,
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12
            }}>
              <div className="eval-spinner" style={{
                width: 18,
                height: 18,
                border: '3px solid #151313',
                borderTopColor: '#ff5734',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {evaluationProgress?.message || 'Processing section scores...'}
              </span>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Stage: {evaluationProgress?.stage ? evaluationProgress.stage.toUpperCase() : 'INITIALIZING'} · Strict Academic Standards
            </p>
          </div>
        </div>
      );
    }

    // 2. Failed Evaluation Phase
    if (evaluationStatus === 'failed') {
      return (
        <div style={{ maxWidth: 760, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1.5px solid #151313',
            borderRadius: 24,
            padding: '50px 36px',
            boxShadow: '0 4px 0 #151313'
          }}>
            <div style={{
              display: 'inline-flex',
              padding: '6px 16px',
              borderRadius: 20,
              background: 'rgba(255,87,52,0.15)',
              border: '1px solid var(--c-coral)',
              color: 'var(--c-coral)',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 20
            }}>
              ANALYSIS INCOMPLETE
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)' }}>
              Evaluation could not be completed
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.6 }}>
              The AI evaluation service was unable to reach a verified scoring result. Your responses have been preserved safely. No synthetic or default scores have been generated.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={() => runFullEvaluation(results)}
                style={{
                  padding: '14px 28px',
                  borderRadius: 14,
                  background: '#ff5734',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 15,
                  border: '1.5px solid #151313',
                  boxShadow: '0 3px 0 #151313',
                  cursor: 'pointer'
                }}
              >
                Retry Analysis
              </button>
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: '14px 28px',
                  borderRadius: 14,
                  background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 15,
                  border: '1.5px solid #151313',
                  cursor: 'pointer'
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 3. Completed Evaluation Phase (Authoritative Canonical Display)
    const skills = canonicalEvaluation?.skills || {};
    const L = skills.listening?.status === 'completed' && typeof skills.listening.band === 'number' ? skills.listening.band : null;
    const R = skills.reading?.status === 'completed' && typeof skills.reading.band === 'number' ? skills.reading.band : null;
    const W = skills.writing?.status === 'completed' && typeof skills.writing.band === 'number' ? skills.writing.band : null;
    const S = skills.speaking?.status === 'completed' && typeof skills.speaking.band === 'number' ? skills.speaking.band : null;

    const overall = canonicalEvaluation?.overallBand ?? null;
    const strengths = canonicalEvaluation?.strengths || [];
    const priorityAreas = canonicalEvaluation?.priorityAreas || [];
    const recommendations = canonicalEvaluation?.recommendations || [];

    return (
      <div className="exam-results-screen" style={{ maxWidth: 1080, margin: '40px auto', padding: '0 24px 80px' }}>
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
          <Icon name="arrowLeft" size={16} /> Dashboard
        </button>

        {/* OVERALL BAND HERO CARD */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1.5px solid #151313',
          borderRadius: 24,
          padding: '44px 40px',
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
              AUTHENTIC IELTS EXAMINATION COMPLETE
            </div>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800, margin: '0 0 10px', color: 'var(--text-primary)' }}>
              {examData.title || 'IELTS Academic Full Simulation'}
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {overall !== null
                ? 'Official 4-skill evaluation calculated using standard rounding rules.'
                : 'Partial test completed. Official overall band requires all 4 skills to be attempted and evaluated.'}
            </p>
          </div>

          <div style={{
            background: 'var(--bg-canvas)',
            padding: '24px 40px',
            borderRadius: 20,
            textAlign: 'center',
            border: '1.5px solid #151313',
            boxShadow: '0 2px 0 #151313',
            minWidth: 180
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              OVERALL BAND
            </div>
            <div style={{
              fontSize: 60,
              fontWeight: 800,
              color: overall !== null ? 'var(--c-coral)' : 'var(--text-muted)',
              lineHeight: 1.1,
              marginTop: 4,
              fontFamily: 'Kodchasan, sans-serif'
            }}>
              {overall !== null ? overall.toFixed(1) : '--'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 700 }}>
              Target: 8.0
            </div>
          </div>
        </div>

        {/* 4 SKILL SCORES ROW */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          Skill Breakdown
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { label: 'Reading', band: R, skillKey: 'reading', status: skills.reading?.status, icon: 'book', color: 'var(--c-lavender)' },
            { label: 'Listening', band: L, skillKey: 'listening', status: skills.listening?.status, icon: 'headphones', color: 'var(--c-yellow)' },
            { label: 'Writing', band: W, skillKey: 'writing', status: skills.writing?.status, icon: 'pen', color: 'var(--c-coral)' },
            { label: 'Speaking', band: S, skillKey: 'speaking', status: skills.speaking?.status, icon: 'mic', color: 'var(--c-near-black)' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              border: '1.5px solid #151313',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 3px 0 #151313',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{item.label}</span>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'var(--bg-canvas)',
                  border: '1px solid #151313',
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon name={item.icon} size={16} />
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Kodchasan, sans-serif' }}>
                {item.band !== null ? item.band.toFixed(1) : '--'}{' '}
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>/ 9.0</span>
              </div>
              <div>
                {item.status === 'completed' && item.band !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>✓ Evaluated</span>
                )}
                {item.status === 'not_attempted' && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Unattempted</span>
                )}
                {item.status === 'failed' && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-coral)' }}>Evaluation Failed</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 3 ANALYSIS SECTIONS: STRENGTHS, PRIORITY AREAS, RECOMMENDED PRACTICE */}
        {(strengths.length > 0 || priorityAreas.length > 0 || recommendations.length > 0) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 44 }}>
            {/* Strengths */}
            <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#10B981', marginBottom: 16 }}>
                <Icon name="check" size={16} /> Strengths
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {strengths.length > 0 ? strengths.map((s, idx) => (
                  <div key={idx} style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{s.title}:</strong> {s.detail}
                  </div>
                )) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete more answers to highlight specific strengths.</div>
                )}
              </div>
            </div>

            {/* Priority Areas */}
            <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--c-coral)', marginBottom: 16 }}>
                <Icon name="alertCircle" size={16} /> Priority Areas
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {priorityAreas.length > 0 ? priorityAreas.map((p, idx) => (
                  <div key={idx} style={{ padding: 12, background: 'var(--bg-canvas)', borderRadius: 12, border: '1px solid rgba(21,19,19,0.1)', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{p.title}:</strong> {p.detail}
                  </div>
                )) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No critical priority areas flagged in this submission.</div>
                )}
              </div>
            </div>

            {/* Recommended Practice */}
            <div style={{ background: 'var(--bg-card)', border: '1.5px solid #151313', borderRadius: 20, padding: 24, boxShadow: '0 3px 0 #151313' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
                <Icon name="arrowRight" size={16} /> Recommended Practice
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {recommendations.length > 0 ? recommendations.map((r, idx) => (
                  <div key={idx} style={{ padding: 14, background: 'rgba(255, 87, 52, 0.08)', border: '1px solid #151313', borderRadius: 12, fontSize: 13 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{r.title}</strong>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{r.detail}</div>
                  </div>
                )) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete all test components to receive targeted drill recommendations.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--bg-canvas)',
            border: '1px dashed #151313',
            borderRadius: 16,
            padding: '24px',
            textAlign: 'center',
            marginBottom: 44,
            fontSize: 14,
            color: 'var(--text-secondary)'
          }}>
            Detailed diagnostic strengths and targeted practice areas require completed responses across all examined skills.
          </div>
        )}

        {/* PROMINENT SAVE SCORE & RETURN BUTTON */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
          paddingTop: 16,
          borderTop: '1.5px solid #151313'
        }}>
          <button
            id="save-mock-results"
            type="button"
            onClick={() => onComplete && onComplete(canonicalEvaluation)}
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
     INTRO SCREEN (Step === -1)
     ────────────────────────────────────────────────────────── */
  return (
    <ExamStartScreen
      section="Full Mock Examination"
      sectionKey="mock"
      testTitle="Full IELTS Mock Test"
      subtitle="Complete an authentic four-skill IELTS Academic examination under strict official timing: Listening, Reading, Writing, and Speaking in official sequence."
      metaItems={[
        { label: '4 Modules', sub: 'Listening, Reading, Writing, Speaking' },
        { label: '122 Questions', sub: 'Complete IELTS Paper' },
        { label: '~2h 45m', sub: 'Strict timed sequence' },
        { label: 'Band 0–9', sub: 'Official-style scoring' },
      ]}
      rules={[
        'All 4 modules are taken in standard IELTS sequence without pause: Listening → Reading → Writing → Speaking.',
        'Listening audio tracks are played ONCE only under strict exam timing.',
        'Reading and Writing adhere to an automatic 60-minute time cutoff.',
        'Speaking requires active microphone access for interactive 3-part examiner interview.',
      ]}
      scoringInfo="All raw scores are mapped to official IELTS band scales. Overall Band is calculated by averaging all 4 skills rounded to the nearest half or whole band."
      ctaText="START FULL MOCK TEST"
      onStart={handleStartExam}
      onBack={onBack}
    />
  );
}
