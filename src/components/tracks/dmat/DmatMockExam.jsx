import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, ArrowRight, RotateCcw, Award, AlertTriangle, ShieldCheck, ChevronRight, BookOpen, Calculator, Grid3x3, Eye } from 'lucide-react';
import { generateLatinSquareTask } from '../../../utils/dmat/latinSquareEngine';
import { generateMathEquationTask } from '../../../utils/dmat/mathEquationsEngine';
import { generateFigureSequenceTask } from '../../../utils/dmat/figureSequencesEngine';
import { getAcademicModulePassages } from '../../../utils/dmat/academicModuleData';
import { Matrix4x4 } from './FigureSequencesModule';
import ExitConfirmationModal from '../../common/ExitConfirmationModal';
import { saveDmatScore } from '../../../utils/storage';

const DIFF_CYCLE = ['low', 'medium', 'high', 'medium'];

export default function DmatMockExam({ onExit }) {
  const [subtestType, setSubtestType] = useState('full'); // 'full' (82 Qs) | 'core' (56 Qs) | 'figures' (20) | 'math' (20) | 'latin' (16)
  const [examStarted, setExamStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(160 * 60);
  const [isCompleted, setIsCompleted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const startExam = (type) => {
    setSubtestType(type);
    const qList = [];
    let initialSecs = 160 * 60; // default 160 mins for 82 Qs

    if (type === 'full') {
      // 1. Figure Sequences: 20 Tasks
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateFigureSequenceTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Figure Sequences',
          sectionNum: 1,
          sectionTotal: 20
        });
      }
      // 2. Mathematical Equations: 20 Tasks
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateMathEquationTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Mathematical Equations',
          sectionNum: 2,
          sectionTotal: 20
        });
      }
      // 3. Latin Squares: 16 Tasks (Official PDF page 25: 16 tasks in 20 min)
      for (let i = 0; i < 16; i++) {
        qList.push({
          ...generateLatinSquareTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Latin Squares',
          sectionNum: 3,
          sectionTotal: 16
        });
      }
      // 4. Subject Module (Academic): 4 Passages / 26 Questions
      const passages = getAcademicModulePassages().slice(0, 4);
      passages.forEach((pas, pIdx) => {
        pas.questions.forEach((q, qInPas) => {
          qList.push({
            id: q.id,
            type: 'academic',
            passageTitle: pas.title,
            passageField: pas.field,
            passageText: pas.text,
            passageTable: pas.table,
            prompt: q.prompt,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            sectionName: 'General Academic Module',
            sectionNum: 4,
            sectionTotal: 26,
            passageIndex: pIdx + 1,
            questionInPassage: qInPas + 1,
            totalInPassage: pas.questions.length
          });
        });
      });
      initialSecs = 160 * 60; // 25 + 25 + 20 + 90 = 160 min
    } else if (type === 'core') {
      // Official Core Module: 56 Questions in 70 min
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateFigureSequenceTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Figure Sequences',
          sectionNum: 1,
          sectionTotal: 20
        });
      }
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateMathEquationTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Mathematical Equations',
          sectionNum: 2,
          sectionTotal: 20
        });
      }
      for (let i = 0; i < 16; i++) {
        qList.push({
          ...generateLatinSquareTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Latin Squares',
          sectionNum: 3,
          sectionTotal: 16
        });
      }
      initialSecs = 70 * 60; // 25 + 25 + 20 = 70 min
    } else if (type === 'latin') {
      for (let i = 0; i < 16; i++) {
        qList.push({
          ...generateLatinSquareTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Latin Squares',
          sectionNum: 1,
          sectionTotal: 16
        });
      }
      initialSecs = 20 * 60;
    } else if (type === 'math') {
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateMathEquationTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Mathematical Equations',
          sectionNum: 1,
          sectionTotal: 20
        });
      }
      initialSecs = 25 * 60;
    } else if (type === 'figures') {
      for (let i = 0; i < 20; i++) {
        qList.push({
          ...generateFigureSequenceTask(DIFF_CYCLE[i % 4]),
          sectionName: 'Figure Sequences',
          sectionNum: 1,
          sectionTotal: 20
        });
      }
    } else if (type === 'academic') {
      const passages = getAcademicModulePassages().slice(0, 4);
      passages.forEach((pas, pIdx) => {
        pas.questions.forEach((q, qInPas) => {
          qList.push({
            id: q.id,
            type: 'academic',
            passageTitle: pas.title,
            passageField: pas.field,
            passageText: pas.text,
            passageTable: pas.table,
            prompt: q.prompt,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            sectionName: 'General Academic Module',
            sectionNum: 1,
            sectionTotal: 26,
            passageIndex: pIdx + 1,
            questionInPassage: qInPas + 1,
            totalInPassage: pas.questions.length
          });
        });
      });
      initialSecs = 90 * 60; // 90 mins for 26 questions across 4 passages
    }

    setQuestions(qList);
    setCurrentIdx(0);
    setUserAnswers({});
    setTimeLeft(initialSecs);
    setIsCompleted(false);
    setExamStarted(true);
    setStartTime(Date.now());
  };

  useEffect(() => {
    if (!examStarted || isCompleted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [examStarted, isCompleted, questions, userAnswers]);

  const handleSelectAnswer = (ans) => {
    setUserAnswers(prev => ({ ...prev, [currentIdx]: ans }));
  };

  const handleSelectFigure = (which, optIdx) => {
    setUserAnswers(prev => {
      const current = (typeof prev[currentIdx] === 'object' && prev[currentIdx]) ? prev[currentIdx] : {};
      return {
        ...prev,
        [currentIdx]: {
          ...current,
          [which]: optIdx
        }
      };
    });
  };

  const finishExam = () => {
    setIsCompleted(true);
    // Grade exam
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.type === 'figure_sequences') {
        const ans = userAnswers[i];
        if (ans && typeof ans === 'object') {
          if (ans.img1 === q.image1?.correctAnswer && ans.img2 === q.image2?.correctAnswer) {
            correct++;
          }
        } else if (ans === q.correctAnswer) {
          correct++;
        }
      } else if (userAnswers[i] === q.correctAnswer) {
        correct++;
      }
    });

    const total = questions.length;
    const pct = Math.round((correct / total) * 100);
    const standardScore = Math.round(80 + pct * 0.4);

    saveDmatScore('mock', {
      correct,
      total,
      percentage: pct,
      standardScore,
      completed: true
    });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      finishExam();
    }
  };

  const handleExitClick = () => {
    if (examStarted && !isCompleted) {
      setIsExitModalOpen(true);
    } else {
      onExit();
    }
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    onExit();
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Pre-exam screen
  if (!examStarted) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <button className="btn btn-secondary" onClick={onExit} style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }}>
          ← Back to DMAT Studio
        </button>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="badge badge-green">Official g.a.s.t. Simulation</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Exact Question Counts & Timings</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px 0', letterSpacing: -0.5 }}>
              dMAT Official Mock Examination
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Simulates the authentic computer-delivered German Master Assessment Test structure administered by g.a.s.t. e.V. for APS India.
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 171, 74, 0.08)',
            border: '1px solid rgba(255, 171, 74, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <AlertTriangle size={20} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.55 }}>
              <strong>Official Test Conditions:</strong> Strictly timed. 
              <strong> Absolutely no scratch paper, no notes, and no calculators</strong> are permitted throughout any section of the exam.
            </div>
          </div>

          <div>
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 12 }}>
              Select Official Examination Structure:
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Option 1: Full Comprehensive dMAT */}
              <button
                onClick={() => startExam('full')}
                style={{
                  background: 'linear-gradient(135deg, rgba(35,131,226,0.14), rgba(144,101,176,0.12))',
                  border: '1px solid rgba(82,156,202,0.4)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 22px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--accent-blue)" />
                    <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>Full Examination (Complete)</strong>
                  </div>
                  <span className="badge badge-blue" style={{ fontSize: 10 }}>82 Qs · 160 Min</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Simulates complete test day: 20 Figures + 20 Equations + 16 Latin Squares + 26 Subject Module questions across 4 passages.
                </span>
              </button>

              {/* Option 2: Core Module Only */}
              <button
                onClick={() => startExam('core')}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 22px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={18} color="var(--accent-green)" />
                    <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>Core Module Only</strong>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: 10 }}>56 Qs · 70 Min</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  General study aptitude test: 20 Figures (25m) + 20 Equations (25m) + 16 Latin Squares (20m).
                </span>
              </button>

              {/* Option 3: Figure Sequences */}
              <button
                onClick={() => startExam('figures')}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Figure Sequences Section</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>20 Qs · 25 Min</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Official 4×4 dual-matrix progression</span>
              </button>

              {/* Option 4: Math Equations */}
              <button
                onClick={() => startExam('math')}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Mathematical Equations</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>20 Qs · 25 Min</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Mental integer substitution systems</span>
              </button>

              {/* Option 5: Latin Squares */}
              <button
                onClick={() => startExam('latin')}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Latin Squares Section</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>16 Qs · 20 Min</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>5×5 deductive letter grids</span>
              </button>

              {/* Option 6: General Academic Module */}
              <button
                onClick={() => startExam('academic')}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Academic Subject Module</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>26 Qs · 90 Min</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Scientific & economic passage comprehension</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auto-scroll to top when completed so the centered scorecard is immediately visible
  useEffect(() => {
    if (isCompleted) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const scrollables = document.querySelectorAll('.main-content, .dmat-exam-container, html, body');
      scrollables.forEach(el => { if (el) el.scrollTop = 0; });
    }
  }, [isCompleted]);

  // Scorecard Screen
  if (isCompleted) {
    const total = questions.length;
    let correct = 0;
    questions.forEach((q, i) => {
      if (q.type === 'figure_sequences') {
        const ans = userAnswers[i];
        if (ans && typeof ans === 'object') {
          if (ans.img1 === q.image1.correctAnswer && ans.img2 === q.image2.correctAnswer) {
            correct++;
          }
        } else if (ans === q.correctAnswer) {
          correct++;
        }
      } else if (userAnswers[i] === q.correctAnswer) {
        correct++;
      }
    });
    const pct = Math.round((correct / total) * 100);
    const elapsedSecs = Math.round((Date.now() - startTime) / 1000);
    const avgPace = Math.round(elapsedSecs / total);

    return (
      <div className="exam-centered-result-view">
        <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 20
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: pct >= 65 ? 'rgba(77, 171, 154, 0.2)' : 'rgba(255, 171, 74, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pct >= 65 ? 'var(--accent-green)' : 'var(--accent-amber)'
            }}>
              <Award size={32} />
            </div>

            <div>
              <span className="badge badge-green" style={{ marginBottom: 8 }}>Diagnostic Scorecard</span>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: '6px 0 6px 0', letterSpacing: -0.5 }}>
                {correct} / {total} Correct ({pct}%)
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                Average pace: <strong>{avgPace}s</strong> per question ({avgPace <= 75 ? 'Pacing on track' : 'Above 75s target pacing'})
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 500 }}>
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Total Time</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{formatTime(elapsedSecs)}</div>
              </div>
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Standard Score</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--accent-blue)' }}>{Math.round(80 + pct * 0.4)} / 120</div>
              </div>
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>APS Readiness</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6, color: pct >= 65 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                  {pct >= 70 ? 'High' : pct >= 50 ? 'Moderate' : 'Needs Practice'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <button className="btn btn-secondary" onClick={() => startExam(subtestType)}>
                <RotateCcw size={15} />
                <span>Retake Mock Exam</span>
              </button>
              <button className="btn btn-primary" onClick={onExit}>
                <span>Return to DMAT Studio</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active exam question screen
  const currentQ = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const currentAnswer = userAnswers[currentIdx];

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Exam Header & Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '12px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-green">Official dMAT Simulation</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Question {currentIdx + 1} of {questions.length}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: timeLeft < 300 ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          <Clock size={16} color={timeLeft < 300 ? 'var(--accent-red)' : 'var(--accent-amber)'} />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Render question based on type */}
        {currentQ.type === 'latin_squares' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="badge badge-green" style={{ fontSize: 10.5 }}>Latin Squares · Marked Cell [{currentQ.targetLabel}]</span>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 0 0' }}>Find the letter for cell {currentQ.targetLabel}</h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 48px)', gridTemplateRows: 'repeat(5, 48px)', gap: 5, background: 'var(--bg-canvas)', padding: 10, borderRadius: 'var(--radius-md)', border: '2px solid var(--border-default)' }}>
                {currentQ.grid.map((row, r) => row.map((cell, c) => {
                  const isTarget = r === currentQ.target.r && c === currentQ.target.c;
                  return (
                    <div key={`${r}-${c}`} style={{
                      width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)',
                      borderRadius: 'var(--radius-sm)',
                      background: isTarget ? 'rgba(255, 171, 74, 0.22)' : cell ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                      border: isTarget ? '2px solid var(--accent-amber)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: isTarget ? 'var(--accent-amber)' : 'var(--text-primary)'
                    }}>
                      {isTarget ? (currentAnswer || '?') : cell}
                    </div>
                  );
                }))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              {['A', 'B', 'C', 'D', 'E'].map(letter => (
                <button
                  key={letter}
                  onClick={() => handleSelectAnswer(letter)}
                  style={{
                    width: 48, height: 44, borderRadius: 'var(--radius-md)',
                    fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    background: currentAnswer === letter ? 'rgba(82, 156, 202, 0.25)' : 'var(--bg-canvas)',
                    border: currentAnswer === letter ? '2px solid var(--accent-blue)' : '1px solid var(--border-default)',
                    color: currentAnswer === letter ? 'var(--accent-blue)' : 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Math Equations: 2-Column Vertical Layout */}
        {currentQ.type === 'math_equations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="badge badge-blue" style={{ fontSize: 10.5 }}>Mathematical Equations</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '6px 0 0 0' }}>{currentQ.questionText}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Variables are integers between 1 and 20. Solve mentally without scratchpad.</p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 20,
              alignItems: 'start'
            }}>
              {/* Left: Strictly Vertical Equations Column */}
              <div style={{
                background: 'var(--bg-canvas)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
                  Equation System:
                </span>
                {currentQ.equations.map((eq, i) => (
                  <div key={i} style={{
                    fontSize: 17,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <span style={{ fontSize: 11, color: 'var(--accent-blue)', background: 'rgba(82, 156, 202, 0.15)', padding: '2px 6px', borderRadius: 10 }}>({i + 1})</span>
                    <span>{eq}</span>
                  </div>
                ))}
              </div>

              {/* Right: Answer Choices */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  Select Value for {currentQ.targetVariable}:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {currentQ.options.map(val => (
                    <button
                      key={val}
                      onClick={() => handleSelectAnswer(val)}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        background: currentAnswer === val ? 'rgba(82, 156, 202, 0.25)' : 'var(--bg-canvas)',
                        border: currentAnswer === val ? '2px solid var(--accent-blue)' : '1px solid var(--border-default)',
                        color: currentAnswer === val ? 'var(--accent-blue)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {currentQ.targetVariable} = {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Figure Sequences: Official 4x4 Dual-Matrix Specification */}
        {currentQ.type === 'figure_sequences' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="badge badge-purple" style={{ fontSize: 10.5 }}>Subtest 1 · Figure Sequences (Official 4×4 Matrix)</span>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 0 0' }}>Determine the next two matrices: Image 1 and Image 2</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Select the matching matrix for Image 1 and Image 2 below.</p>
            </div>

            {/* Sequence 1 to 4 + Targets (Never wraps) */}
            <div style={{
              background: 'var(--bg-canvas)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'nowrap',
              overflowX: 'auto'
            }}>
              {currentQ.sequence?.map((matrix, idx) => (
                <React.Fragment key={idx}>
                  <Matrix4x4 matrix={matrix} size={86} label={`Matrix ${idx + 1}`} />
                  <ArrowRight size={14} color="rgba(255,255,255,0.25)" />
                </React.Fragment>
              ))}
              <Matrix4x4 isTarget size={86} label="Image 1 (?)" />
              <ArrowRight size={14} color="rgba(255,255,255,0.25)" />
              <Matrix4x4 isTarget size={86} label="Image 2 (?)" />
            </div>

            {/* Dual Matrix Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Image 1 selection */}
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-amber)' }}>
                  1. Select Image 1:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {currentQ.image1?.options.map((optMatrix, optIdx) => {
                    const isSelected = currentAnswer?.img1 === optIdx;
                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectFigure('img1', optIdx)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Matrix4x4
                          matrix={optMatrix}
                          size={75}
                          label={`Matrix ${optIdx + 1}`}
                          isSelected={isSelected}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Image 2 selection */}
              <div style={{ background: 'var(--bg-canvas)', padding: '14px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-amber)' }}>
                  2. Select Image 2:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {currentQ.image2?.options.map((optMatrix, optIdx) => {
                    const isSelected = currentAnswer?.img2 === optIdx;
                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectFigure('img2', optIdx)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Matrix4x4
                          matrix={optMatrix}
                          size={75}
                          label={`Matrix ${optIdx + 1}`}
                          isSelected={isSelected}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Academic Module: Passage Split View */}
        {currentQ.type === 'academic' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'start' }}>
            {/* Left: Reading Passage & Table */}
            <div style={{
              background: 'var(--bg-canvas)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              maxHeight: 460,
              overflowY: 'auto'
            }}>
              <div>
                <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent-amber)', fontWeight: 600 }}>
                  {currentQ.passageField} · Passage {currentQ.passageIndex}
                </span>
                <h4 style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0 0' }}>
                  {currentQ.passageTitle}
                </h4>
              </div>

              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                {currentQ.passageText}
              </div>

              {currentQ.passageTable && (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {currentQ.passageTable.headers.map((h, hi) => (
                          <th key={hi} style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentQ.passageTable.rows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {row.map((c, ci) => (
                            <td key={ci} style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Question & Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span className="badge badge-amber" style={{ fontSize: 10 }}>
                  Question {currentQ.questionInPassage} of {currentQ.totalInPassage} in Passage
                </span>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: '6px 0 0 0', lineHeight: 1.45 }}>
                  {currentQ.prompt}
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentQ.options?.map(opt => {
                  const isSelected = currentAnswer === opt.label;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSelectAnswer(opt.label)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'rgba(82, 156, 202, 0.2)' : 'var(--bg-canvas)',
                        border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--border-default)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        fontSize: 12,
                        lineHeight: 1.4,
                        color: 'var(--text-primary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: isSelected ? 'var(--accent-blue)' : 'rgba(255,255,255,0.08)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10.5, fontWeight: 700, flexShrink: 0
                      }}>
                        {opt.label}
                      </span>
                      <span>{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Navigation bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-ghost"
              onClick={handleExitClick}
              style={{ fontSize: 12, color: 'var(--accent-red)' }}
            >
              Exit Mock Exam
            </button>

            <button
              className="btn btn-secondary"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(currentIdx - 1)}
              style={{ opacity: currentIdx === 0 ? 0.4 : 1, fontSize: 12.5 }}
            >
              Previous Question
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleNext}
            style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg, #2383e2, #529cca)' }}
          >
            <span>{isLast ? 'Finish & View Scorecard' : 'Next Question'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      <ExitConfirmationModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onConfirm={handleConfirmExit}
        sectionTitle="Official dMAT Mock Exam"
      />
    </div>
  );
}
