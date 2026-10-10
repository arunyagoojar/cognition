import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import ScrollToTop from './ScrollToTop';

const EASE = [0.16, 1, 0.3, 1];

/**
 * Results-screen shell: opens at the top of the window and reveals its
 * <ResultItem> children with a short, subtle stagger. With reduced motion the
 * cards simply appear.
 */
export function ResultPage({ skill = 'mock', className = '', children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`result-page ${className}`.trim()}
      data-skill={skill}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: reduce ? {} : { staggerChildren: 0.06, delayChildren: 0.03 } },
      }}
    >
      <ScrollToTop />
      {children}
    </motion.div>
  );
}

export function ResultItem({ as = 'div', className, children, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { duration: 0.38, ease: EASE } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
