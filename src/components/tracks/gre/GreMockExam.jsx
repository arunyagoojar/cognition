import React, { useState, useEffect } from 'react';
import { Clock, Calculator, ArrowRight, ArrowLeft, Bookmark, AlertTriangle, CheckCircle2, XCircle, Award, Sparkles, BookOpen, ShieldAlert, BarChart3, Table as TableIcon, MousePointer } from 'lucide-react';
import { getVerbalSection } from '../../../utils/gre/greVerbalPool';
import { getQuantSection, QC_CHOICES } from '../../../utils/gre/greQuantPool';
import { getRandomIssuePrompt } from '../../../utils/gre/greWritingPool';
import GreCalculator from './GreCalculator';
import { saveGreScore } from '../../../utils/storage';

// 5 Official GRE Sections (1 Analytical Writing, 2 Verbal Reasoning, 2 Quantitative Reasoning)
const SECTIONS = [
  { id: 'awa', title: 'Section 1: Analytical Writing', type: 'writing', count: 1, duration: 30 * 60, name: 'Analytical Writing (Analyze an Issue)' },
  { id: 'v1',  title: 'Section 2: Verbal Reasoning 1', type: 'verbal',  count: 12, duration: 18 * 60, name: 'Verbal Section 1' },
  { id: 'q1',  title: 'Section 3: Quantitative Reasoning 1', type: 'quant', count: 12, duration: 21 * 60, name: 'Quantitative Section 1' },
  { id: 'v2',  title: 'Section 4: Verbal Reasoning 2', type: 'verbal',  count: 15, duration: 23 * 60, name: 'Verbal Section 2' },
  { id: 'q2',  title: 'Section 5: Quantitative Reasoning 2', type: 'quant', count: 15, duration: 26 * 60, name: 'Quantitative Section 2' },
];

export default function GreMockExam({ onExit }) {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [isIntro, setIsIntro] = useState(true); // Pre-section instruction screen
  const [isFinished, setIsFinished] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);

  // Section 1 Writing State
  const [writingPrompt] = useState(() => getRandomIssuePrompt());
  const [essayText, setEssayText] = useState('');
  const [writingScore, setWritingScore] = useState(null);

  // Verbal & Quant Questions
  const [v1Questions] = useState(() => getVerbalSection(12));
  const [q1Questions] = useState(() => getQuantSection(12));
  const [v2Questions] = useState(() => getVerbalSection(15));
  const [q2Questions] = useState(() => getQuantSection(15));

  // State within current section
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [sectionId_qId]: selection }
  const [marked, setMarked] = useState({});
  const [timeLeft, setTimeLeft] = useState(SECTIONS[0].duration);
  const [isTimeHidden, setIsTimeHidden] = useState(false);

  // Calculator
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  const curSec = SECTIONS[sectionIndex];

  const getActiveQuestionSet = () => {
    if (curSec.id === 'v1') return v1Questions;
    if (curSec.id === 'q1') return q1Questions;
    if (curSec.id === 'v2') return v2Questions;
    if (curSec.id === 'q2') return q2Questions;
    return [];
  };

  const activeQuestions = getActiveQuestionSet();
  const currentQ = activeQuestions[currentQIndex];

  // Timer
  useEffect(() => {
    if (isFinished || isIntro) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNextSection();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, isIntro, sectionIndex]);

  // Section advancement
  const handleStartSection = () => {
    setIsIntro(false);
    setCurrentQIndex(0);
    setTimeLeft(curSec.duration);
    setIsCalcOpen(false);
    setShowReviewScreen(false);
  };

  const handleNextSection = () => {
    if (sectionIndex < SECTIONS.length - 1) {
      setSectionIndex(prev => prev + 1);
      setIsIntro(true);
      setCurrentQIndex(0);
      setTimeLeft(SECTIONS[sectionIndex + 1].duration);
      setShowReviewScreen(false);
    } else {
      finishMockExam();
    }
  };

  // Selection handlers
  const handleSelectBlank = (bIdx, opt) => {
    const key = `${curSec.id}_${currentQ.id}`;
    const prev = answers[key] || {};
    setAnswers({ ...answers, [key]: { ...prev, [bIdx]: opt } });
  };

  const handleToggleSentenceEq = (opt) => {
    const key = `${curSec.id}_${currentQ.id}`;
    const currentList = answers[key] || [];
    let updated;
    if (currentList.includes(opt)) {
      updated = currentList.filter(o => o !== opt);
    } else {
      updated = currentList.length >= 2 ? [currentList[1], opt] : [...currentList, opt];
    }
    setAnswers({ ...answers, [key]: updated });
  };

  const handleSelectRcOrQuantChoice = (opt) => {
    const key = `${curSec.id}_${currentQ.id}`;
    if (currentQ.type === 'reading_comprehension_multi' || currentQ.type === 'multi_choice') {
      const currentList = answers[key] || [];
      const updated = currentList.includes(opt)
        ? currentList.filter(o => o !== opt)
        : [...currentList, opt];
      setAnswers({ ...answers, [key]: updated });
    } else {
      setAnswers({ ...answers, [key]: opt });
    }
  };

  const handleSelectSentence = (sentenceIdx) => {
    const key = `${curSec.id}_${currentQ.id}`;
    setAnswers({ ...answers, [key]: sentenceIdx });
  };

  const handleNumericInput = (val) => {
    const key = `${curSec.id}_${currentQ.id}`;
    setAnswers({ ...answers, [key]: val });
  };

  const handleFractionInput = (part, val) => {
    const key = `${curSec.id}_${currentQ.id}`;
    const prev = answers[key] || { num: '', den: '' };
    setAnswers({
      ...answers,
      [key]: { ...prev, [part]: val }
    });
  };

  const toggleMark = () => {
    const key = `${curSec.id}_${currentQ.id}`;
    setMarked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isQuestionAnswered = (q) => {
    const key = `${curSec.id}_${q.id}`;
    const ans = answers[key];
    if (ans === undefined || ans === null || ans === '') return false;
    if (q.type && q.type.startsWith('text_completion')) {
      return q.blanks.every((b, idx) => ans[idx] !== undefined);
    }
    if (q.type === 'sentence_equivalence') {
      return Array.isArray(ans) && ans.length === 2;
    }
    if (q.type === 'reading_comprehension_multi' || q.type === 'multi_choice') {
      return Array.isArray(ans) && ans.length > 0;
    }
    if (q.type === 'reading_comprehension_select_passage') {
      return typeof ans === 'number';
    }
    if (q.type === 'numeric_entry_fraction') {
      return ans && ans.num !== undefined && ans.num.trim() !== '' && ans.den !== undefined && ans.den.trim() !== '';
    }
    return true;
  };

  const gradeMockQuestion = (secId, q) => {
    const key = `${secId}_${q.id}`;
    const userAns = answers[key];
    if (userAns === undefined || userAns === null || userAns === '') return false;

    if (q.type && q.type.startsWith('text_completion')) {
      return q.blanks.every((b, idx) => userAns[idx] === b.answer);
    }
    if (q.type === 'sentence_equivalence') {
      if (!Array.isArray(userAns) || userAns.length !== 2) return false;
      const sortedUser = [...userAns].sort();
      const sortedCorrect = [...q.answers].sort();
      return sortedUser[0] === sortedCorrect[0] && sortedUser[1] === sortedCorrect[1];
    }
    if (q.type === 'reading_comprehension_multi' || q.type === 'multi_choice') {
      if (!Array.isArray(userAns)) return false;
      const sortedUser = [...userAns].sort();
      const sortedCorrect = [...q.answers].sort();
      return sortedUser.length === sortedCorrect.length && sortedUser.every((val, i) => val === sortedCorrect[i]);
    }
    if (q.type === 'reading_comprehension_select_passage') {
      return userAns === q.targetSentenceIndex;
    }
    if (q.type === 'numeric_entry') {
      const cleanUser = String(userAns).trim().replace(/,/g, '');
      if (q.acceptedAnswers) {
        return q.acceptedAnswers.map(a => String(a).trim().replace(/,/g, '')).includes(cleanUser);
      }
      return cleanUser === String(q.answer).trim();
    }
    if (q.type === 'numeric_entry_fraction') {
      if (!userAns || typeof userAns !== 'object') return false;
      const userNum = String(userAns.num || '').trim();
      const userDen = String(userAns.den || '').trim();
      const correctNum = String(q.numerator).trim();
      const correctDen = String(q.denominator).trim();
      const numMatches = userNum.toLowerCase() === correctNum.toLowerCase() ||
        (q.acceptedNumerator && q.acceptedNumerator.map(n => n.toLowerCase()).includes(userNum.toLowerCase()));
      return numMatches && userDen === correctDen;
    }
    return userAns === q.answer;
  };

  const finishMockExam = () => {
    let vCorrect = 0;
    v1Questions.forEach(q => { if (gradeMockQuestion('v1', q)) vCorrect++; });
    v2Questions.forEach(q => { if (gradeMockQuestion('v2', q)) vCorrect++; });

    let qCorrect = 0;
    q1Questions.forEach(q => { if (gradeMockQuestion('q1', q)) qCorrect++; });
    q2Questions.forEach(q => { if (gradeMockQuestion('q2', q)) qCorrect++; });

    const totalVerbalQs = 27;
    const totalQuantQs = 27;

    const verbalScaled = Math.round(130 + (vCorrect / totalVerbalQs) * 40);
    const quantScaled = Math.round(130 + (qCorrect / totalQuantQs) * 40);
    const totalScaled = verbalScaled + quantScaled;

    saveGreScore('mock', {
      verbalCorrect: vCorrect,
      verbalTotal: totalVerbalQs,
      verbalScaled,
      quantCorrect: qCorrect,
      quantTotal: totalQuantQs,
      quantScaled,
      totalScaled,
      writingScore: writingScore,
      scaledScore: totalScaled,
      completed: true,
      completedAt: new Date().toISOString()
    });

    setIsFinished(true);
    setShowReviewScreen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    const scrollables = document.querySelectorAll('.main-content, .gre-exam-container, html, body');
    scrollables.forEach(el => { if (el) el.scrollTop = 0; });
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // ── Final Mock Exam Scaled Scorecard ───────────────────────────────────────
  if (isFinished) {
    let vCorrect = 0;
    v1Questions.forEach(q => { if (gradeMockQuestion('v1', q)) vCorrect++; });
    v2Questions.forEach(q => { if (gradeMockQuestion('v2', q)) vCorrect++; });

    let qCorrect = 0;
    q1Questions.forEach(q => { if (gradeMockQuestion('q1', q)) qCorrect++; });
    q2Questions.forEach(q => { if (gradeMockQuestion('q2', q)) qCorrect++; });

    const verbalScaled = Math.round(130 + (vCorrect / 27) * 40);
    const quantScaled = Math.round(130 + (qCorrect / 27) * 40);
    const totalScaled = verbalScaled + quantScaled;

    const percentile = Math.min(99, Math.max(1, Math.round(((totalScaled - 260) / 80) * 98 + 1)));

    return (
      <div className="exam-centered-result-view">
        <div style={{ maxWidth: 920, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(144, 101, 176, 0.18), rgba(82, 156, 202, 0.16))',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-purple">Official 5-Section GRE Format</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>1 Issue Task + 54 Timed Questions</span>
            </div>

            <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.6, margin: 0 }}>
              Official GRE® Scaled Score Report
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 640, margin: 0, lineHeight: 1.5 }}>
              Standard ETS calibration based on performance across Analytical Writing (0.0–6.0), Verbal Reasoning (130–170), and Quantitative Reasoning (130–170).
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
              {/* Total Composite */}
              <div style={{
                background: 'rgba(0,0,0,0.35)',
                border: '2px solid var(--accent-purple)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 30px',
                minWidth: 190
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.6 }}>
                  Total GRE Score
                </div>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {totalScaled}
                </div>
                <div style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 600 }}>
                  Top {100 - percentile}% ({percentile}th %ile)
                </div>
              </div>

              {/* Analytical Writing */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 26px',
                minWidth: 170
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Analytical Writing
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {writingScore !== null ? writingScore.toFixed(1) : 'Skipped'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Scale: 0.0–6.0
                </div>
              </div>

              {/* Verbal Reasoning */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 26px',
                minWidth: 170
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Verbal Reasoning
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {verbalScaled}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {vCorrect} / 27 (130–170)
                </div>
              </div>

              {/* Quantitative Reasoning */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 26px',
                minWidth: 170
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Quantitative Reasoning
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)', margin: '4px 0' }}>
                  {quantScaled}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {qCorrect} / 27 (130–170)
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={onExit} style={{ padding: '12px 32px', fontSize: 15 }}>
              <span>Return to GRE Studio Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Section Transition Intro Screen ───────────────────────────────────────
  if (isIntro) {
    return (
      <div className="gre-exam-container">
        <div style={{ maxWidth: 720, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${curSec.type === 'writing' ? 'badge-amber' : curSec.type === 'verbal' ? 'badge-purple' : 'badge-blue'}`}>{curSec.title}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Section {sectionIndex + 1} of {SECTIONS.length}
              </span>
            </div>

            <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
              {curSec.name}
            </h2>

            <div style={{ display: 'flex', gap: 20, background: 'rgba(0,0,0,0.25)', padding: '14px 20px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Allotted Time</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {Math.floor(curSec.duration / 60)} minutes
                </div>
              </div>
              <div style={{ width: 1, background: 'var(--border-subtle)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Number of Tasks</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {curSec.count} {curSec.type === 'writing' ? 'Essay Task' : 'Questions'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {curSec.type === 'writing' ? (
                <div>
                  <p style={{ margin: 0 }}>This section consists of one <strong>Analyze an Issue</strong> task. You will have 30 minutes to plan and compose a response evaluating the presented topic.</p>
                  <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12.5, margin: 0 }}>
                    A successful response articulates a clear thesis, supports claims with specific examples, and addresses counterarguments. You can also skip this section to proceed directly to the multiple choice sections.
                  </p>
                </div>
              ) : curSec.type === 'verbal' ? (
                <p style={{ margin: 0 }}>This section consists of Text Completion, Sentence Equivalence, Reading Comprehension, and Critical Reasoning questions. You may mark questions for review and navigate backward and forward within this section.</p>
              ) : (
                <p style={{ margin: 0 }}>This section consists of Quantitative Comparison, Problem Solving, Numeric Entry, and Data Interpretation questions. An on-screen standard ETS calculator is accessible via the top navigation bar.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleStartSection} style={{ padding: '10px 24px' }}>
                <span>Start {curSec.name}</span> <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Review Screen for active section ──────────────────────────────────────
  if (showReviewScreen) {
    return (
      <div className="gre-exam-container">
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-default)', paddingBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review Questions — {curSec.name}</h2>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                Click any row to return directly to that question.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => setShowReviewScreen(false)}>
              <ArrowLeft size={14} /> <span>Return to Question</span>
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 18px' }}>Number</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px' }}>Marked</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeQuestions.map((q, idx) => {
                  const answered = isQuestionAnswered(q);
                  const isMarked = marked[`${curSec.id}_${q.id}`];

                  return (
                    <tr
                      key={q.id}
                      onClick={() => {
                        setCurrentQIndex(idx);
                        setShowReviewScreen(false);
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: currentQIndex === idx ? 'rgba(82, 156, 202, 0.12)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '12px 18px', fontWeight: 600 }}>Question {idx + 1}</td>
                      <td style={{ padding: '12px 18px', color: answered ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {answered ? 'Answered' : 'Not Answered'}
                      </td>
                      <td style={{ padding: '12px 18px', color: isMarked ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                        {isMarked ? '✓ Marked' : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        Go to Q{idx + 1} ➔
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleNextSection} style={{ padding: '10px 24px' }}>
              <span>{sectionIndex < SECTIONS.length - 1 ? 'End Section & Proceed' : 'Finish GRE Mock Exam'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Analytical Writing Active Interface ──────────────────────────────────
  if (curSec.type === 'writing') {
    const wordCount = essayText.trim() ? essayText.trim().split(/\s+/).length : 0;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const handleSkipWriting = () => {
      setWritingScore(null);
      handleNextSection();
    };

    const handleSubmitWriting = () => {
      let score = 3.0;
      if (wordCount < 15) {
        score = 0.0;
      } else {
        if (wordCount >= 450) score += 1.5;
        else if (wordCount >= 350) score += 1.0;
        else if (wordCount >= 250) score += 0.5;

        const paragraphs = essayText.trim() ? essayText.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
        if (paragraphs >= 4) score += 1.0;
        else if (paragraphs >= 3) score += 0.5;

        const markers = ['however', 'moreover', 'furthermore', 'nevertheless', 'consequently', 'paradoxical', 'inherent', 'substantiate', 'fundamental', 'compelling'];
        const matched = markers.filter(m => essayText.toLowerCase().includes(m));
        if (matched.length >= 3) score += 0.5;

        score = Math.min(6.0, Math.max(1.0, Math.round(score * 2) / 2));
      }
      setWritingScore(score);
      handleNextSection();
    };

    return (
      <div className="gre-exam-container">
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Header Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setShowExitModal(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ArrowLeft size={14} /> <span>Exit</span>
              </button>
              <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Section 1 of 5: Analytical Writing (Analyze an Issue)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => setIsTimeHidden(!isTimeHidden)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
              >
                {isTimeHidden ? 'Show Time' : 'Hide Time'}
              </button>
              {!isTimeHidden && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: timeLeft < 300 ? 'var(--accent-red)' : 'var(--text-primary)',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '4px 10px',
                  borderRadius: 6
                }}>
                  <Clock size={13} />
                  <span>{timeFormatted}</span>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Words: <strong style={{ color: 'var(--text-primary)' }}>{wordCount}</strong>
              </div>
            </div>
          </div>

          {/* Issue Prompt Card */}
          <div className="card" style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-amber" style={{ fontSize: 11 }}>Analyze an Issue Task</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{writingPrompt.topic}</span>
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.55,
              color: 'var(--text-primary)',
              background: 'rgba(255,255,255,0.03)',
              padding: '14px 18px',
              borderRadius: 8,
              borderLeft: '3px solid var(--accent-amber)'
            }}>
              "{writingPrompt.prompt || writingPrompt.claim}"
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {writingPrompt.instructions || writingPrompt.instruction}
            </div>
          </div>

          {/* Essay Editor */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Compose your response here. Articulate a clear thesis, support your claims with reasons and examples, and address opposing perspectives..."
              rows={16}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 14.5,
                lineHeight: 1.7,
                fontFamily: 'var(--font-system)',
                resize: 'vertical'
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <button
                className="btn btn-secondary"
                onClick={handleSkipWriting}
                style={{ padding: '8px 16px', fontSize: 12.5 }}
              >
                <span>Skip Writing → Go to Section 2 (Verbal) ➔</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSubmitWriting}
                disabled={wordCount < 40}
                style={{ padding: '8px 22px', fontSize: 13 }}
              >
                <span>Submit Essay & Proceed to Section 2</span> <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* High-contrast exit confirmation modal */}
          {showExitModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 20
            }}>
              <div className="card" style={{
                maxWidth: 440,
                width: '100%',
                padding: '28px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(224, 62, 62, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#e03e3e', flexShrink: 0
                  }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Exit GRE Mock Exam?</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress will be discarded</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Are you sure you want to exit the mock exam? Your progress will be discarded.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setShowExitModal(false)} style={{ padding: '8px 16px' }}>
                    Cancel & Resume
                  </button>
                  <button onClick={onExit} className="btn-danger-solid" style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)' }}>
                    <span>Discard & Exit</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active Mock Question View ─────────────────────────────────────────────
  return (
    <div className="gre-exam-container">
      {/* On-Screen Calculator */}
      <GreCalculator
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
        onTransferDisplay={(val) => {
          if (currentQ && currentQ.type === 'numeric_entry') {
            handleNumericInput(val);
          }
        }}
      />

      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Official Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowExitModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6
              }}
            >
              <ArrowLeft size={14} /> <span>Exit Test</span>
            </button>
            <div style={{ height: 16, width: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {curSec.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Calculator in Quant Sections */}
            {curSec.type === 'quant' && (
              <button
                onClick={() => setIsCalcOpen(prev => !prev)}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-pill)',
                  border: isCalcOpen ? '1px solid var(--accent-blue)' : '1px solid var(--border-default)',
                  background: isCalcOpen ? 'rgba(82, 156, 202, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                  color: isCalcOpen ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 600
                }}
              >
                <Calculator size={13} />
                <span>Calculator</span>
              </button>
            )}

            {/* Timer with Hide Time toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setIsTimeHidden(prev => !prev)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
              >
                {isTimeHidden ? 'Show Time' : 'Hide Time'}
              </button>
              {!isTimeHidden && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: timeLeft < 180 ? '#ffffff' : 'var(--text-primary)',
                  background: timeLeft < 180 ? 'var(--accent-red)' : 'rgba(0,0,0,0.3)',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: timeLeft < 180 ? 'none' : '1px solid var(--border-subtle)'
                }}>
                  <Clock size={13} />
                  <span>{timeFormatted}</span>
                </div>
              )}
            </div>

            {/* Mark Button */}
            {currentQ && (
              <button
                onClick={toggleMark}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-pill)',
                  border: marked[`${curSec.id}_${currentQ.id}`] ? '1px solid var(--accent-amber)' : '1px solid var(--border-default)',
                  background: marked[`${curSec.id}_${currentQ.id}`] ? 'rgba(255, 171, 74, 0.18)' : 'transparent',
                  color: marked[`${curSec.id}_${currentQ.id}`] ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <Bookmark size={13} fill={marked[`${curSec.id}_${currentQ.id}`] ? 'var(--accent-amber)' : 'none'} />
                <span>{marked[`${curSec.id}_${currentQ.id}`] ? 'Marked' : 'Mark'}</span>
              </button>
            )}

            {/* Review Button */}
            <button
              onClick={() => setShowReviewScreen(true)}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-default)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Review ({Object.keys(answers).filter(k => k.startsWith(curSec.id)).length}/{curSec.count})
            </button>
          </div>
        </div>

        {/* Question Card */}
        <div className="card" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: curSec.type === 'verbal' ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
              Question {currentQIndex + 1} of {curSec.count}
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 11 }}>
              {currentQ.category}
            </span>
          </div>

          {/* Reading Comprehension Standard Passage */}
          {currentQ.passage && (
            <div style={{
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              maxHeight: 260,
              overflowY: 'auto'
            }}>
              {currentQ.passageTitle && (
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 14 }}>
                  {currentQ.passageTitle}
                </div>
              )}
              {currentQ.passage}
            </div>
          )}

          {/* Select-in-Passage Interactive Passage Card */}
          {currentQ.type === 'reading_comprehension_select_passage' && currentQ.sentences && (
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              fontSize: 14.5,
              lineHeight: 1.75,
              color: 'var(--text-secondary)'
            }}>
              {currentQ.passageTitle && (
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, fontSize: 14 }}>
                  {currentQ.passageTitle}
                </div>
              )}
              {currentQ.sentences.map((sent, sIdx) => {
                const isSelected = answers[`${curSec.id}_${currentQ.id}`] === sIdx;
                return (
                  <span
                    key={sIdx}
                    onClick={() => handleSelectSentence(sIdx)}
                    className={`gre-sentence-span${isSelected ? ' selected' : ''}`}
                    title="Click to select this sentence"
                  >
                    {sent}{' '}
                  </span>
                );
              })}
            </div>
          )}

          {/* Quantitative Context */}
          {currentQ.context && (
            <div style={{
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              fontSize: 14.5,
              fontWeight: 500,
              color: 'var(--text-primary)'
            }}>
              {currentQ.context}
            </div>
          )}

          {/* Quantitative Comparison Grid */}
          {currentQ.type === 'quant_comparison' && (
            <div className="gre-qc-grid">
              <div className="gre-qc-card">
                <span className="gre-qc-header">Quantity A</span>
                <span className="gre-qc-value">{currentQ.quantityA}</span>
              </div>
              <div className="gre-qc-card">
                <span className="gre-qc-header">Quantity B</span>
                <span className="gre-qc-value">{currentQ.quantityB}</span>
              </div>
            </div>
          )}

          {/* Data Interpretation Visuals */}
          {currentQ.type === 'data_interpretation' && (
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentQ.graphType === 'bar_chart' ? <BarChart3 size={17} color="var(--accent-blue)" /> : <TableIcon size={17} color="var(--accent-green)" />}
                <span>{currentQ.datasetTitle}</span>
              </div>

              {currentQ.graphType === 'bar_chart' && (
                <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                  <svg width="100%" height="160" viewBox="0 0 540 160" style={{ display: 'block' }}>
                    <line x1="120" y1="20" x2="520" y2="20" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="55" x2="520" y2="55" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="90" x2="520" y2="90" stroke="rgba(255,255,255,0.06)" />
                    <line x1="120" y1="125" x2="520" y2="125" stroke="rgba(255,255,255,0.06)" />

                    {currentQ.tableData.map((d, dIdx) => {
                      const y = 15 + dIdx * 35;
                      const maxVal = 1600;
                      const w2018 = (d.y2018 / maxVal) * 380;
                      const w2024 = (d.y2024 / maxVal) * 380;

                      return (
                        <g key={d.source}>
                          <text x="110" y={y + 16} textAnchor="end" fontSize="11" fill="var(--text-secondary)">
                            {d.source.split(' ')[0]}
                          </text>
                          <rect x="120" y={y} width={w2018} height="12" rx="3" fill="#529cca" opacity="0.65" />
                          <text x={125 + w2018} y={y + 10} fontSize="10" fill="var(--text-muted)">{d.y2018}</text>
                          <rect x="120" y={y + 14} width={w2024} height="12" rx="3" fill="#529cca" />
                          <text x={125 + w2024} y={y + 24} fontSize="10" fill="#ffffff" fontWeight="600">{d.y2024}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              {currentQ.graphType === 'table' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '8px 12px' }}>Department</th>
                        <th style={{ padding: '8px 12px' }}>Faculty</th>
                        <th style={{ padding: '8px 12px' }}>Students</th>
                        <th style={{ padding: '8px 12px' }}>Grant Funding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentQ.tableData.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.dept}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.faculty}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.students}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>${row.grantMillions.toFixed(1)}M</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Question Prompt */}
          {currentQ.prompt && (
            <div style={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {currentQ.prompt}
            </div>
          )}

          {/* Text Completion Columns */}
          {currentQ.type && currentQ.type.startsWith('text_completion') && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${currentQ.blanks.length}, 1fr)`,
              gap: 16,
              marginTop: 6
            }}>
              {currentQ.blanks.map((blank, bIdx) => {
                const selectedOpt = (answers[`${curSec.id}_${currentQ.id}`] || {})[bIdx];
                return (
                  <div
                    key={bIdx}
                    style={{
                      background: 'rgba(0,0,0,0.22)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--accent-purple)'
                    }}>
                      {blank.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {blank.options.map(opt => {
                        const isSel = selectedOpt === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => handleSelectBlank(bIdx, opt)}
                            style={{
                              padding: '11px 14px',
                              textAlign: 'left',
                              fontSize: 13.5,
                              border: 'none',
                              borderBottom: '1px solid var(--border-subtle)',
                              background: isSel ? 'rgba(144, 101, 176, 0.22)' : 'transparent',
                              color: isSel ? '#ffffff' : 'var(--text-secondary)',
                              fontWeight: isSel ? 600 : 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <span style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                              background: isSel ? 'var(--accent-purple)' : 'transparent',
                              display: 'inline-block',
                              flexShrink: 0
                            }} />
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sentence Equivalence */}
          {currentQ.type === 'sentence_equivalence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Select the <strong style={{ color: 'var(--text-primary)' }}>TWO</strong> choices that complete the sentence and produce completed sentences alike in meaning.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {currentQ.options.map(opt => {
                  const selectedList = answers[`${curSec.id}_${currentQ.id}`] || [];
                  const isSel = selectedList.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleToggleSentenceEq(opt)}
                      style={{
                        padding: '11px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                        background: isSel ? 'rgba(144, 101, 176, 0.18)' : 'rgba(0,0,0,0.2)',
                        color: isSel ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isSel ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <span style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: `1.5px solid ${isSel ? 'var(--accent-purple)' : 'var(--border-default)'}`,
                        background: isSel ? 'var(--accent-purple)' : 'transparent',
                        display: 'inline-block',
                        flexShrink: 0
                      }} />
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Multiple Choice Options (Single, Multi, QC) */}
          {currentQ.options && currentQ.type !== 'sentence_equivalence' && !currentQ.type.startsWith('text_completion') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentQ.options.map((opt, oIdx) => {
                const isMulti = currentQ.type === 'reading_comprehension_multi' || currentQ.type === 'multi_choice';
                const userAns = answers[`${curSec.id}_${currentQ.id}`];
                const isSel = isMulti
                  ? Array.isArray(userAns) && userAns.includes(opt)
                  : userAns === opt;

                const accentColor = curSec.type === 'verbal' ? 'var(--accent-purple)' : 'var(--accent-blue)';

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectRcOrQuantChoice(opt)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${isSel ? accentColor : 'var(--border-default)'}`,
                      background: isSel ? (curSec.type === 'verbal' ? 'rgba(144, 101, 176, 0.16)' : 'rgba(82, 156, 202, 0.16)') : 'rgba(0,0,0,0.2)',
                      color: isSel ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: isSel ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      lineHeight: 1.5
                    }}
                  >
                    <span style={{
                      width: 15,
                      height: 15,
                      borderRadius: isMulti ? 3 : '50%',
                      border: `1.5px solid ${isSel ? accentColor : 'var(--border-default)'}`,
                      background: isSel ? accentColor : 'transparent',
                      display: 'inline-block',
                      flexShrink: 0
                    }} />
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Select-in-Passage Feedback */}
          {currentQ.type === 'reading_comprehension_select_passage' && (
            <div style={{
              background: answers[`${curSec.id}_${currentQ.id}`] !== undefined ? 'rgba(82, 156, 202, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px dashed ${answers[`${curSec.id}_${currentQ.id}`] !== undefined ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13
            }}>
              <MousePointer size={16} color={answers[`${curSec.id}_${currentQ.id}`] !== undefined ? 'var(--accent-blue)' : 'var(--text-muted)'} />
              {answers[`${curSec.id}_${currentQ.id}`] !== undefined ? (
                <span>
                  Selected: <strong style={{ color: '#ffffff' }}>Sentence {answers[`${curSec.id}_${currentQ.id}`] + 1}</strong>: "{currentQ.sentences[answers[`${curSec.id}_${currentQ.id}`]].slice(0, 80)}..."
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  Click directly on any sentence in the passage above to select it as your answer.
                </span>
              )}
            </div>
          )}

          {/* Numeric Entry (Single Box) */}
          {currentQ.type === 'numeric_entry' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <input
                type="text"
                value={answers[`${curSec.id}_${currentQ.id}`] || ''}
                onChange={(e) => handleNumericInput(e.target.value)}
                placeholder="Enter numeric value"
                style={{
                  width: 220,
                  padding: '10px 14px',
                  fontSize: 16,
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  background: 'var(--bg-input)',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => setIsCalcOpen(true)}
                style={{ padding: '8px 14px', fontSize: 12 }}
              >
                <Calculator size={13} /> <span>Open Calculator</span>
              </button>
            </div>
          )}

          {/* Numeric Entry (Fraction Boxes) */}
          {currentQ.type === 'numeric_entry_fraction' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
              <div className="gre-fraction-container">
                <input
                  type="text"
                  value={(answers[`${curSec.id}_${currentQ.id}`] || {}).num || ''}
                  onChange={(e) => handleFractionInput('num', e.target.value)}
                  placeholder="Num"
                  className="gre-fraction-input"
                />
                <div className="gre-fraction-divider" />
                <input
                  type="text"
                  value={(answers[`${curSec.id}_${currentQ.id}`] || {}).den || ''}
                  onChange={(e) => handleFractionInput('den', e.target.value)}
                  placeholder="Den"
                  className="gre-fraction-input"
                />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Enter numerator and denominator in lowest terms.
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentQIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQIndex === 0}
            style={{ visibility: currentQIndex === 0 ? 'hidden' : 'visible' }}
          >
            <ArrowLeft size={14} /> <span>Previous</span>
          </button>

          {currentQIndex < curSec.count - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentQIndex(prev => prev + 1)}
            >
              <span>Next</span> <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowReviewScreen(true)}
            >
              <span>Review & End Section</span>
            </button>
          )}
        </div>

        {/* High-Contrast Exit Confirmation Modal */}
        {showExitModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="card" style={{
              maxWidth: 440,
              width: '100%',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(224, 62, 62, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#e03e3e', flexShrink: 0
                }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Exit GRE Mock Exam?</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Progress will be discarded</span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to exit the mock exam? Your score will only be committed if you complete all four sections.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowExitModal(false)}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel & Resume
                </button>
                <button
                  onClick={onExit}
                  className="btn-danger-solid"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>Discard & Exit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
