import React from 'react';

/**
 * Exam text size (Reading passages/questions, Writing prompt/essay).
 * Four steps; the choice is remembered on this device. Applied by setting
 * the --exam-text-scale custom property on the exam workspace.
 */
const STEPS = [0.9, 1, 1.15, 1.35];
const KEY = 'cognition_exam_text_scale';

export function useExamTextScale() {
  const [scale, setScale] = React.useState(() => {
    try {
      const v = Number(window.localStorage.getItem(KEY));
      return STEPS.includes(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const update = (v) => {
    setScale(v);
    try { window.localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable: session only */ }
  };
  return [scale, update];
}

export default function TextSizeControl({ scale, onChange }) {
  const i = Math.max(0, STEPS.indexOf(scale));
  return (
    <div className="text-size-control" role="group" aria-label="Text size">
      <button type="button" onClick={() => onChange(STEPS[Math.max(0, i - 1)])} disabled={i === 0}
        aria-label="Smaller text" title="Smaller text">
        <span style={{ fontSize: 12 }}>A</span><span aria-hidden="true">−</span>
      </button>
      <button type="button" onClick={() => onChange(1)} className={scale === 1 ? 'is-default' : ''}
        aria-label="Default text size" title="Default text size">
        <span style={{ fontSize: 14 }}>A</span>
      </button>
      <button type="button" onClick={() => onChange(STEPS[Math.min(STEPS.length - 1, i + 1)])}
        disabled={i === STEPS.length - 1} aria-label="Larger text" title="Larger text">
        <span style={{ fontSize: 16 }}>A</span><span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
