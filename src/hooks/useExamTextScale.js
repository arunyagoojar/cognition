import React from 'react';
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
