// ─── Tips & Tricks — unified content architecture ────────────────────────────
// One model for all four skills:
//
//   Skill { id, name, tagline, icon, accent, categories[] }
//     └─ Category { id, title, blurb, kind? ('vocab'), tips[] }
//          └─ Tip { id, title, short, explanation?, takeaway?, kind?, demos[] }
//
// Demo types (rendered by TipCard):
//   { type: 'beforeAfter', beforeLabel?, before, afterLabel?, after, note? }
//   { type: 'qa', question, weak, weakLabel?, better, betterLabel?, note? }
//   { type: 'flow', steps: [{ label, text }] }
//   { type: 'lines', rows: [{ label, text }] }
//   { type: 'vocab', chips[], quickExample, quickNote, items: [{word, meaning, example, strength}] }
//
// Content is data only — adding a tip never touches the UI implementation.

import { LISTENING_TIPS } from './listening.js';
import { READING_TIPS } from './reading.js';
import { WRITING_TIPS } from './writing.js';
import { SPEAKING_TIPS } from './speaking.js';

export const TIPS_SKILLS = [LISTENING_TIPS, READING_TIPS, WRITING_TIPS, SPEAKING_TIPS];

export const TIPS_ORDER = ['listening', 'reading', 'writing', 'speaking'];

// Sort into a stable display order: Listening, Reading, Writing, Speaking
export const TIPS_SKILLS_ORDERED = TIPS_ORDER
  .map(id => TIPS_SKILLS.find(s => s.id === id))
  .filter(Boolean);

export function getTipsSkill(skillId) {
  return TIPS_SKILLS_ORDERED.find(s => s.id === skillId) || null;
}

export function getTipsCategory(skillId, categoryId) {
  const skill = getTipsSkill(skillId);
  return skill?.categories.find(c => c.id === categoryId) || null;
}

// Count of tips with at least one micro-example demo (for QA/tests)
export function countTipsWithExamples() {
  let total = 0;
  let withExamples = 0;
  for (const skill of TIPS_SKILLS_ORDERED) {
    for (const category of skill.categories) {
      for (const tip of category.tips) {
        total += 1;
        if ((tip.demos && tip.demos.length > 0) || tip.kind === 'vocab') withExamples += 1;
      }
    }
  }
  return { total, withExamples };
}
