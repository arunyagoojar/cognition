import { CONTENT_CATALOG } from '../../data/production/registry.js';
import { chooseFreshTest } from '../../utils/practiceSelection.js';
import WritingCoach from './WritingCoach.jsx';
import { readDraft, writeDraft } from '../../utils/drafts.js';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '../common/Icon';
import ScrollToTop from '../common/ScrollToTop';
import { getProductionWritingTest } from '../../data/production/adapters';
import { lintTextWithHarper, applyHarperFix } from '../../utils/harper/harperService';
import { analyzeRepetition, generateHabitInsights } from '../../utils/harper/repetitionService';
import { calculateHarperPracticeScore } from '../../utils/harper/scoringService';

const countWords = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

export default function HarperWritingPractice({ onBack }) {
  // State: 'choice' (Task 1 vs 2 picker) | 'practice' (writing workspace) | 'summary' (temporary score & habit report)
  const [savedDraft] = useState(() => readDraft('harper'));
  const [stage, setStage] = useState(() => savedDraft?.essayText ? 'practice' : 'choice');
  const [taskKind, setTaskKind] = useState(() => savedDraft?.taskKind || 2); // 1 or 2
  const [currentTask, setCurrentTask] = useState(() => savedDraft?.currentTask || null);
  const [essayText, setEssayText] = useState(() => savedDraft?.essayText || '');
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [harperResult, setHarperResult] = useState({
    issues: [],
    accuracyPercent: 100,
    errorFreeSentences: 0,
    totalSentences: 0,
  });
  const [repetitionData, setRepetitionData] = useState({
    repetitiveWords: [],
    lexicalDiversity: 100,
    repetitionScore: 100,
    totalWords: 0,
    uniqueWords: 0,
  });
  const [habitInsights, setHabitInsights] = useState([]);
  const [selectedWordSynonyms, setSelectedWordSynonyms] = useState(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState('grammar'); // 'grammar' | 'repetition' | 'habits'

  // Summary result state
  const [summaryResult, setSummaryResult] = useState(null);

  const debounceTimerRef = useRef(null);
  const analysisRevision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(debounceTimerRef.current); }; }, []);
  useEffect(() => { if (currentTask) writeDraft('harper', { taskKind, currentTask, essayText }); }, [taskKind, currentTask, essayText]);
  const targetWords = taskKind === 1 ? 150 : 250;
  const wordCount = countWords(essayText);
  const isTargetMet = wordCount >= targetWords;

  // Load a task based on taskKind
  const loadRandomTask = useCallback((kind) => {
    const id=chooseFreshTest(`harper-task-${kind}`, CONTENT_CATALOG.writing);
    const taskObj = getProductionWritingTest(id);
    setCurrentTask(taskObj);
    setSelectedWordSynonyms(null);
  }, []);

  // Handle task selection
  const handleSelectTask = (kind) => {
    analysisRevision.current++;
    setTaskKind(kind);
    loadRandomTask(kind);
    setEssayText('');
    setStage('practice');
  };

  // Run Harper & Repetition analysis (debounced)
  const runAnalysis = useCallback(async (text) => {
    const revision = ++analysisRevision.current;
    if (!text || !text.trim()) {
      setHarperResult({
        issues: [],
        accuracyPercent: 100,
        errorFreeSentences: 0,
        totalSentences: 0,
      });
      setRepetitionData({
        repetitiveWords: [],
        lexicalDiversity: 100,
        repetitionScore: 100,
        totalWords: 0,
        uniqueWords: 0,
      });
      setHabitInsights([]);
      return;
    }

    setIsAnalyzing(true);
    try {
      const [hResult, rData] = await Promise.all([
        lintTextWithHarper(text),
        Promise.resolve(analyzeRepetition(text)),
      ]);

      if (!mounted.current || revision !== analysisRevision.current) return;
      setHarperResult(hResult);
      setRepetitionData(rData);

      const insights = generateHabitInsights({
        grammarIssues: hResult.issues,
        repetitiveWords: rData.repetitiveWords,
        wordCount: hResult.wordCount,
        targetWords: taskKind === 1 ? 150 : 250,
        taskKind,
      });
      setHabitInsights(insights);
    } catch (err) {
      console.error('Harper live analysis error:', err);
    } finally {
      if (mounted.current && revision === analysisRevision.current) setIsAnalyzing(false);
    }
  }, [taskKind]);

  // Debounce text changes
  const handleTextChange = (e) => {
    const val = e.target.value;
    analysisRevision.current++;
    setEssayText(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runAnalysis(val);
    }, 280);
  };

  // One-click apply fix from Harper
  const handleApplyFix = (issue, replacement) => {
    const updated = applyHarperFix(essayText, issue, replacement);
    setEssayText(updated);
    runAnalysis(updated);
  };

  // Finish practice session and show summary
  const handleFinish = () => {
    if (wordCount === 0) {
      alert('Please write your response before submitting for summary.');
      return;
    }

    const scoreData = calculateHarperPracticeScore({
      taskKind,
      wordCount,
      grammarIssues: harperResult.issues,
      repetitionData,
      errorFreeSentences: harperResult.errorFreeSentences,
      totalSentences: harperResult.totalSentences,
    });

    setSummaryResult(scoreData);
    setStage('summary');
  };

  // Handle exit confirmation
  const handleExit = () => {
    if (stage === 'practice' && essayText.trim().length > 30) {
      if (window.confirm('Exit writing practice? Your draft is saved on this device.')) {
        onBack();
      }
    } else {
      onBack();
    }
  };

  /* ─────────────────────────────────────────────────────────────
     STAGE 1: TASK SELECTION CHOICE SCREEN
     ───────────────────────────────────────────────────────────── */
  if (stage === 'choice') {
    return (
      <div className="content-container">
        <ScrollToTop />
        <div className="harper-choice-hero">
          <div className="harper-header-nav">
            <button type="button" className="harper-back-btn" onClick={onBack}>
              <Icon name="arrow-left" size={16} />
              <span>Back to Dashboard</span>
            </button>
            <span className="pill-badge pill-black">
              <Icon name="sparkles" size={12} />
              <span>POWERED BY HARPER · OFFLINE &amp; PRIVATE</span>
            </span>
          </div>

          <div className="harper-choice-title-block">
            <div className="harper-scope-badge-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span className="pill-badge pill-black">
                <Icon name="sparkles" size={12} />
                <span>ON-DEVICE PRACTICE ENGINE</span>
              </span>
              <span className="pill-badge pill-coral">
                DIAGNOSTIC SCOPE: GRAMMAR &amp; VOCABULARY ONLY
              </span>
            </div>
            <h1 className="harper-main-heading">
              Practice Writing with Harper
            </h1>
            <p className="harper-main-sub">
              Target your mechanical writing habits with on-device <strong>Grammar Accuracy</strong>, <strong>Repetitive Word Tracking</strong>, and <strong>Word Count</strong>. Choose your task to begin:
            </p>
          </div>

          <div className="harper-task-grid">
            {/* Task 1 Choice Card */}
            <div
              className="harper-task-card is-task1"
              role="button"
              tabIndex={0}
              onClick={() => handleSelectTask(1)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectTask(1)}
            >
              <div className="harper-task-card-header">
                <span className="harper-task-tag">TASK 1</span>
                <span className="harper-task-time">~20 Mins · Min 150 Words</span>
              </div>
              <h2 className="harper-task-card-title">Academic Report</h2>
              <p className="harper-task-card-desc">
                Summarize, describe or explain visual data from line graphs, bar charts, pie charts, tables, maps, or cyclical process diagrams.
              </p>
              <div className="harper-task-card-features">
                <span className="harper-chip">✓ Trend vocabulary checks</span>
                <span className="harper-chip">✓ Passive voice accuracy</span>
                <span className="harper-chip">✓ Overview detection</span>
              </div>
              <button type="button" className="btn-coral-pill-physical" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
                <span>Practice Task 1</span>
                <span className="btn-arrow-icon">→</span>
              </button>
            </div>

            {/* Task 2 Choice Card */}
            <div
              className="harper-task-card is-task2"
              role="button"
              tabIndex={0}
              onClick={() => handleSelectTask(2)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelectTask(2)}
            >
              <div className="harper-task-card-header">
                <span className="harper-task-tag">TASK 2</span>
                <span className="harper-task-time">~40 Mins · Min 250 Words</span>
              </div>
              <h2 className="harper-task-card-title">Discursive Essay</h2>
              <p className="harper-task-card-desc">
                Write a formal academic essay presenting a clear thesis, developed body paragraphs, and supported arguments on contemporary social issues.
              </p>
              <div className="harper-task-card-features">
                <span className="harper-chip">✓ Repetitive argument words</span>
                <span className="harper-chip">✓ Academic collocations</span>
                <span className="harper-chip">✓ Complex sentence tracking</span>
              </div>
              <button type="button" className="btn-coral-pill-physical" style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}>
                <span>Practice Task 2</span>
                <span className="btn-arrow-icon">→</span>
              </button>
            </div>
          </div>

          <div className="harper-choice-footer-note">
            <Icon name="info" size={16} />
            <span>
              <strong>Diagnostic Scope:</strong> This practice session evaluates your grammar precision, lexical variety, and word count. It does not grade whether your response sticks to the prompt's central idea or develops cohesive arguments (an optional deep-dive AI review is available on the summary screen after submitting, or via full Mock Exams).
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     STAGE 3: TEMPORARY SCORE & SUMMARY REPORT SCREEN
     ───────────────────────────────────────────────────────────── */
  if (stage === 'summary' && summaryResult) {
    return (
      <div className="content-container">
        <ScrollToTop />
        <div className="harper-summary-screen">
          {/* Top Bar */}
          <div className="harper-header-nav">
            <button type="button" className="harper-back-btn" onClick={() => setStage('practice')}>
              <Icon name="arrow-left" size={16} />
              <span>Revise Draft</span>
            </button>
            <button type="button" className="harper-exit-btn" onClick={onBack}>
              <span>Return to Dashboard</span>
            </button>
          </div>

          {/* Hero Band Banner */}
          <div className="harper-summary-hero-card">
            <div className="harper-summary-top">
              <div>
                <span className="pill-badge pill-black">
                  PRACTICE DIAGNOSTIC · GRAMMAR &amp; VOCABULARY
                </span>
                <h1 className="harper-summary-title">
                  Task {taskKind} Writing Summary
                </h1>
                <p className="harper-summary-sub">
                  Analyzed by Harper on-device grammar engine and IELTS lexical variety scanner.
                </p>
              </div>

              <div className="harper-band-score-box">
                <span className="harper-band-label">WORDS IN THIS DRAFT</span>
                <div className="harper-band-number">{wordCount}</div>
                <span className="harper-band-scale">Local writing diagnostics</span>
              </div>
            </div>

            {/* Crucial Disclaimer */}
            <div className="harper-disclaimer-pill">
              <Icon name="info" size={16} />
              <span>
                <strong>Grammar &amp; Vocabulary Diagnostic:</strong> These local checks highlight writing mechanics. Use Review with AI for task response, paragraph development, cohesion, vocabulary, and grammar. Coaching does not change your overall band.
              </span>
            </div>

            {/* Metric Pills */}
            <div className="harper-metric-grid">
              <div className="harper-metric-item">
                <span className="harper-metric-title">Length</span>
                <strong className={`harper-metric-val ${isTargetMet ? 'is-good' : 'is-warn'}`}>
                  {wordCount} / {targetWords}
                </strong>
                <span className="harper-metric-sub">{isTargetMet ? 'Requirement Met' : 'Under Minimum'}</span>
              </div>

              <div className="harper-metric-item">
                <span className="harper-metric-title">Grammar Accuracy</span>
                <strong className="harper-metric-val is-good">
                  {summaryResult.errorFreeRatio}%
                </strong>
                <span className="harper-metric-sub">Error-Free Sentences</span>
              </div>

              <div className="harper-metric-item">
                <span className="harper-metric-title">Grammar Issues</span>
                <strong className={`harper-metric-val ${summaryResult.totalErrors === 0 ? 'is-good' : 'is-warn'}`}>
                  {summaryResult.totalErrors}
                </strong>
                <span className="harper-metric-sub">{summaryResult.totalErrors === 0 ? 'No issues flagged' : 'Issues flagged'}</span>
              </div>

              <div className="harper-metric-item">
                <span className="harper-metric-title">Overused Words</span>
                <strong className={`harper-metric-val ${summaryResult.repetitiveCount === 0 ? 'is-good' : 'is-warn'}`}>
                  {summaryResult.repetitiveCount}
                </strong>
                <span className="harper-metric-sub">{summaryResult.repetitiveCount === 0 ? 'Strong lexical range' : 'Words repeated 3+×'}</span>
              </div>
            </div>
          </div>

          {/* Diagnostic Takeaways */}
          <div className="harper-summary-details-grid">
            {/* Strengths */}
            <div className="harper-summary-card is-strengths">
              <div className="harper-card-header-row">
                <Icon name="check" size={18} style={{ color: 'var(--success-icon)' }} />
                <h3>Observed Strengths</h3>
              </div>
              <ul className="harper-bullets">
                {summaryResult.strengths.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            {/* Habit Focus Areas */}
            <div className="harper-summary-card is-focus">
              <div className="harper-card-header-row">
                <Icon name="sparkles" size={18} style={{ color: 'var(--c-coral)' }} />
                <h3>Habits to Correct Before Test Day</h3>
              </div>
              <ul className="harper-bullets">
                {summaryResult.focusAreas.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          </div>

          <WritingCoach text={essayText} task={currentTask?.[taskKind === 1 ? "task1" : "task2"]} taskKind={taskKind} testId={currentTask?.testId} />
          {/* Repetitive Words Breakdown */}
          {repetitionData.repetitiveWords.length > 0 && (
            <div className="harper-summary-card" style={{ marginTop: 24 }}>
              <h3>Repetitive Words &amp; Suggested Academic Synonyms</h3>
              <p className="harper-summary-card-sub">
                Consider these alternatives only when they preserve your intended meaning:
              </p>
              <div className="harper-synonym-table">
                {repetitionData.repetitiveWords.map((item) => (
                  <div key={item.word} className="harper-synonym-row">
                    <div className="harper-synonym-word-col">
                      <span className="harper-repeat-badge">
                        &ldquo;{item.word}&rdquo;
                      </span>
                      <span className="harper-count-tag">used {item.count} times</span>
                    </div>
                    <div className="harper-synonym-list-col">
                      {item.synonyms.length > 0 ? (
                        item.synonyms.map((syn) => (
                          <span key={syn} className="harper-syn-pill">{syn}</span>
                        ))
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          Rephrase with alternative sentence structures or nominalizations.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostic Scope Clarification Card */}
          <div className="harper-diagnostic-notice-card">
            <div className="harper-diagnostic-notice-head">
              <Icon name="info" size={18} />
              <h4>Understanding your writing feedback</h4>
            </div>
            <p className="harper-diagnostic-notice-p">
              This Harper practice session specifically coaches your on-device <strong>Grammar Accuracy</strong>, <strong>Repetitive Word Habits</strong>, and <strong>Word Count</strong>. These immediate checks run locally. The optional AI review also considers idea development, prompt relevance, and cohesion.
            </p>
            <p className="harper-diagnostic-notice-p" style={{ marginBottom: 0 }}>
              Qualitative IELTS criteria like <strong>Task Achievement / Response</strong> (answering all parts of the question, sticking to the topic) and <strong>Coherence &amp; Cohesion</strong> (paragraph flow and argumentation) are included in <strong>Review with AI</strong>. AI coaching remains separate from your full-test band.
            </p>
          </div>

          {/* Bottom Actions */}
          <div className="harper-summary-actions">
            <button
              type="button"
              className="harper-action-btn is-secondary"
              onClick={() => setStage('choice')}
            >
              <span>Practice Another Task</span>
            </button>
            <button
              type="button"
              className="harper-action-btn is-primary"
              onClick={onBack}
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     STAGE 2: ACTIVE PRACTICE WRITING WORKSPACE
     ───────────────────────────────────────────────────────────── */
  const activeTask = taskKind === 1
    ? (currentTask?.task1 || currentTask)
    : (currentTask?.task2 || currentTask);

  const taskTitle = taskKind === 1 ? 'Task 1: Academic Report' : 'Task 2: Discursive Essay';
  const fullPromptHtml = activeTask?.promptHtml || null;
  const fullPromptText = activeTask?.prompt || activeTask?.instructions || currentTask?.prompt || 'No question prompt available.';

  return (
    <div className="harper-workspace-layout">
      <ScrollToTop />

      {/* ── 1. TOP NAVIGATION BAR ── */}
      <header className="harper-nav-header">
        <div className="harper-nav-left">
          <button type="button" className="harper-nav-back" onClick={handleExit} title="Exit Harper practice">
            <Icon name="arrow-left" size={16} />
            <span>Dashboard</span>
          </button>
          <div className="harper-nav-title-group">
            <span className="harper-nav-badge">
              HARPER PRACTICE · TASK {taskKind}
            </span>
            <h2 className="harper-nav-title">
              {currentTask?.title || taskTitle}
            </h2>
          </div>
        </div>
        <div className="harper-nav-right">
          {/* Random Prompt Button */}
          <button
            type="button"
            className="harper-prompt-random-btn"
            onClick={() => loadRandomTask(taskKind)}
            title="Load another random IELTS question"
          >
            <span>🎲 New Prompt</span>
          </button>

          {/* Finish & Get Summary */}
          <button
            type="button"
            className="harper-finish-btn"
            onClick={handleFinish}
            title="Finish practice and review your writing habits"
          >
            <span>Finish &amp; Summary</span>
            <span className="btn-arrow-icon">→</span>
          </button>
        </div>
      </header>

      {/* ── 2. PINNED QUESTION PROMPT (Always Visible) ── */}
      <div className="harper-pinned-prompt-container">
        <div className="harper-pinned-prompt-card">
          <div className="harper-prompt-header-row">
            <div className="harper-prompt-tag-group">
              <span className="harper-prompt-badge">
                {taskKind === 1 ? 'ACADEMIC REPORT PROMPT' : 'DISCURSIVE ESSAY PROMPT'}
              </span>
              <span className="harper-prompt-requirement">
                Write at least <strong>{targetWords} words</strong>
              </span>
            </div>

            <button
              type="button"
              className="harper-collapse-btn"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              aria-label={isPromptExpanded ? 'Collapse prompt' : 'Expand prompt'}
            >
              <span>{isPromptExpanded ? 'Minimize' : 'Expand Question'}</span>
              <Icon name={isPromptExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
            </button>
          </div>

          {isPromptExpanded && (
            <div className="harper-prompt-body">
              <div className="harper-prompt-text">
                {fullPromptHtml ? (
                  <span dangerouslySetInnerHTML={{ __html: fullPromptHtml }} />
                ) : (
                  fullPromptText
                )}
              </div>

              {/* Task 1 visual diagram/chart if present */}
              {taskKind === 1 && activeTask?.image?.file && (
                <div className={`harper-prompt-image-wrap ${isImageZoomed ? 'is-zoomed' : ''}`}>
                  <div className="harper-image-actions">
                    <button
                      type="button"
                      className="harper-zoom-btn"
                      onClick={() => setIsImageZoomed(!isImageZoomed)}
                      title={isImageZoomed ? 'Standard image size' : 'Enlarge chart for clarity'}
                    >
                      <Icon name={isImageZoomed ? 'eye' : 'sparkles'} size={14} />
                      <span>{isImageZoomed ? 'Standard Size' : '🔍 Enlarge Chart'}</span>
                    </button>
                  </div>
                  <img
                    src={activeTask.image.file}
                    alt="Task 1 visual chart"
                    className="harper-prompt-image"
                  />
                </div>
              )}

              {/* Task 1 visual table if present */}
              {taskKind === 1 && activeTask?.table && activeTask.table.rows && (
                <div className="harper-prompt-table-wrap">
                  {activeTask.table.caption && (
                    <div className="harper-table-caption">{activeTask.table.caption}</div>
                  )}
                  <table className="harper-prompt-table">
                    <tbody>
                      {activeTask.table.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) =>
                            rIdx === 0 ? <th key={cIdx}>{cell}</th> : <td key={cIdx}>{cell}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. MAIN SPLIT WORKSPACE: Writing Canvas (Left) | Harper Live Panel (Right) ── */}
      <div className="harper-split-panes">
        {/* LEFT: Writing Editor */}
        <div className="harper-pane-editor">
          <div className="harper-editor-toolbar">
            <div className="harper-word-count-chip">
              <span className="harper-chip-label">Word Count:</span>
              <strong className={`harper-chip-num ${isTargetMet ? 'is-met' : ''}`}>
                {wordCount} / {targetWords}
              </strong>
              {isTargetMet && (
                <span className="harper-chip-check">
                  <Icon name="check" size={13} />
                  <span>Target Met</span>
                </span>
              )}
            </div>

            <div className="harper-editor-meta">
              {isAnalyzing && (
                <span className="harper-live-indicator">
                  <span className="harper-pulsing-dot" />
                  <span>Checking…</span>
                </span>
              )}
              {essayText.trim().length > 0 && (
                <button
                  type="button"
                  className="harper-clear-btn"
                  onClick={() => {
                    if (window.confirm('Clear your current text?')) {
                      setEssayText('');
                      runAnalysis('');
                    }
                  }}
                >
                  Clear Text
                </button>
              )}
            </div>
          </div>

          <textarea
            className="harper-textarea-canvas"
            value={essayText}
            onChange={handleTextChange}
            placeholder={`Start writing your Task ${taskKind} response here…\n\nHarper is actively checking your grammar, mechanics, and word repetitions on the right panel as you write.`}
            spellCheck={false}
            autoFocus
          />
          <WritingCoach key={`${currentTask?.testId}:${taskKind}`} text={essayText} task={activeTask} taskKind={taskKind} testId={currentTask?.testId} />
        </div>

        {/* RIGHT: Live Harper Grammar & Repetition Sidebar */}
        <aside className="harper-pane-sidebar" aria-label="Harper Analysis">
          {/* Header Gauges */}
          <div className="harper-sidebar-gauges">
            <div className="harper-gauge-card">
              <span className="harper-gauge-label">Grammar Accuracy</span>
              <div className="harper-gauge-stat">
                <span className="harper-gauge-number">
                  {harperResult.accuracyPercent}%
                </span>
                <span className="harper-gauge-desc">
                  {harperResult.errorFreeSentences}/{harperResult.totalSentences} clean sentences
                </span>
              </div>
            </div>

            <div className="harper-gauge-card">
              <span className="harper-gauge-label">Vocabulary Variety</span>
              <div className="harper-gauge-stat">
                <span className="harper-gauge-number">
                  {repetitionData.lexicalDiversity}%
                </span>
                <span className="harper-gauge-desc">
                  {repetitionData.repetitiveWords.length} overused words
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="harper-sidebar-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === 'grammar'}
              className={`harper-tab-btn ${activeAnalysisTab === 'grammar' ? 'is-active' : ''}`}
              onClick={() => setActiveAnalysisTab('grammar')}
            >
              <span>Grammar ({harperResult.issues.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === 'repetition'}
              className={`harper-tab-btn ${activeAnalysisTab === 'repetition' ? 'is-active' : ''}`}
              onClick={() => setActiveAnalysisTab('repetition')}
            >
              <span>Repetition ({repetitionData.repetitiveWords.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeAnalysisTab === 'habits'}
              className={`harper-tab-btn ${activeAnalysisTab === 'habits' ? 'is-active' : ''}`}
              onClick={() => setActiveAnalysisTab('habits')}
            >
              <span>Habit Tips ({habitInsights.length})</span>
            </button>
          </div>

          {/* Tab 1: Grammar & Spelling Issues */}
          {activeAnalysisTab === 'grammar' && (
            <div className="harper-tab-content">
              {harperResult.issues.length === 0 ? (
                <div className="harper-empty-state">
                  <div className="harper-empty-icon">✓</div>
                  <h4>No Grammar Mistakes Detected</h4>
                  <p>
                    {essayText.trim().length > 30
                      ? 'Great job! Your current draft has no grammar or mechanical issues flagged by Harper.'
                      : 'Start typing on the left. Harper will automatically flag grammatical errors, typos, and agreement slips.'}
                  </p>
                </div>
              ) : (
                <div className="harper-issues-list">
                  {harperResult.issues.map((iss) => (
                    <div key={iss.id} className="harper-issue-card">
                      <div className="harper-issue-top">
                        <span className="harper-issue-badge" style={{ borderColor: iss.color }}>
                          {iss.category}
                        </span>
                        <span className="harper-issue-snippet">
                          &ldquo;{iss.snippet}&rdquo;
                        </span>
                      </div>

                      <p className="harper-issue-msg">{iss.message}</p>

                      {iss.suggestions.length > 0 && (
                        <div className="harper-suggestions-row">
                          <span className="harper-sug-label">Suggested fix:</span>
                          {iss.suggestions.slice(0, 3).map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              className="harper-apply-fix-btn"
                              onClick={() => handleApplyFix(iss, sug.replace)}
                              title={`Replace "${iss.snippet}" with "${sug.replace}"`}
                            >
                              <span>Apply &ldquo;{sug.replace}&rdquo;</span>
                              <span className="btn-arrow-icon">✓</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Repetitive Words & Academic Synonyms */}
          {activeAnalysisTab === 'repetition' && (
            <div className="harper-tab-content">
              {repetitionData.repetitiveWords.length === 0 ? (
                <div className="harper-empty-state">
                  <div className="harper-empty-icon">★</div>
                  <h4>High Vocabulary Diversity</h4>
                  <p>
                    No content words are repeated 3 or more times. Your lexical distribution looks balanced and academic.
                  </p>
                </div>
              ) : (
                <div className="harper-repetition-panel">
                  <p className="harper-tab-intro">
                    The following words appear frequently. Click on any word to inspect recommended IELTS academic synonyms:
                  </p>

                  <div className="harper-repeat-chips-list">
                    {repetitionData.repetitiveWords.map((item) => (
                      <button
                        key={item.word}
                        type="button"
                        className={`harper-repeat-chip ${selectedWordSynonyms?.word === item.word ? 'is-selected' : ''}`}
                        onClick={() => setSelectedWordSynonyms(item)}
                      >
                        <span className="harper-chip-word">{item.word}</span>
                        <span className="harper-chip-count">{item.count}×</span>
                      </button>
                    ))}
                  </div>

                  {/* Selected Word Synonyms Box */}
                  {selectedWordSynonyms && (
                    <div className="harper-synonym-box">
                      <div className="harper-synonym-box-head">
                        <strong>Academic Alternatives for &ldquo;{selectedWordSynonyms.word}&rdquo;</strong>
                        <button
                          type="button"
                          className="harper-close-syn-btn"
                          onClick={() => setSelectedWordSynonyms(null)}
                        >
                          ✕
                        </button>
                      </div>

                      {selectedWordSynonyms.synonyms.length > 0 ? (
                        <div className="harper-syn-buttons">
                          {selectedWordSynonyms.synonyms.map((syn) => (
                            <span key={syn} className="harper-syn-badge">
                              {syn}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          No direct dictionary match. Try rephrasing with nominalizations or descriptive adjectives.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Habit Tips & Insights */}
          {activeAnalysisTab === 'habits' && (
            <div className="harper-tab-content">
              {habitInsights.length === 0 ? (
                <div className="harper-empty-state">
                  <div className="harper-empty-icon">💡</div>
                  <h4>Start Writing to Reveal Habits</h4>
                  <p>
                    As you write more sentences, Harper will identify patterns like repetitive sentence starters, article slips, or vocabulary variety.
                  </p>
                </div>
              ) : (
                <div className="harper-insights-list">
                  {habitInsights.map((ins) => (
                    <div key={ins.id} className={`harper-insight-card is-${ins.severity}`}>
                      <div className="harper-insight-header">
                        <span className="harper-insight-cat">{ins.category}</span>
                        <strong className="harper-insight-title">{ins.title}</strong>
                      </div>
                      <p className="harper-insight-tip">{ins.tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
