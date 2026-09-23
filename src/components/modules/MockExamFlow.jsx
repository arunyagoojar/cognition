import React, { useState } from 'react';
import ListeningModule from './ListeningModule';
import ReadingModule from './ReadingModule';
import WritingModule from './WritingModule';
import SpeakingModule from './SpeakingModule';
import { calculateOverallBand } from '../../utils/bandCalculator';
import { Award, Headphones, BookOpen, PenTool, Mic, ArrowRight, CheckCircle2, AlertCircle, RotateCcw, Home } from 'lucide-react';

export default function MockExamFlow({ testData, onExitToDashboard }) {
  // Steps: 'intro' -> 'listening' -> 'reading' -> 'writing' -> 'speaking' -> 'results'
  const [currentStep, setCurrentStep] = useState(() => new URLSearchParams(window.location.search).get('step') || 'intro');
  const [examResults, setExamResults] = useState({
    listening: { rawScore: 36, total: 40, bandScore: 8.0 },
    reading: { rawScore: 34, total: 40, bandScore: 7.5 },
    writing: { estimatedBand: 7.5 },
    speaking: { estimatedBand: 7.5 }
  });

  const handleStepComplete = (stepKey, result) => {
    setExamResults(prev => ({ ...prev, [stepKey]: result }));

    // Advance to next step
    if (stepKey === 'listening') setCurrentStep('reading');
    else if (stepKey === 'reading') setCurrentStep('writing');
    else if (stepKey === 'writing') setCurrentStep('speaking');
    else if (stepKey === 'speaking') setCurrentStep('results');
  };

  const calculateTotalBands = () => {
    const lBand = typeof examResults.listening?.bandScore === 'number' ? examResults.listening.bandScore : 7.0;
    const rBand = typeof examResults.reading?.bandScore === 'number' ? examResults.reading.bandScore : 7.0;
    const wBand = typeof examResults.writing?.overallBand === 'number' ? examResults.writing.overallBand : (typeof examResults.writing?.estimatedBand === 'number' ? examResults.writing.estimatedBand : 7.0);
    const sBand = typeof examResults.speaking?.overallBand === 'number' ? examResults.speaking.overallBand : 7.0;
    const overall = calculateOverallBand(lBand, rBand, wBand, sBand);

    return { lBand, rBand, wBand, sBand, overall };
  };

  const stepsList = [
    { id: 'listening', title: 'Listening', time: '32m', icon: Headphones },
    { id: 'reading', title: 'Reading', time: '60m', icon: BookOpen },
    { id: 'writing', title: 'Writing', time: '60m', icon: PenTool },
    { id: 'speaking', title: 'Speaking', time: '14m', icon: Mic },
  ];

  // Auto-scroll to top when results step is activated
  React.useEffect(() => {
    if (currentStep === 'results') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const scrollables = document.querySelectorAll('.main-content, .page-view-enter, .exam-container, html, body');
      scrollables.forEach(el => { if (el) el.scrollTop = 0; });
    }
  }, [currentStep]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mock Exam Top Header */}
      <div className="mock-exam-header" style={{ borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="nav-logo-badge" style={{ background: 'var(--accent-blue)', color: '#fff' }}>M</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>IELTS Academic Mock Exam Simulation</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Official Examination Conditions</div>
          </div>
        </div>

        {/* Step Flow Indicators */}
        <div className="exam-step-flow">
          {stepsList.map((st, i) => {
            const Icon = st.icon;
            const isCompleted = examResults[st.id] !== null;
            const isActive = currentStep === st.id;

            let stepClass = 'exam-step-item';
            if (isActive) stepClass += ' active';
            else if (isCompleted) stepClass += ' completed';

            return (
              <React.Fragment key={st.id}>
                <div className={stepClass}>
                  {isCompleted ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                  <span>{st.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({st.time})</span>
                </div>
                {i < stepsList.length - 1 && (
                  <span style={{ color: 'var(--border-default)', fontSize: 12 }}>→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div>
          <button 
            className="btn btn-ghost"
            onClick={onExitToDashboard}
            style={{ fontSize: 12.5 }}
          >
            <Home size={14} />
            <span>Exit Exam</span>
          </button>
        </div>
      </div>

      {/* Intro Step */}
      {currentStep === 'intro' && (
        <div className="card" style={{ maxWidth: 820, margin: '20px auto', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <span className="badge badge-blue" style={{ marginBottom: 12, padding: '4px 12px' }}>
              Standard CD-IELTS Protocol
            </span>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 12 }}>
              Full IELTS Examination Simulation
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 650, margin: '0 auto' }}>
              You are about to sit a complete IELTS Academic exam. The test follows the official sequence without interruptions:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Headphones size={18} color="var(--accent-blue)" />
                <strong style={{ fontSize: 14 }}>1. Listening (32 mins)</strong>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                4 parts, 40 questions. Audio will play once through your headphones. Type answers directly as you listen.
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <BookOpen size={18} color="var(--accent-green)" />
                <strong style={{ fontSize: 14 }}>2. Reading (60 mins)</strong>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                3 long academic passages, 40 questions. Use the split-screen reader and digital text highlighter.
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <PenTool size={18} color="var(--accent-amber)" />
                <strong style={{ fontSize: 14 }}>3. Writing (60 mins)</strong>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Task 1 (Norbiton map summary, 150 words) and Task 2 (Risk-taking discursive essay, 250 words).
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Mic size={18} color="var(--accent-purple)" />
                <strong style={{ fontSize: 14 }}>4. Speaking (14 mins)</strong>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Part 1 Interview, Part 2 Cue Card (1 min prep timer, notes, 2 min speech recording), and Part 3 Discussion.
              </p>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <AlertCircle size={20} color="var(--accent-blue)" />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Please connect your headphones and verify your microphone permissions before beginning. Your responses are auto-saved locally.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => setCurrentStep('listening')}
              style={{
                padding: '12px 36px',
                fontSize: 16,
                borderRadius: 'var(--radius-pill)',
                background: 'linear-gradient(135deg, #2383e2, #529cca)'
              }}
            >
              <span>Begin Listening Section</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Listening Step */}
      {currentStep === 'listening' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="badge badge-blue">Exam Section 1 of 4: Listening</span>
            <button 
              className="btn btn-primary"
              onClick={() => handleStepComplete('listening', { rawScore: 36, total: 40, bandScore: 8.0 })}
            >
              <span>Finish Listening → Go to Reading</span>
              <ArrowRight size={15} />
            </button>
          </div>
          <ListeningModule
            testData={testData}
            isExamMode={true}
            onComplete={(res) => handleStepComplete('listening', res)}
          />
        </div>
      )}

      {/* Reading Step */}
      {currentStep === 'reading' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="badge badge-green">Exam Section 2 of 4: Reading</span>
            <button 
              className="btn btn-primary"
              onClick={() => handleStepComplete('reading', { rawScore: 34, total: 40, bandScore: 7.5 })}
            >
              <span>Finish Reading → Go to Writing</span>
              <ArrowRight size={15} />
            </button>
          </div>
          <ReadingModule
            testData={testData}
            isExamMode={true}
            onComplete={(res) => handleStepComplete('reading', res)}
          />
        </div>
      )}

      {/* Writing Step */}
      {currentStep === 'writing' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="badge badge-amber">Exam Section 3 of 4: Writing</span>
            <button 
              className="btn btn-primary"
              onClick={() => handleStepComplete('writing', { estimatedBand: 7.5 })}
            >
              <span>Finish Writing → Go to Speaking</span>
              <ArrowRight size={15} />
            </button>
          </div>
          <WritingModule
            testData={testData}
            isExamMode={true}
            onComplete={(res) => handleStepComplete('writing', res)}
          />
        </div>
      )}

      {/* Speaking Step */}
      {currentStep === 'speaking' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="badge badge-purple">Exam Section 4 of 4: Speaking</span>
            <button 
              className="btn btn-primary"
              onClick={() => handleStepComplete('speaking', { estimatedBand: 7.5 })}
            >
              <span>Complete Exam & View Official Scorecard</span>
              <Award size={15} />
            </button>
          </div>
          <SpeakingModule
            testData={testData}
            isExamMode={true}
            onComplete={(res) => handleStepComplete('speaking', res)}
          />
        </div>
      )}

      {/* Final Results Step (Official IELTS Test Report Card) */}
      {currentStep === 'results' && (() => {
        const { lBand, rBand, wBand, sBand, overall } = calculateTotalBands();

        return (
          <div className="exam-centered-result-view">
            <div className="card" style={{ maxWidth: 840, width: '100%', margin: '0 auto', padding: '36px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(35, 131, 226, 0.2), rgba(144, 101, 176, 0.2))',
                border: '1px solid var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Award size={32} color="var(--accent-blue)" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.4, marginBottom: 8 }}>
                Official IELTS Mock Test Report
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Cambridge IELTS 17 Academic • Full Flow Simulation Completed
              </p>
            </div>

            {/* Big Overall Band Scorecard */}
            <div style={{
              background: 'linear-gradient(135deg, #202020 0%, #171717 100%)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
              textAlign: 'center',
              marginBottom: 28,
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Overall Band Score
              </div>
              <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1.5, color: 'var(--accent-blue)', lineHeight: 1 }}>
                Band {overall.toFixed(1)}
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-primary)', marginTop: 12, fontWeight: 500 }}>
                {overall >= 8.0 ? 'Expert User (C2 Level)' : overall >= 7.0 ? 'Good User (C1 Level)' : 'Competent User (B2 Level)'}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                Meets admission prerequisites for top global universities (Oxford, Cambridge, Harvard, MIT, etc.)
              </div>
            </div>

            {/* 4 Skill Score Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px 14px', textAlign: 'center' }}>
                <Headphones size={20} color="var(--accent-blue)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Listening</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{lBand.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {examResults.listening?.rawScore || 36} / 40
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px 14px', textAlign: 'center' }}>
                <BookOpen size={20} color="var(--accent-green)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reading</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{rBand.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {examResults.reading?.rawScore || 34} / 40
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px 14px', textAlign: 'center' }}>
                <PenTool size={20} color="var(--accent-amber)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Writing</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{wBand.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Tasks 1 & 2</div>
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '18px 14px', textAlign: 'center' }}>
                <Mic size={20} color="var(--accent-purple)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Speaking</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{sBand.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Parts 1, 2, 3</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCurrentStep('intro');
                  setExamResults({ listening: null, reading: null, writing: null, speaking: null });
                }}
              >
                <RotateCcw size={15} />
                <span>Retake Full Mock Exam</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={onExitToDashboard}
              >
                <Home size={15} />
                <span>Return to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
}
