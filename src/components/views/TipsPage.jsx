import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Icon from '../common/Icon';
import TipCard from '../common/TipCard';
import VocabCard from '../common/VocabCard';
import { TIPS_SKILLS_ORDERED, getTipsSkill } from '../../data/tips';

// ─── Tips & Tricks — one page you read top to bottom ────────────────────────
// A coach walks through each skill as a conversation: every topic is a short
// coach message followed by its tips and worked examples, all on the same
// page. Switching skill swaps the feed in place; topic chips only jump ahead.
// Nothing has to be opened to be read.

const OPENERS = {
  listening: 'You only hear it once, so the work happens before the audio starts. Here is how strong candidates listen.',
  reading: 'Reading is a search problem, not a reading problem. Let me show you how to find answers fast.',
  writing: 'Examiners mark four things. Every tip below moves one of them up a band.',
  speaking: 'Speaking is a conversation, not a recital. These habits make you sound natural and organised.',
};

function CoachLine({ children, reduceMotion }) {
  return (
    <motion.div
      className="coach-line"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="coach-avatar" aria-hidden="true">C</span>
      <div className="coach-bubble">{children}</div>
    </motion.div>
  );
}

export default function TipsPage({ initialSkill = null, initialCategory = null }) {
  const [skillId, setSkillId] = useState(getTipsSkill(initialSkill) ? initialSkill : TIPS_SKILLS_ORDERED[0].id);
  const reduceMotion = useReducedMotion();
  const topRef = useRef(null);
  const skill = getTipsSkill(skillId);
  const tipCount = skill.categories.reduce((n, c) => n + c.tips.length, 0);

  // deep link (e.g. "Tips for this question type" from a results page)
  useEffect(() => {
    if (!initialCategory) return;
    const el = document.getElementById(`tips-${initialCategory}`);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [initialCategory, reduceMotion]);

  const switchSkill = (id) => {
    setSkillId(id);
    topRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  const jumpTo = (catId) => {
    document.getElementById(`tips-${catId}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="tips-page tips-feed" style={{ '--skill-accent': skill.accent }}>
      <header className="tips-feed-header" ref={topRef}>
        <span className="tips-kicker">Tips &amp; Tricks</span>
        <h1 className="tips-title">Your IELTS coach</h1>
        <p className="tips-sub">Scroll through. Every strategy comes with a worked example you can use in your next test.</p>
      </header>

      <nav className="tips-skill-switch" aria-label="Choose a skill">
        {TIPS_SKILLS_ORDERED.map(s => (
          <button key={s.id} type="button" aria-pressed={s.id === skillId}
            className={s.id === skillId ? 'is-active' : ''} onClick={() => switchSkill(s.id)}>
            <Icon name={s.icon} size={15} />
            <span>{s.name}</span>
          </button>
        ))}
      </nav>

      <div className="tips-feed-body" key={skill.id}>
        <CoachLine reduceMotion={reduceMotion}>
          <p className="coach-title">{skill.name} · {skill.tagline}</p>
          <p>{OPENERS[skill.id]}</p>
          <p className="coach-meta">{skill.categories.length} topics · {tipCount} tips</p>
          <div className="tips-topic-chips" aria-label="Jump to a topic">
            {skill.categories.map(c => (
              <button key={c.id} type="button" onClick={() => jumpTo(c.id)}>{c.title}</button>
            ))}
          </div>
        </CoachLine>

        {skill.categories.map((cat) => (
          <section key={cat.id} id={`tips-${cat.id}`} className="tips-topic" aria-label={cat.title}>
            <CoachLine reduceMotion={reduceMotion}>
              <p className="coach-title">{cat.title}</p>
              {cat.blurb && <p>{cat.blurb}</p>}
            </CoachLine>
            <div className={cat.kind === 'vocab' ? 'tips-vocab-grid tips-thread' : 'tips-tip-list tips-thread'}>
              {cat.tips.map(tip => (
                <motion.div
                  key={tip.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  {cat.kind === 'vocab'
                    ? <VocabCard tip={tip} accent={skill.accent} />
                    : <TipCard tip={tip} accent={skill.accent} />}
                </motion.div>
              ))}
            </div>
          </section>
        ))}

        <CoachLine reduceMotion={reduceMotion}>
          <p className="coach-title">That's {skill.name}.</p>
          <p>Keep going with another skill:</p>
          <div className="tips-topic-chips">
            {TIPS_SKILLS_ORDERED.filter(s => s.id !== skill.id).map(s => (
              <button key={s.id} type="button" onClick={() => switchSkill(s.id)}>{s.name}</button>
            ))}
          </div>
        </CoachLine>
      </div>
    </div>
  );
}
