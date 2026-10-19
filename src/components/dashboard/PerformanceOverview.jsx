import React from 'react';
import Icon from '../common/Icon';
import ScoreSummary from './ScoreSummary';
import { LEARNING_SKILLS } from '../../data/learningCatalog';

export default function PerformanceOverview({
  scores,
  targetBand,
  completedLessons,
  onOpenLearningHub,
  onOpenPerformance,
  onOpenTips,
  onOpenHarperWriting,
}) {
  // Calculate total lessons and completed count
  const allLessons = LEARNING_SKILLS.flatMap(s => s.lessons || []);
  const totalLessonsCount = allLessons.length;
  const completedCount = completedLessons?.length || 0;
  const minutesWatched = completedCount * 18;

  const skillsData = [
    {
      key: 'reading',
      name: 'Reading',
      icon: 'book',
      band: scores?.reading?.band ?? null,
      color: 'var(--c-lavender)',
    },
    {
      key: 'listening',
      name: 'Listening',
      icon: 'headphones',
      band: scores?.listening?.band ?? null,
      color: 'var(--c-yellow)',
    },
    {
      key: 'writing',
      name: 'Writing',
      icon: 'pen',
      band: scores?.writing?.band ?? null,
      color: 'var(--c-coral)',
    },
    {
      key: 'speaking',
      name: 'Speaking',
      icon: 'mic',
      band: scores?.speaking?.band ?? null,
      color: 'var(--c-speaker)',
    }
  ];

  return (
    <div className="overview-two-col afu-overview">
      {/* ── LEFT: 3 Distinct Feature Cards (Learning Hub, Tips & Tricks, Harper Writing) ── */}
      <div className="hub-cards-stack">
        {/* 1. Learning Hub Card (LAVENDER #BE94F5) */}
        <div className="hub-feature-card is-lavender">
          <div className="hub-feature-top">
            <div className="hub-feature-badge-row">
              <span className="pill-badge pill-black">LEARNING HUB</span>
              <span className="hub-feature-icon">
                <Icon name="book" size={15} />
              </span>
            </div>
            <h3 className="hub-feature-heading">Learn Smarter. Improve Faster.</h3>
            <p className="hub-feature-desc">
              Video lessons and examiner rubric breakdowns across all 4 IELTS skills.
            </p>
          </div>

          <div className="hub-feature-bottom">
            <span className="hub-feature-meta">
              {completedCount} of {totalLessonsCount} lessons · {minutesWatched}m
            </span>
            <button
              type="button"
              className="btn-coral-pill-physical hub-feature-btn"
              onClick={onOpenLearningHub}
              id="explore-learning-hub-btn"
            >
              <span>Explore Lessons</span>
              <span className="btn-arrow-icon">→</span>
            </button>
          </div>
        </div>

        {/* 2. Tips & Tricks Card (YELLOW #FCCC42) */}
        <div className="hub-feature-card is-yellow">
          <div className="hub-feature-top">
            <div className="hub-feature-badge-row">
              <span className="pill-badge pill-black">TIPS &amp; STRATEGIES</span>
              <span className="hub-feature-icon">
                <Icon name="sparkles" size={15} />
              </span>
            </div>
            <h3 className="hub-feature-heading">Examiner Secrets &amp; Phrase Bank</h3>
            <p className="hub-feature-desc">
              High-band shortcuts, proven paragraph templates, and test-day tactics.
            </p>
          </div>

          <div className="hub-feature-bottom">
            <span className="hub-feature-meta">Band 8+ Academic Templates</span>
            <button
              type="button"
              className="btn-tips-outline hub-feature-btn"
              onClick={onOpenTips}
              id="open-tips-btn"
            >
              <span>View Tips &amp; Tricks</span>
              <span className="btn-arrow-icon">→</span>
            </button>
          </div>
        </div>

        {/* 3. Practice Writing with Help Card (EDITORIAL PEACH / CORAL BORDER) */}
        <div className="hub-feature-card is-harper">
          <div className="hub-feature-top">
            <div className="hub-feature-badge-row">
              <span className="pill-badge pill-coral">PRACTICE WRITING</span>
              <span className="pill-badge pill-black" style={{ fontSize: 10 }}>LOCAL HELP</span>
            </div>
            <h3 className="hub-feature-heading">Practice Writing with Help</h3>
            <p className="hub-feature-desc">
              Active grammar correction, repetitive word detection, and vocabulary habit-building.
            </p>
          </div>

          <div className="hub-feature-bottom">
            <span className="hub-feature-meta">Task 1 &amp; 2 · Live Feedback</span>
            <button
              type="button"
              className="btn-coral-pill-physical hub-feature-btn"
              onClick={onOpenHarperWriting}
              id="open-harper-writing-btn"
            >
              <span>Start Practice</span>
              <span className="btn-arrow-icon">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Unified Scorecard (Total Band at Top + Skill Breakdown Below) ── */}
      <div
        className="performance-card-offwhite unified-scorecard-card"
        id="performance-overview-card"
      >
        {/* Upper Half: Total Score & Progress Goal */}
        <div className="scorecard-top-section">
          <ScoreSummary scores={scores} targetBand={targetBand} embedded={true} />
        </div>

        {/* Divider Line */}
        <div className="scorecard-inner-divider" />

        {/* Lower Half: Detailed Skill Breakdown */}
        <div
          className="perf-card-upper"
          onClick={onOpenPerformance}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onOpenPerformance()}
          style={{ cursor: 'pointer' }}
        >
          <div className="perf-header-row">
            <div>
              <h2 className="perf-title">Your performance</h2>
              <p className="perf-sub">Track your progress across every IELTS skill</p>
            </div>
            <span className="perf-details-link">
              <span>Detailed breakdown</span>
              <span className="perf-link-arrow">→</span>
            </span>
          </div>

          <div className="skill-rows-list">
            {skillsData.map(({ key, name, icon, band, color }) => {
              const hasBand = band !== null && band !== undefined;
              const currentVal = hasBand ? parseFloat(band) : 0;
              const pct = hasBand ? Math.min(100, Math.max(12, (currentVal / 9.0) * 100)) : 0;

              return (
                <div key={key} className="skill-row-item">
                  <div className="skill-row-left">
                    <span className="skill-row-icon" style={{ background: color }}>
                      <Icon name={icon} size={15} />
                    </span>
                    <span className="skill-row-name">{name}</span>
                  </div>

                  <div className="skill-row-center">
                    <div className="skill-bar-track">
                      <div
                        className="skill-bar-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>

                  <div className="skill-row-score">
                    <strong>{hasBand ? band : '--'}</strong>
                    <span className="skill-score-target">/ 9.0</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="perf-card-footer">
          <span>Tap to inspect official criteria: Lexical Resource, Fluency, Coherence</span>
          <span className="perf-footer-target">Target: {targetBand}</span>
        </div>
      </div>
    </div>
  );
}
