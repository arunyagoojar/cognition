import React, { useState, useEffect } from 'react';
import { motion, animate } from 'motion/react';
import { calculateOverallBand } from '../../utils/bandCalculator';

export default function ScoreSummary({ scores, targetBand }) {
  const L = scores?.listening?.band ?? null;
  const R = scores?.reading?.band ?? null;
  const W = scores?.writing?.band ?? null;
  const S = scores?.speaking?.band ?? null;

  const currentOverall = calculateOverallBand(L, R, W, S);
  const hasScores = currentOverall !== null;
  const targetDisplay = targetBand || '8.0';

  const targetNum = parseFloat(targetDisplay) || 8.0;
  const currentNum = hasScores ? (parseFloat(currentOverall) || 0) : 0;

  // Calculate percentage of progress towards target (baseline 4.0 to 9.0)
  const minScale = 4.0;
  const maxScale = 9.0;
  const progressRatio = hasScores
    ? Math.min(100, Math.max(10, ((currentNum - minScale) / (maxScale - minScale)) * 100))
    : 0;

  // Sophisticated numeric motion transition from 0 to current band
  const [animatedScore, setAnimatedScore] = useState(hasScores ? '0.0' : '--');

  useEffect(() => {
    if (!hasScores) {
      setAnimatedScore('--');
      return;
    }
    const controls = animate(0, currentNum, {
      duration: 1.0,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (val) => {
        setAnimatedScore(val.toFixed(1));
      },
    });
    return () => controls.stop();
  }, [hasScores, currentNum]);

  const diff = hasScores ? (targetNum - currentNum).toFixed(1) : targetNum.toFixed(1);

  return (
    <div className="compact-score-card afu-score">
      <div className="score-summary-horizontal">
        {/* Left Anchor: Current Band with Smooth Number Animation */}
        <div className="score-block score-block-left">
          <span className="score-label-text">YOUR CURRENT BAND</span>
          <div className="score-val-current">
            {animatedScore}
          </div>
        </div>

        {/* Center: Refined Continuous Progress Bar with Spring Ease-Out */}
        <div className="score-track-container">
          <div className="score-track-labels">
            <span className="score-track-status">
              {!hasScores ? 'Take a test to calculate your band' : currentNum >= targetNum ? 'Target Achieved' : `${diff} Band to Target Goal`}
            </span>
            <span className="score-track-target-label">
              Target: {targetDisplay}
            </span>
          </div>

          <div className="score-progress-bar-apple">
            <motion.div
              className="score-progress-fill-continuous"
              initial={{ width: 0 }}
              animate={{ width: `${progressRatio}%` }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="score-sub-metrics">
            <span>Band 4.0 Foundation</span>
            <span>Band 7.0 Competent</span>
            <span>Band 9.0 Expert</span>
          </div>
        </div>

        {/* Right Anchor: Target Band */}
        <div className="score-block score-block-right">
          <span className="score-label-text">TARGET BAND</span>
          <div className="score-val-target">
            {targetDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}
