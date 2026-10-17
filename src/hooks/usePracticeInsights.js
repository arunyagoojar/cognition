import { useEffect, useMemo, useState } from 'react';
import { getPerformanceStore, subscribePerformanceStore } from '../utils/performanceStore.js';
import { buildPracticeInsights } from '../utils/focusedPractice.js';

export default function usePracticeInsights() {
  const [attempts, setAttempts] = useState(() => getPerformanceStore().attempts || []);
  const [index, setIndex] = useState(null);
  useEffect(() => subscribePerformanceStore(() => setAttempts(getPerformanceStore().attempts || [])), []);
  useEffect(() => {
    if (!attempts.some(a => ['reading','listening'].some(s => (a[s] || a.skills?.[s])?.itemResults))) return;
    let active = true;
    import('../data/production/analyticsIndex.json').then(module => { if (active) setIndex(module.default); }).catch(() => {});
    return () => { active = false; };
  }, [attempts]);
  return useMemo(() => ({ attempts, ...buildPracticeInsights(attempts, index) }), [attempts, index]);
}
