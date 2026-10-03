import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import Icon from '../common/Icon';

/**
 * Universal Deliberate Exam Start Screen
 * Clearly communicates:
 * - Exactly ONE clean way to exit: ← Back to Dashboard
 * - Instant scroll to top on mount
 * - Test title, short description, duration & module scope
 * - Clear rules and scoring overview without internal implementation trivia
 * - ONE extremely obvious high-contrast primary CTA button
 */
export default function ExamStartScreen({
  section,
  sectionKey = 'listening',
  testTitle,
  subtitle,
  metaItems = [],
  rules = [],
  scoringInfo,
  ctaText,
  onStart,
  onBack,
  notice = null,
}) {
  // Fix start screen scroll position immediately on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const accentColors = {
    listening: 'var(--c-yellow)',
    reading: 'var(--c-lavender)',
    writing: 'var(--c-coral)',
    speaking: 'var(--c-near-black)',
    mock: 'var(--c-coral)',
  };

  const accentColor = accentColors[sectionKey] || 'var(--c-coral)';
  const isDarkAccent = sectionKey === 'speaking';

  return (
    <motion.div
      className="exam-start-container"
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.995 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top Pre-Test Navigation: Exactly ONE way to return before starting */}
      <div className="exam-start-nav-bar">
        <button
          type="button"
          className="exam-start-back-btn"
          onClick={onBack}
          title="Return to Dashboard"
        >
          <Icon name="arrowLeft" size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Deliberate Start Screen Card */}
      <div className="exam-start-card">
        {/* Top Section Indicator */}
        <div className="exam-start-header">
          <div className="exam-section-badge-wrap">
            <span
              className="exam-section-badge"
              style={{
                background: accentColor,
                color: isDarkAccent ? '#FFFFFF' : '#151313',
              }}
            >
              {section.toUpperCase()}
            </span>
            <span className="exam-official-tag">Authentic IELTS Practice</span>
          </div>
        </div>

        {/* Large Test Title, Short Description, and Simplified Meta Cards */}
        <div className="exam-start-body">
          <h1 className="exam-start-title">{testTitle}</h1>
          {subtitle && <p className="exam-start-sub">{subtitle}</p>}

          {/* Test Metadata Grid (Simplified, no audio track counts or trivia) */}
          {metaItems.length > 0 && (
            <div className="exam-meta-grid">
              {metaItems.map((item, idx) => (
                <div key={idx} className="exam-meta-card">
                  <div className="exam-meta-val">{item.label}</div>
                  <div className="exam-meta-desc">{item.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Rules & Scoring Overview */}
          <div className="exam-protocol-columns">
            {rules.length > 0 && (
              <div className="exam-protocol-box">
                <div className="exam-protocol-title">
                  <Icon name="check" size={16} />
                  <span>Exam Conditions & Rules</span>
                </div>
                <ul className="exam-rules-list">
                  {rules.map((rule, idx) => (
                    <li key={idx}>
                      <span className="rule-bullet">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scoringInfo && (
              <div className="exam-protocol-box">
                <div className="exam-protocol-title">
                  <Icon name="zap" size={16} />
                  <span>Authentic IELTS Scoring</span>
                </div>
                <p className="exam-scoring-text">{scoringInfo}</p>
                <div className="exam-scoring-pill-note">
                  Raw score converted to official Band 0.0 – 9.0 upon submission
                </div>
              </div>
            )}
          </div>
        </div>

        {notice}

        {/* Bottom: Primary Obvious High-Contrast CTA Button */}
        <div className="exam-start-cta-wrap">
          <motion.button
            id="primary-exam-start-cta"
            className="exam-primary-cta-btn"
            onClick={onStart}
            whileHover={{ y: -3, boxShadow: '0 8px 0 #151313' }}
            whileTap={{ y: 2, scale: 0.98, boxShadow: '0 2px 0 #151313' }}
            transition={{ type: 'spring', stiffness: 450, damping: 24 }}
          >
            <span className="cta-btn-text">{ctaText || `START ${section.toUpperCase()} TEST`}</span>
            <motion.span
              className="cta-animated-arrow"
              initial={{ x: 0 }}
              whileHover={{ x: 6 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              →
            </motion.span>
          </motion.button>
          <span className="exam-cta-subtext">Clicking begins official timed simulation</span>
        </div>
      </div>
    </motion.div>
  );
}
