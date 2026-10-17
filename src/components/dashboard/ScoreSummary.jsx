import React, { useState, useEffect } from 'react';
import { motion, animate } from 'motion/react';
import { calculateOverallBand } from '../../utils/bandCalculator';

export default function ScoreSummary({ scores, targetBand, embedded = false }) {
  const L = scores?.listening?.band ?? null;
  const R = scores?.reading?.band ?? null;
  const W = scores?.writing?.band ?? null;
  const S = scores?.speaking?.band ?? null;

  const currentOverall = calculateOverallBand(L, R, W, S);
  const hasScores = currentOverall !== null;
  const targetDisplay = targetBand || '8.0';

  const targetNum = parseFloat(targetDisplay) || 8.0;
  const currentNum = hasScores ? (parseFloat(currentOverall) || 0) : 0;

  // Baseline scale from 4.0 to 9.0 (span of 5.0 bands)
  const minScale = 4.0;
  const maxScale = 9.0;
  const progressRatio = hasScores
    ? Math.min(100, Math.max(0, ((currentNum - minScale) / (maxScale - minScale)) * 100))
    : 0;

  const targetRatio = Math.min(100, Math.max(0, ((targetNum - minScale) / (maxScale - minScale)) * 100));

  const [animatedScore, setAnimatedScore] = useState(hasScores ? '0.0' : '--');

  useEffect(() => {
    if (!hasScores) {
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

  const innerContent = (
    <div className={`score-progression-hero ${embedded ? 'is-embedded' : ''}`}>
      {/* ── 1. TOP HEADER: Prominent Current & Target Badges ── */}
      <div className="progression-top-row">
        <div className="progression-current-box">
          <span className="progression-label">YOUR CURRENT BAND</span>
          <div className="progression-current-value">
            <span className="progression-score-pill">
              Band {hasScores ? animatedScore : '--'}
            </span>
            <span className="progression-status-note">
              {!hasScores
                ? 'Take a practice or mock test to calculate'
                : currentNum >= targetNum
                ? 'Target Achieved! 🎉'
                : `${diff} Bands to Target Goal`}
            </span>
          </div>
        </div>

        <div className="progression-target-box">
          <span className="progression-label">TARGET GOAL</span>
          <div className="progression-target-pill">
            <span className="progression-target-flag">🎯</span>
            <strong>Band {targetDisplay}</strong>
          </div>
        </div>
      </div>

      {/* ── 2. PROMINENT WIDE PROGRESSION BAR ── */}
      <div className="progression-track-wrapper">
        <div className="progression-bar-prominent">
          {/* Animated Fill */}
          <motion.div
            className="progression-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressRatio}%` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {hasScores && progressRatio >= 14 && (
              <span className="progression-tip-indicator">
                {hasScores ? animatedScore : '--'}
              </span>
            )}
          </motion.div>

          {/* Target Marker Pin */}
          <div
            className="progression-target-pin"
            style={{ left: `${targetRatio}%` }}
            title={`Target Goal: Band ${targetDisplay}`}
          >
            <div className="progression-pin-line" />
          </div>
        </div>

        {/* Milestone Band Descriptors */}
        <div className="progression-milestones">
          <span>Band 4.0 Foundation</span>
          <span>Band 6.0 Competent</span>
          <span>Band 7.5 Good</span>
          <span>Band 9.0 Expert</span>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div className="compact-score-card afu-score">
      {innerContent}
    </div>
  );
}
