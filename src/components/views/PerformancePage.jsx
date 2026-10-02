import React from 'react';
import Icon from '../common/Icon';
import { calculateOverallBand } from '../../utils/bandCalculator';
import { getCompletedResults } from '../../utils/storage';

export default function PerformancePage({ scores, targetBand, onBack, onStartSkill }) {
  const L = scores?.listening?.band ? parseFloat(scores.listening.band) : null;
  const R = scores?.reading?.band ? parseFloat(scores.reading.band) : null;
  const W = scores?.writing?.band ? parseFloat(scores.writing.band) : null;
  const S = scores?.speaking?.band ? parseFloat(scores.speaking.band) : null;

  const hasAnyScore = L !== null || R !== null || W !== null || S !== null;
  const currentOverall = calculateOverallBand(L, R, W, S);
  const currentOverallNum = currentOverall !== null ? parseFloat(currentOverall) : null;
  const targetNum = parseFloat(targetBand) || 8.0;

  // Real historical trend check: only show if at least 2 historical results exist
  const history = getCompletedResults() || [];
  const hasHistory = history.length > 1;
  const previousOverall = hasHistory ? history[1]?.overallBand : null;
  const bandDelta = (previousOverall && currentOverallNum) ? (currentOverallNum - parseFloat(previousOverall)).toFixed(1) : null;

  // Identify Strongest and Weakest Skills for immediate 10-second scan
  const validSkills = [
    { id: 'listening', name: 'Listening', band: L, accent: 'var(--c-yellow)' },
    { id: 'reading', name: 'Reading', band: R, accent: 'var(--c-lavender)' },
    { id: 'writing', name: 'Writing', band: W, accent: 'var(--c-coral)' },
    { id: 'speaking', name: 'Speaking', band: S, accent: 'var(--c-near-black)' },
  ];

  const attemptedSkills = validSkills.filter(s => s.band !== null);
  const sortedByBand = [...attemptedSkills].sort((a, b) => b.band - a.band);
  const strongestSkill = sortedByBand[0] || null;
  const weakestSkill = sortedByBand.length > 1 ? sortedByBand[sortedByBand.length - 1] : null;

  // Official IELTS Assessment Criteria & Concise Coaching Cards
  const skillSections = [
    {
      id: 'reading',
      name: 'Reading',
      icon: 'book',
      band: R,
      hasAttempt: R !== null,
      accent: 'var(--c-lavender)',
      badgeText: R === null ? 'Unattempted' : R >= 7.5 ? 'Your strongest area' : 'On track',
      badgeClass: 'pill-lavender',
      subskills: R !== null ? [
        { name: 'Accuracy', score: scores?.reading?.raw !== undefined ? `${scores.reading.raw}/40` : (R ? `${R.toFixed(1)}` : '--'), status: scores?.reading?.percentage !== undefined ? `${scores.reading.percentage}% accuracy rate` : 'Assessed on IELTS Academic scale' },
        { name: 'Inference', score: R ? R.toFixed(1) : '--', status: 'Watch True/False/Not Given' },
        { name: 'Information Retrieval', score: R ? R.toFixed(1) : '--', status: 'Fast skimming & scanning' },
        { name: 'Vocabulary & Synonyms', score: R ? R.toFixed(1) : '--', status: 'Accurate paraphrase match' },
      ] : [
        { name: 'Accuracy', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Inference', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Information Retrieval', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Vocabulary & Synonyms', score: '--', status: 'Awaiting first test attempt' },
      ],
      aiInsight: {
        title: R !== null ? 'INFERENCE & NOT GIVEN TRAPS' : 'DIAGNOSTIC INSIGHT PENDING',
        score: R !== null ? R.toFixed(1) : '--',
        status: R !== null ? (R >= 7.5 ? 'Strong proficiency' : 'Needs attention') : 'Awaiting attempt',
        issue: R !== null
          ? 'Difficulty distinguishing between contradictory statements (FALSE) and unmentioned claims (NOT GIVEN).'
          : 'Complete an authentic Reading passage to receive AI examiner diagnostic analysis.',
        focusItems: ['Synonym mapping in stems', 'True / False / Not Given boundary rules', 'Time discipline on Passage 3'],
      }
    },
    {
      id: 'listening',
      name: 'Listening',
      icon: 'headphones',
      band: L,
      hasAttempt: L !== null,
      accent: 'var(--c-yellow)',
      badgeText: L === null ? 'Unattempted' : L >= 7.5 ? 'Your strongest area' : 'On track',
      badgeClass: 'pill-yellow',
      subskills: L !== null ? [
        { name: 'Accuracy', score: scores?.listening?.raw !== undefined ? `${scores.listening.raw}/40` : (L ? `${L.toFixed(1)}` : '--'), status: scores?.listening?.percentage !== undefined ? `${scores.listening.percentage}% accuracy rate` : 'Assessed on IELTS Academic scale' },
        { name: 'Detail Recognition', score: L ? L.toFixed(1) : '--', status: 'High Part 1 & 2 precision' },
        { name: 'Main Idea & Flow', score: L ? L.toFixed(1) : '--', status: 'Follows discourse signposts' },
        { name: 'Distractor Rejection', score: L ? L.toFixed(1) : '--', status: 'Catches speaker self-corrections' },
      ] : [
        { name: 'Accuracy', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Detail Recognition', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Main Idea & Flow', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Distractor Rejection', score: '--', status: 'Awaiting first test attempt' },
      ],
      aiInsight: {
        title: L !== null ? 'PART 4 MONOLOGUE RETENTION' : 'DIAGNOSTIC INSIGHT PENDING',
        score: L !== null ? L.toFixed(1) : '--',
        status: L !== null ? (L >= 7.5 ? 'Good consistency' : 'Needs attention') : 'Awaiting attempt',
        issue: L !== null
          ? 'Concentration drops slightly during dense 10-item academic monologues with no mid-audio pause.'
          : 'Complete an authentic 4-part Listening test to receive AI examiner diagnostic analysis.',
        focusItems: ['Predicting noun/number word types', 'Following discourse signposts', 'Eliminating conversational traps'],
      }
    },
    {
      id: 'writing',
      name: 'Writing',
      icon: 'pen',
      band: W,
      hasAttempt: W !== null,
      accent: 'var(--c-coral)',
      badgeText: W === null ? 'Unattempted' : W < 6.5 ? 'Priority focus' : 'On track',
      badgeClass: 'pill-black',
      subskills: W !== null ? [
        { name: 'Task Achievement / Response', score: String(scores?.writing?.criteria?.taskAchievement?.band ?? scores?.writing?.criteria?.taskResponse ?? (W ? W.toFixed(1) : '--')), status: 'Task 1 needs clear overview' },
        { name: 'Coherence & Cohesion', score: String(scores?.writing?.criteria?.coherenceAndCohesion?.band ?? scores?.writing?.criteria?.coherence ?? (W ? W.toFixed(1) : '--')), status: 'Strengthen 4-paragraph linkage' },
        { name: 'Lexical Resource', score: String(scores?.writing?.criteria?.lexicalResource?.band ?? scores?.writing?.criteria?.lexical ?? (W ? W.toFixed(1) : '--')), status: 'Good academic vocabulary' },
        { name: 'Grammatical Range & Accuracy', score: String(scores?.writing?.criteria?.grammaticalRangeAndAccuracy?.band ?? scores?.writing?.criteria?.grammar ?? (W ? W.toFixed(1) : '--')), status: 'Vary complex sentence structures' },
      ] : [
        { name: 'Task Achievement / Response', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Coherence & Cohesion', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Lexical Resource', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Grammatical Range & Accuracy', score: '--', status: 'Awaiting first test attempt' },
      ],
      aiInsight: {
        title: W !== null ? (scores?.writing?.criteria?.taskAchievement?.improvementFocus ? 'WRITING TASK FOCUS' : 'WRITING INSIGHT') : 'DIAGNOSTIC INSIGHT PENDING',
        score: W !== null ? W.toFixed(1) : '--',
        status: W !== null ? (W >= 7.0 ? 'Strong proficiency' : 'Needs attention') : 'Awaiting attempt',
        issue: W !== null
          ? (scores?.writing?.areasForImprovement || 'Complete writing tasks carefully following rubric guidelines.')
          : 'Complete an authentic Writing test to receive AI examiner diagnostic analysis.',
        focusItems: W !== null 
          ? [
              scores?.writing?.criteria?.taskAchievement?.improvementFocus || 'Task Response',
              scores?.writing?.criteria?.lexicalResource?.improvementFocus || 'Vocabulary Range'
            ].filter(Boolean).slice(0, 3)
          : ['Topic vocabulary', 'Collocations', 'Idiomatic phrasing'],
      }
    },
    {
      id: 'speaking',
      name: 'Speaking',
      icon: 'mic',
      band: S,
      hasAttempt: S !== null,
      accent: 'var(--c-near-black)',
      badgeText: S === null ? 'Unattempted' : S < 7.0 ? 'Needs attention' : 'Strong proficiency',
      badgeClass: 'pill-black',
      subskills: S !== null ? [
        { name: 'Fluency & Coherence', score: String(scores?.speaking?.criteria?.fluencyAndCoherence?.band ?? scores?.speaking?.criteria?.fluency ?? (S ? S.toFixed(1) : '--')), status: 'Speech continuity and discourse' },
        { name: 'Lexical Resource', score: String(scores?.speaking?.criteria?.lexicalResource?.band ?? scores?.speaking?.criteria?.lexical ?? (S ? S.toFixed(1) : '--')), status: 'Range of idiomatic phrasing' },
        { name: 'Grammatical Range & Accuracy', score: String(scores?.speaking?.criteria?.grammaticalRangeAndAccuracy?.band ?? scores?.speaking?.criteria?.grammar ?? (S ? S.toFixed(1) : '--')), status: 'Syntactic control of tenses' },
        { name: 'Pronunciation', score: scores?.speaking?.criteria?.pronunciation?.band ? String(scores.speaking.criteria.pronunciation.band) : (scores?.speaking?.criteria?.pronunciation?.status === 'insufficient_audio_evidence' ? 'Audio req.' : (S ? S.toFixed(1) : '--')), status: 'Rhythm and natural phonology' },
      ] : [
        { name: 'Fluency & Coherence', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Lexical Resource', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Grammatical Range & Accuracy', score: '--', status: 'Awaiting first test attempt' },
        { name: 'Pronunciation', score: '--', status: 'Awaiting first test attempt' },
      ],
      aiInsight: {
        title: S !== null ? (scores?.speaking?.criteria?.fluencyAndCoherence?.improvementFocus ? 'FLUENCY FOCUS' : 'SPEAKING INSIGHT') : 'DIAGNOSTIC INSIGHT PENDING',
        score: S !== null ? S.toFixed(1) : '--',
        status: S !== null ? (S >= 7.0 ? 'Strong proficiency' : 'Needs attention') : 'Awaiting attempt',
        issue: S !== null
          ? (scores?.speaking?.areasForImprovement || 'Continue to practice speaking clearly and cohesively.')
          : 'Complete an authentic Speaking interview to receive AI examiner diagnostic analysis.',
        focusItems: S !== null
          ? [
              scores?.speaking?.criteria?.fluencyAndCoherence?.improvementFocus || 'Fluency',
              scores?.speaking?.criteria?.pronunciation?.improvementFocus || 'Pronunciation'
            ].filter(Boolean).slice(0, 3)
          : ['Buying time with discourse phrases', 'Part 2 1-minute cue card notes', 'Natural sentence intonation'],
      }
    },
  ];

  const overallProgressPct = currentOverallNum !== null
    ? Math.min(100, Math.max(10, ((currentOverallNum - 4.0) / (targetNum - 4.0)) * 100))
    : 0;

  return (
    <div className="performance-page-container">
      {/* ── PAGE TITLE BLOCK ─────────────────────────────────────────── */}
      <div className="perf-title-block">
        <h1 className="perf-main-heading">Your Performance</h1>
        <p className="perf-main-sub">
          Track how your IELTS skills are developing.
        </p>
      </div>

      {/* ── OVERALL SCORE HERO CARD ──────────────────────────────────── */}
      <div className="perf-overall-card">
        <div className="perf-overall-left">
          <span className="pill-badge pill-black">
            OVERALL SCORE
          </span>

          <div className="perf-overall-numbers">
            <div className="perf-num-group">
              <span className="perf-num-lbl">CURRENT BAND</span>
              <span className="perf-num-val current">{currentOverallNum !== null ? currentOverallNum.toFixed(1) : '--'}</span>
            </div>

            <div className="perf-num-divider">/</div>

            <div className="perf-num-group">
              <span className="perf-num-lbl">TARGET SCORE</span>
              <span className="perf-num-val target">{targetNum.toFixed(1)}</span>
            </div>
          </div>

          <div className="perf-trend-text">
            {hasHistory ? (
              <span style={{ color: Number(bandDelta) >= 0 ? 'var(--success-icon)' : 'var(--c-coral)', fontWeight: 700 }}>
                {Number(bandDelta) >= 0 ? `▲ +${bandDelta}` : `▼ ${bandDelta}`} Band from previous simulation
              </span>
            ) : hasAnyScore ? (
              <span>Baseline established across recent practice sessions</span>
            ) : (
              <span>No completed tests recorded yet. Practice scores have been reset.</span>
            )}
          </div>
        </div>

        <div className="perf-overall-right">
          <div className="perf-progress-header">
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {!hasAnyScore ? 'Take a test to begin tracking' : currentOverallNum >= targetNum ? 'Target Reached!' : `${(targetNum - currentOverallNum).toFixed(1)} Band to Target ${targetBand}`}
            </span>
            <span style={{ fontWeight: 700, color: 'var(--c-coral)' }}>
              {Math.round(overallProgressPct)}% Toward Target
            </span>
          </div>

          <div className="perf-continuous-track">
            <div
              className="perf-continuous-fill"
              style={{ width: `${overallProgressPct}%` }}
            />
          </div>

          {/* Quick 4-Skill Mini Matrix */}
          <div className="perf-mini-matrix">
            {validSkills.map(s => (
              <div key={s.id} className="perf-matrix-col">
                <span className="perf-matrix-lbl">{s.name}</span>
                <span
                  className="perf-matrix-val"
                  style={{ color: s.id === 'writing' ? 'var(--c-coral)' : 'var(--text-primary)' }}
                >
                  {s.band !== null ? s.band : '--'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOUR LARGE SKILL SECTIONS ─────────────────────────────────── */}
      <div className="perf-skills-column">
        {skillSections.map(section => {
          const progressPct = section.hasAttempt ? Math.min(100, Math.max(15, (section.band / 9.0) * 100)) : 0;

          return (
            <div key={section.id} className="perf-skill-section-card" id={`section-${section.id}`}>
              {/* Skill Top Bar: Name & Score */}
              <div className="perf-skill-header-row">
                <div className="perf-skill-title-group">
                  <div
                    className="perf-skill-icon-box"
                    style={{
                      background: section.accent,
                      color: section.id === 'speaking' ? '#FFFFFF' : '#151313',
                    }}
                  >
                    <Icon name={section.icon} size={18} />
                  </div>
                  <div>
                    <h2 className="perf-skill-name">{section.name.toUpperCase()}</h2>
                  </div>
                </div>

                <div className="perf-skill-score-box">
                  <span className="perf-skill-band-large">{section.hasAttempt ? section.band.toFixed(1) : '--'}</span>
                  <span className="perf-skill-band-total">/ 9.0</span>
                </div>
              </div>

              {/* Continuous Progress Bar with Skill Accent */}
              <div className="perf-skill-bar-wrap">
                <div className="perf-skill-bar-track">
                  <div
                    className="perf-skill-bar-fill"
                    style={{ width: `${progressPct}%`, background: section.accent }}
                  />
                </div>
              </div>

              {/* Status Indicator / Area Highlight */}
              <div className="perf-skill-status-row">
                <span className={`pill-badge ${section.badgeClass}`}>
                  {section.badgeText}
                </span>
                <span className="perf-skill-target-note">
                  {section.band >= targetNum
                    ? 'Target achieved'
                    : section.band !== null
                      ? `${(targetNum - section.band).toFixed(1)} band away from target (${targetBand})`
                      : `Target: Band ${targetBand}`}
                </span>
              </div>

              {/* Subskills Grid (IELTS Criteria / Supported Data) */}
              <div className="perf-subskills-grid">
                {section.subskills.map(sub => (
                  <div key={sub.name} className="perf-subskill-box">
                    <span className="perf-subskill-title">{sub.name}</span>
                    <div className="perf-subskill-score">{sub.score}</div>
                    <span className="perf-subskill-note">{sub.status}</span>
                  </div>
                ))}
              </div>

              {/* AI Coaching Feedback Card (Concise, Not Paragraphs) */}
              <div className="perf-ai-insight-card">
                <div className="perf-ai-card-left">
                  <div className="perf-ai-top-line">
                    <span className="perf-ai-card-tag">{section.aiInsight.title}</span>
                    <span className="perf-ai-score-indicator">{section.aiInsight.score}</span>
                    <span className={`perf-ai-status-pill ${section.id === 'writing' || section.aiInsight.status === 'Needs attention' ? 'alert' : ''}`}>
                      {section.aiInsight.status}
                    </span>
                  </div>

                  <p className="perf-ai-issue-text">
                    {section.aiInsight.issue}
                  </p>

                  <div className="perf-ai-focus-list">
                    <span className="perf-ai-focus-title">Focus on:</span>
                    {section.aiInsight.focusItems.map((item, idx) => (
                      <span key={idx} className="perf-ai-focus-pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="perf-ai-card-right">
                  <button
                    className="btn-coral-pill-sm"
                    onClick={() => onStartSkill(section.id)}
                    id={`practice-skill-${section.id}`}
                  >
                    <span>Practice this</span>
                    <span className="btn-arrow-icon">→</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
