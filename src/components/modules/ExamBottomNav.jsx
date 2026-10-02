import React from 'react';
import { motion } from 'motion/react';
import Icon from '../common/Icon';

/**
 * Universal Cognition Exam Bottom Navigation
 * Persistent 3-zone bottom bar:
 * - LEFT:   [ ← Previous ]
 * - CENTER: [ Part 1 | Part 2 | Part 3 ... ]
 * - RIGHT:  [ Next → ] or [ Finish / Submit ]
 */
export default function ExamBottomNav({
  onPrevious,
  isPreviousDisabled = false,
  previousLabel = 'Previous',
  sections = [],
  activeSectionIndex = 0,
  onSelectSection,
  onNext,
  isNextDisabled = false,
  nextLabel = 'Next',
  isSubmit = false,
  nextActionId,
}) {
  return (
    <div className="exam-bottom-nav">
      <div className="exam-bottom-nav-inner">
        {/* LEFT ZONE: PREVIOUS */}
        <div className="exam-bottom-nav-left">
          <button
            type="button"
            className="exam-nav-btn exam-nav-btn-prev"
            onClick={onPrevious}
            disabled={isPreviousDisabled}
            title={isPreviousDisabled ? 'No previous section' : 'Go to previous section'}
          >
            <Icon name="arrowLeft" size={16} />
            <span>{previousLabel}</span>
          </button>
        </div>

        {/* CENTER ZONE: SECTIONS */}
        <div className="exam-bottom-nav-center">
          <div className="exam-nav-sections-list">
            {sections.map((sec, idx) => {
              const label = typeof sec === 'string' ? sec : sec.label;
              const isActive = idx === activeSectionIndex;
              const isCompleted = typeof sec === 'object' ? sec.isCompleted : false;
              const isDisabled = typeof sec === 'object' ? sec.disabled : false;

              return (
                <button
                  key={idx}
                  type="button"
                  className={`exam-nav-section-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                  onClick={() => {
                    if (!isDisabled && onSelectSection) {
                      onSelectSection(idx);
                    }
                  }}
                  disabled={isDisabled}
                  title={`Go to ${label}`}
                >
                  {isCompleted && !isActive && (
                    <span className="exam-section-check-dot">✓</span>
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT ZONE: NEXT / SUBMIT */}
        <div className="exam-bottom-nav-right">
          <motion.button
            id={nextActionId}
            type="button"
            className={`exam-nav-btn exam-nav-btn-next ${isSubmit ? 'is-submit' : ''}`}
            onClick={onNext}
            disabled={isNextDisabled}
            whileHover={!isNextDisabled ? { y: -2, boxShadow: '0 5px 0 #151313' } : undefined}
            whileTap={!isNextDisabled ? { y: 1, scale: 0.98, boxShadow: '0 1px 0 #151313' } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            title={nextLabel}
          >
            <span>{nextLabel}</span>
            <Icon name={isSubmit ? 'check' : 'arrowRight'} size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
