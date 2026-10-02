import React from 'react';
import Icon from '../common/Icon';

export default function PracticeSection({ onStartSkill, scores, targetBand }) {
  const getBandVal = (skillId) => {
    const b = scores?.[skillId]?.band;
    if (b === null || b === undefined) return null;
    const num = typeof b === 'number' ? b : parseFloat(b);
    return isNaN(num) ? null : num;
  };

  const wBand = getBandVal('writing');
  const lBand = getBandVal('listening');
  const sBand = getBandVal('speaking');
  const rBand = getBandVal('reading');

  const cards = [
    {
      id: 'writing',
      tag: 'Writing',
      tagClass: 'pill-black',
      title: 'Writing Practice',
      desc: 'Master Task 1 report structure, key overview trends, and Task 2 discursive essays.',
      icon: 'pen',
      surfaceClass: 'practice-card-peach',
      currentBand: wBand !== null ? wBand.toFixed(1) : '--',
      progressText: 'Task 1 (150w) · Task 2 (250w)',
      progressPct: wBand !== null ? Math.min(100, Math.round((wBand / 9.0) * 100)) : 0,
    },
    {
      id: 'listening',
      tag: 'Listening',
      tagClass: 'pill-black',
      title: 'Listening Practice',
      desc: '4-part audio simulation with note completion, map labeling, and multiple choice.',
      icon: 'headphones',
      surfaceClass: 'practice-card-yellow',
      currentBand: lBand !== null ? lBand.toFixed(1) : '--',
      progressText: '4 Parts · 40 Questions',
      progressPct: lBand !== null ? Math.min(100, Math.round((lBand / 9.0) * 100)) : 0,
    },
    {
      id: 'speaking',
      tag: 'Speaking',
      tagClass: 'pill-black',
      title: 'Speaking Practice',
      desc: 'Three-part interview with familiar topics, 1-min cue card prep, and abstract discussion.',
      icon: 'mic',
      surfaceClass: 'practice-card-white',
      currentBand: sBand !== null ? sBand.toFixed(1) : '--',
      progressText: '3 Parts · Recorded Turns',
      progressPct: sBand !== null ? Math.min(100, Math.round((sBand / 9.0) * 100)) : 0,
    },
    {
      id: 'reading',
      tag: 'Reading',
      tagClass: 'pill-black',
      title: 'Reading Practice',
      desc: 'Three academic passages with matching headings, sentence completion, and TFNG.',
      icon: 'book',
      surfaceClass: 'practice-card-lavender',
      currentBand: rBand !== null ? rBand.toFixed(1) : '--',
      progressText: '3 Passages · 60 Mins',
      progressPct: rBand !== null ? Math.min(100, Math.round((rBand / 9.0) * 100)) : 0,
    },
  ];

  return (
    <section className="practice-section-wrap afu-practice">
      <div className="section-header-editorial">
        <h2 className="section-title-editorial">Practice</h2>
        <p className="section-sub-editorial">
          Build your skills one section at a time.
        </p>
      </div>

      <div className="practice-four-grid">
        {cards.map(({ id, tag, tagClass, title, desc, icon, surfaceClass, currentBand, progressText, progressPct }, idx) => (
          <div
            key={id}
            className={`practice-playful-card ${surfaceClass}`}
            id={`practice-card-${id}`}
            onClick={() => onStartSkill(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onStartSkill(id)}
            style={{ animationDelay: `${idx * 0.08}s` }}
          >
            {/* Top row: Pill badge + icon */}
            <div className="practice-card-top">
              <span className={`pill-badge ${tagClass}`}>
                {tag}
              </span>
              <span className="practice-card-icon-wrap">
                <Icon name={icon} size={18} />
              </span>
            </div>

            {/* Title & Description */}
            <div className="practice-card-body">
              <h3 className="practice-card-title">{title}</h3>
              <p className="practice-card-desc">{desc}</p>
            </div>

            {/* Progress & Scores */}
            <div className="practice-card-foot">
              <div className="practice-score-meta">
                <span className="practice-band-stat">
                  Current: <strong>{currentBand === '--' ? 'Unattempted' : `Band ${currentBand}`}</strong>
                </span>
                <span className="practice-target-stat">
                  Target: {targetBand}
                </span>
              </div>

              <div className="practice-bar-track">
                <div
                  className="practice-bar-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="practice-action-row">
                <span className="practice-details-note">
                  {progressText}
                </span>
                <button
                  className="btn-coral-pill-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartSkill(id);
                  }}
                  id={`start-practice-${id}`}
                >
                  <span>Continue</span>
                  <span className="btn-arrow-icon">→</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
