import React from 'react';

/**
 * Canonical question-number badge (Phase 5).
 * Every reading/listening question number renders through this component,
 * exactly once — never duplicated by the content layer or the renderer.
 */
export default function QuestionNumber({ n }) {
  if (n === undefined || n === null || n === '') return null;
  return <span className="q-num-badge">{n}</span>;
}
