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

/**
 * Strips a leading question number that some extracted stems still carry
 * ("18. whales disappear…" → "whales disappear…"). The badge owns the number.
 */
export function stripLeadingNumber(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/^\s*\d{1,2}\s*[\.\)]\s*/, '');
}
