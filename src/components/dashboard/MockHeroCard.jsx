import React from 'react';
import { motion } from 'motion/react';
export default function MockHeroCard({ onStartMock }) {

  return (
    <div className="mock-card-dark-hero afu-mock">
      <div className="mock-dark-content">
        <div className="mock-dark-header">
          <span className="pill-badge pill-yellow">
            FULL IELTS MOCK TEST
          </span>
        </div>

        <h2 className="mock-dark-title">
          Simulate the complete IELTS Academic test and receive a detailed performance breakdown.
        </h2>

        <p className="mock-dark-desc">
          Four authentic modules in official sequence under strict timed conditions: Listening, Reading, Writing, and Speaking. Evaluated using official IELTS band descriptors.
        </p>

        {/* Four skill labels & duration metadata */}
        <div className="mock-dark-meta-row">
          <span className="mock-meta-pill">Reading</span>
          <span className="mock-meta-pill">Listening</span>
          <span className="mock-meta-pill">Writing</span>
          <span className="mock-meta-pill">Speaking</span>
          <span className="mock-meta-dot">·</span>
          <span className="mock-meta-text">~2h 45m Duration</span>
        </div>
      </div>

      <div className="mock-dark-action-side">
        <motion.button
          className="btn-coral-large"
          id="start-mock-exam"
          onClick={() => onStartMock()}
          whileHover={{ y: -3, boxShadow: '0 8px 0 #151313' }}
          whileTap={{ y: 2, scale: 0.98, boxShadow: '0 2px 0 #151313' }}
          transition={{ type: 'spring', stiffness: 450, damping: 24 }}
        >
          <span>Start Test</span>
          <span className="btn-arrow-slide">→</span>
        </motion.button>
      </div>
    </div>
  );
}

