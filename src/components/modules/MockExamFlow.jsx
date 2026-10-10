import React, { useState } from 'react';
import { prepareLocalStt } from '../../utils/speech/localStt';
import { Icon } from '../common/Icon';
import { getRandomizedFullExam } from '../../data/exams/examAssembler';
import { getProductionWritingTest } from '../../data/production/adapters';
import {
  saveActiveMockSession,
  getActiveMockSession,
  clearActiveMockSession,
  getTargetBand
} from '../../utils/storage';
import { ResultPage, ResultItem } from '../common/ResultReveal.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';
import { evaluateFullMockExam } from '../../utils/evaluation/evaluationEngine';
import ExamStartScreen from './ExamStartScreen';
import ListeningModule from './ListeningModule';
import ReadingModule from './ReadingModule';
import WritingModule from './WritingModule';
import SpeakingModule from './SpeakingModule';
import { eradicateAllAudioRecordings } from '../../utils/audio/audioStore';

const STEPS = ['listening', 'reading', 'writing', 'speaking'];

/** What the band on each skill card is based on — so a score is never unexplained. */
function skillEvidence(key, r) {
  if (!r) return '';
  if (key === 'listening' || key === 'reading') {
    const items = Object.values(r.itemResults || {});
    const answered = items.filter(x => x.candidateAnswer !== null && String(x.candidateAnswer ?? '').trim() !== '').length;
    if (r.status === 'not_attempted' || answered === 0) return 'No answers submitted';
    if (r.unresolvedCount > 0) {
      return `${r.raw ?? 0} of ${r.total || 40} correct (${r.unresolvedCount} unresolved · possible ${r.rawMin}–${r.rawMax})`;
    }
    return `${r.raw ?? 0} of ${r.total || 40} correct · ${answered} answered`;
  }
  if (key === 'writing') {
    if (r.status === 'not_attempted') return 'No essays submitted';
    const w1 = r.task1Words, w2 = r.task2Words;
    return typeof w1 === 'number' && typeof w2 === 'number' ? `Task 1: ${w1} words · Task 2: ${w2} words` : '';
  }
  if (key === 'speaking') {
    if (r.status === 'not_attempted') return 'No spoken answers recorded';
    return r.provisional ? 'Provisional: Pronunciation unassessed (needs audio)' : '';
  }
  return '';
}

export default function MockExamFlow({ onComplete, onBack }) {
  // Restore existing in-progress session if user refreshed or navigated back.
  // Sessions carrying legacy V2 manifests (generationId) are discarded — the
  // production database replaced that content layer in Phases 3–6.
  const existingSession = getActiveMockSession();
  const hasActiveSession = existingSession && existingSession.status === 'in_progress'
    && existingSession.examMeta && !existingSession.manifest?.generationId
    && getProductionWritingTest(existingSession.examMeta.testId);

  const [examData] = useState(() => {
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
    // the Speaking section needs the on-device speech model; fetch it in the
    // background now so it is ready long before Speaking begins
    prepareLocalStt().catch(() => {});
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
      // Completed all 4 modules: clear active session, eradicate audio caches, run evaluation pipeline
      clearActiveMockSession();
      eradicateAllAudioRecordings();
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
            eradicateAllAudioRecordings();
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
          <ScrollToTop />
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
          <ScrollToTop />
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
      <ResultPage skill="mock" className="exam-results-screen">
        <ResultItem as="button" type="button" className="result-back-btn" onClick={onBack}>
          <Icon name="arrowLeft" size={16} /> Dashboard
        </ResultItem>

        {/* OVERALL BAND HERO CARD */}
        <ResultItem className="result-hero">
          <div>
            <span className="result-eyebrow">FULL MOCK EXAM · RESULTS</span>
            <h1 className="result-title">{examData.title || 'IELTS Academic Full Simulation'}</h1>
            <p className="result-lead">
              {overall !== null
                ? (canonicalEvaluation?.isProvisional
                    ? 'Overall band includes a provisional component: Speaking is a transcript-based estimate (without live audio pronunciation) or answers are pending review.'
                    : 'Overall band = the average of your four skill bands, rounded the IELTS way.')
                : 'No overall band yet: it needs all four skills answered and scored. Each skill below shows exactly what was scored.'}
            </p>
          </div>

          <div className="result-band-box">
            <div className="result-band-label">
              {canonicalEvaluation?.isProvisional ? 'Provisional overall' : 'Overall band'}
            </div>
            <div className={`result-band-value${overall !== null ? '' : ' is-empty'}`}>
              {overall !== null ? overall.toFixed(1) : '--'}
            </div>
            <div className="result-band-sub">Target: {getTargetBand() || '8.0'}</div>
          </div>
        </ResultItem>

        {/* 4 SKILL SCORES ROW */}
        <ResultItem as="section">
          <div className="result-section-head">
            <h2 className="result-section-title">Skill Breakdown</h2>
          </div>
          <div className="result-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
            {[
              { label: 'Listening', band: L, skillKey: 'listening', status: skills.listening?.status, icon: 'headphones', color: 'var(--c-yellow)' },
              { label: 'Reading', band: R, skillKey: 'reading', status: skills.reading?.status, icon: 'book', color: 'var(--c-lavender)' },
              { label: 'Writing', band: W, skillKey: 'writing', status: skills.writing?.status, icon: 'pen', color: 'var(--c-coral)' },
              { label: 'Speaking', band: S, skillKey: 'speaking', status: skills.speaking?.status, icon: 'mic', color: 'var(--c-speaker)' },
            ].map((item, i) => {
              const sk = skills[item.skillKey] || {};
              const isUnresolvedRange = sk.unresolvedCount > 0 && typeof sk.bandMin === 'number' && typeof sk.bandMax === 'number' && sk.bandMin !== sk.bandMax;
              const hasValue = isUnresolvedRange || item.band !== null;
              return (
                <div key={i} className="result-card result-criterion">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span className="result-criterion-name">{item.label}</span>
                    <span className="result-skill-icon" style={{ '--skill-tint': item.color }}>
                      <Icon name={item.icon} size={18} />
                    </span>
                  </div>
                  <div className={`result-criterion-band${hasValue ? '' : ' is-empty'}`} style={isUnresolvedRange ? { fontSize: 32 } : undefined}>
                    {isUnresolvedRange
                      ? `${sk.bandMin.toFixed(1)}–${sk.bandMax.toFixed(1)}`
                      : (item.band !== null ? item.band.toFixed(1) : '--')}
                    <small>/ 9.0</small>
                  </div>
                  <div>
                    {item.status === 'completed' && item.band !== null && (
                      sk.unresolvedCount > 0 ? (
                        <span className="result-status is-warn">Provisional ({sk.unresolvedCount} unresolved)</span>
                      ) : item.skillKey === 'speaking' && sk.provisional ? (
                        <span className="result-status is-warn">Provisional (Transcript-only)</span>
                      ) : (
                        <span className="result-status is-good">✓ Evaluated</span>
                      )
                    )}
                    {item.status === 'not_attempted' && (
                      <span className="result-status is-muted">Unattempted</span>
                    )}
                    {item.status === 'failed' && (
                      <span className="result-status is-bad">Evaluation Failed</span>
                    )}
                    <div className="mock-skill-evidence">{skillEvidence(item.skillKey, sk)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ResultItem>

        {/* 3 ANALYSIS SECTIONS: STRENGTHS, PRIORITY AREAS, RECOMMENDED PRACTICE */}
        {(strengths.length > 0 || priorityAreas.length > 0 || recommendations.length > 0) ? (
          <ResultItem className="result-grid is-wide" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))' }}>
            {/* Strengths */}
            <section className="result-card">
              <h3 className="result-card-title" style={{ color: 'var(--success-icon)', marginBottom: 14 }}>
                <Icon name="check" size={18} /> Strengths
              </h3>
              {strengths.length > 0 ? (
                <ul className="result-list">
                  {strengths.map((s, idx) => (
                    <li key={idx} className="result-list-item">
                      <span><strong>{s.title}:</strong> {s.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="result-list-empty">Complete more answers to highlight specific strengths.</p>
              )}
            </section>

            {/* Priority Areas */}
            <section className="result-card">
              <h3 className="result-card-title" style={{ color: 'var(--coral)', marginBottom: 14 }}>
                <Icon name="alertCircle" size={18} /> Priority Areas
              </h3>
              {priorityAreas.length > 0 ? (
                <ul className="result-list">
                  {priorityAreas.map((p, idx) => (
                    <li key={idx} className="result-list-item">
                      <span><strong>{p.title}:</strong> {p.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="result-list-empty">No critical priority areas flagged in this submission.</p>
              )}
            </section>

            {/* Recommended Practice */}
            <section className="result-card">
              <h3 className="result-card-title" style={{ marginBottom: 14 }}>
                <Icon name="arrowRight" size={18} /> Recommended Practice
              </h3>
              {recommendations.length > 0 ? (
                <ul className="result-list">
                  {recommendations.map((r, idx) => (
                    <li key={idx} className="result-list-item" style={{ flexDirection: 'column', gap: 4 }}>
                      <strong>{r.title}</strong>
                      <span>{r.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="result-list-empty">Complete all test components to receive targeted drill recommendations.</p>
              )}
            </section>
          </ResultItem>
        ) : (
          <ResultItem className="answer-review-empty" style={{ padding: 24 }}>
            Detailed diagnostic strengths and targeted practice areas require completed responses across all examined skills.
          </ResultItem>
        )}

        {/* PROMINENT SAVE SCORE & RETURN BUTTON */}
        <ResultItem className="result-actions">
          <button
            id="save-mock-results"
            type="button"
            className="result-btn is-primary"
            onClick={() => onComplete && onComplete(canonicalEvaluation)}
          >
            <Icon name="check" size={18} />
            <span>Save Score & Return to Dashboard</span>
          </button>
        </ResultItem>
      </ResultPage>
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
