import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import Icon from './Icon';

// ─── Unified vocabulary card ─────────────────────────────────────────────────
// The ONE vocabulary interaction used across Tips & Tricks.
// Collapsed: title + word chips + quick example + strength note.
// Expanded: per-word meaning, micro-example and usage strength.

export default function VocabCard({ tip, accent }) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const bodyVariants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 } };

  return (
    <div className={`vocab-card ${open ? 'open' : ''}`} style={{ '--tip-accent': accent }}>
      <button
        type="button"
        className="vocab-card-head"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="vocab-card-title-row">
          <span className="vocab-card-title">{tip.title}</span>
          <span className={`vocab-card-chevron ${open ? 'rotated' : ''}`} aria-hidden="true">
            <Icon name="back" size={13} className="vocab-chevron-icon" />
          </span>
        </span>
        <span className="vocab-card-chips" aria-label={`${tip.title} words`}>
          {tip.chips.map(chip => (
            <span key={chip} className="vocab-chip">{chip}</span>
          ))}
        </span>
        <span className="vocab-card-quick">
          <span className="vocab-card-quick-example">“{tip.quickExample}”</span>
          <span className="vocab-card-quick-note">{tip.quickNote}</span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="vocab-body"
            className="vocab-card-body"
            variants={bodyVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <ul className="vocab-item-list">
              {tip.items.map(item => (
                <li key={item.word} className="vocab-item">
                  <div className="vocab-item-word">{item.word}</div>
                  <div className="vocab-item-meaning">{item.meaning}</div>
                  <div className="vocab-item-example">“{item.example}”</div>
                  <div className="vocab-item-strength">
                    <Icon name="target" size={12} />
                    <span>{item.strength}</span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
