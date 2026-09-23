/**
 * Shared animation utilities for Cognition app.
 * All keyframes are defined in src/styles/global.css — no runtime injection needed.
 */
import React, { useRef, useState, useEffect } from 'react';

/**
 * Hook: fires `visible = true` once the ref'd element scrolls into view.
 * Disconnects the observer after triggering (one-shot).
 */
export function useAnimateIn(threshold = 0.08) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/**
 * AnimatedCard — wraps any content with a scroll-triggered cog-fade-up entrance.
 *
 * Props:
 *   delay   {number}  seconds, e.g. 0.1
 *   variant {'up'|'in'|'right'}  — which keyframe to use
 *   style   {object}  extra styles for the wrapper div
 *   className {string}
 */
export function AnimatedCard({ children, delay = 0, variant = 'up', style, className }) {
  const [ref, visible] = useAnimateIn();
  const anim = {
    up:    'cog-fade-up',
    in:    'cog-fade-in',
    right: 'cog-slide-right',
    hero:  'cog-hero-in',
  }[variant] || 'cog-fade-up';

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...(style || {}),
        opacity: visible ? undefined : 0,
        animation: visible
          ? anim + ' 0.42s ' + delay + 's cubic-bezier(0.22,1,0.36,1) both'
          : 'none',
      }}
    >
      {children}
    </div>
  );
}
