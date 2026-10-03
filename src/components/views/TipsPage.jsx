import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Icon from '../common/Icon';
import TipCard from '../common/TipCard';
import VocabCard from '../common/VocabCard';
import { TIPS_SKILLS_ORDERED, getTipsSkill, getTipsCategory } from '../../data/tips';

// ─── Tips & Tricks ───────────────────────────────────────────────────────────
// Landing (4 skill cards) → skill (category grid) → category (tip cards).
// Pure internal navigation; TopNavigation "Back" still returns to Home.

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};

function BackChip({ onClick, label }) {
  return (
    <button type="button" className="tips-back-chip" onClick={onClick}>
      <Icon name="arrowLeft" size={13} />
      <span>{label}</span>
    </button>
  );
}

export default function TipsPage({ initialSkill = null, initialCategory = null }) {
  const [skillId, setSkillId] = useState(initialSkill);
  const [categoryId, setCategoryId] = useState(initialCategory && initialSkill ? initialCategory : null);
  const reduceMotion = useReducedMotion();

  // Allow deep links from elsewhere in the app (e.g. Learning Hub skill chips)
  useEffect(() => {
    if (initialSkill) {
      setSkillId(initialSkill);
      setCategoryId(initialCategory || null);
    }
  }, [initialSkill, initialCategory]);

  const skill = skillId ? getTipsSkill(skillId) : null;
  const category = skillId && categoryId ? getTipsCategory(skillId, categoryId) : null;

  const enter = (variants) => (reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { variants, initial: 'hidden', animate: 'show' });

  // ── Landing ────────────────────────────────────────────────────────────
  if (!skill) {
    return (
      <div className="tips-page">
        <header className="tips-header">
          <span className="tips-kicker">Tips &amp; Tricks</span>
          <h1 className="tips-title">The IELTS Study Toolkit</h1>
          <p className="tips-sub">Quick strategies, vocabulary and examples for every IELTS skill.</p>
        </header>

        <motion.div
          className="tips-skill-grid"
          {...enter(staggerParent)}
        >
          {TIPS_SKILLS_ORDERED.map((s) => {
            const tipCount = s.categories.reduce((n, c) => n + c.tips.length, 0);
            return (
              <motion.button
                key={s.id}
                type="button"
                className="tips-skill-card"
                style={{ '--skill-accent': s.accent }}
                onClick={() => setSkillId(s.id)}
                {...(reduceMotion ? {} : { variants: staggerChild })}
                whileHover={reduceMotion ? {} : { y: -3 }}
              >
                <span className="tips-skill-icon" aria-hidden="true">
                  <Icon name={s.icon} size={22} />
                </span>
                <span className="tips-skill-name">{s.name}</span>
                <span className="tips-skill-tagline">{s.tagline}</span>
                <span className="tips-skill-meta">
                  {s.categories.length} categories · {tipCount} tips
                  <Icon name="arrowRight" size={13} className="tips-skill-go" />
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    );
  }

  // ── Category detail ────────────────────────────────────────────────────
  if (category) {
    const isVocab = category.kind === 'vocab';
    return (
      <div className="tips-page">
        <BackChip onClick={() => setCategoryId(null)} label="All categories" />
        <header className="tips-cat-header">
          <h1 className="tips-cat-title" style={{ '--skill-accent': skill.accent }}>{category.title}</h1>
          {category.blurb && <p className="tips-cat-blurb">{category.blurb}</p>}
        </header>

        <motion.div
          className={isVocab ? 'tips-vocab-grid' : 'tips-tip-list'}
          {...enter(staggerParent)}
          key={category.id}
        >
          {category.tips.map((tip) => (
            <motion.div
              key={tip.id}
              {...(reduceMotion ? {} : { variants: staggerChild })}
            >
              {isVocab
                ? <VocabCard tip={tip} accent={skill.accent} />
                : <TipCard tip={tip} accent={skill.accent} />}
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  // ── Skill detail (categories) ──────────────────────────────────────────
  return (
    <div className="tips-page">
      <BackChip onClick={() => setSkillId(null)} label="All skills" />
      <header className="tips-skill-header" style={{ '--skill-accent': skill.accent }}>
        <span className="tips-skill-icon tips-skill-icon-lg" aria-hidden="true">
          <Icon name={skill.icon} size={26} />
        </span>
        <div>
          <h1 className="tips-skill-title">{skill.name}</h1>
          <p className="tips-skill-header-tagline">{skill.tagline}</p>
        </div>
      </header>

      <motion.div
        className="tips-category-grid"
        {...enter(staggerParent)}
        key={skill.id}
      >
        {skill.categories.map((cat) => (
          <motion.button
            key={cat.id}
            type="button"
            className={`tips-category-card ${cat.kind === 'vocab' ? 'is-vocab' : ''}`}
            onClick={() => setCategoryId(cat.id)}
            {...(reduceMotion ? {} : { variants: staggerChild })}
            whileHover={reduceMotion ? {} : { y: -2 }}
          >
            <span className="tips-category-top">
              <span className="tips-category-title">{cat.title}</span>
              <Icon name="arrowRight" size={14} className="tips-category-go" />
            </span>
            {cat.blurb && <span className="tips-category-blurb">{cat.blurb}</span>}
            <span className="tips-category-meta">
              {cat.tips.length} {cat.tips.length === 1 ? 'tip' : 'tips'}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
