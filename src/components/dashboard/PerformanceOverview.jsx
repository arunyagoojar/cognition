import React from 'react';
import Icon from '../common/Icon';
import { LEARNING_SKILLS } from '../../data/learningCatalog';
import FocusAreas from './FocusAreas.jsx';
import { deriveWeaknesses } from '../../utils/insights.js';
import { getPerformanceStore } from '../../utils/performanceStore.js';

export default function PerformanceOverview({
  scores,
  targetBand,
  completedLessons,
  onOpenLearningHub,
  onOpenPerformance,
  onOpenLesson,
  onOpenTips,
  onStartPractice
}) {
  const targetNum = parseFloat(targetBand) || 8.0;
  const { focusAreas, sufficientData } = deriveWeaknesses(getPerformanceStore().attempts || [], targetBand);

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
      {/* ── LEFT: Learning Hub Card (LAVENDER #BE94F5 with Black Border) ── */}
      <div className="hub-card-lavender">
        <div className="hub-card-upper">
          <div className="hub-top-row">
            <span className="pill-badge pill-black">
              LEARNING HUB
            </span>
            <span className="hub-bookmark-icon">
              <Icon name="book" size={17} />
            </span>
          </div>

          <h2 className="hub-heading">
            Learn smarter.<br />Improve faster.
          </h2>

          <p className="hub-description">
            Improve your IELTS skills through short, focused lessons and examiner rubric breakdowns.
          </p>
        </div>

        <div className="hub-card-lower">
          <div className="hub-progress-info">
            <span>{completedCount} of {totalLessonsCount} lessons completed</span>
            <span className="hub-info-dot">·</span>
            <span>{minutesWatched} mins active</span>
          </div>

          <div className="hub-card-actions">
            <button
              className="btn-coral-pill-physical"
              onClick={onOpenLearningHub}
              id="explore-learning-hub-btn"
            >
              <span>Explore Learning Hub</span>
              <span className="btn-arrow-icon">→</span>
            </button>
            {onOpenTips && (
              <button
                type="button"
                className="btn-tips-outline"
                onClick={onOpenTips}
                id="open-tips-btn"
              >
                <Icon name="sparkles" size={14} />
                <span>Tips &amp; Tricks</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Skill Performance Card (EDITORIAL OFF-WHITE with Black Border) ── */}
      <div
        className="performance-card-offwhite"
        onClick={onOpenPerformance}
        role="button"
        tabIndex={0}
        id="performance-overview-card"
        onKeyDown={(e) => e.key === 'Enter' && onOpenPerformance()}
      >
        <div className="perf-card-upper">
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

        {/* Target journey + focus areas (deterministic — no AI, no fabrication) */}
        <div className="perf-journey" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Your target: <strong style={{ color: 'var(--text-primary)' }}>{targetBand}</strong>
          </div>
          <FocusAreas
            focusAreas={focusAreas}
            onOpenLesson={(id) => { onOpenLesson?.(id); }}
            onOpenTips={(skill, cat) => { onOpenTips?.(skill, cat); }}
            onStartPractice={onStartPractice}
          />
          {!sufficientData && focusAreas.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Complete a few tests — personalised focus areas appear here.
            </div>
          )}
        </div>

        <div className="perf-card-footer">
          <span>Tap to inspect official criteria: Lexical Resource, Fluency, Coherence</span>
          <span className="perf-footer-target">Target: {targetBand}</span>
        </div>
      </div>
    </div>
  );
}
