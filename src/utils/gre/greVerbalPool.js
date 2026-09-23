/**
 * Official ETS-calibrated GRE Verbal Reasoning Question Pool
 * Complete 500-Question Official Bank covering all 8 GRE Verbal Question Types:
 * 1. Text Completion (1 Blank)
 * 2. Text Completion (2 Blanks)
 * 3. Text Completion (3 Blanks)
 * 4. Sentence Equivalence
 * 5. Reading Comprehension (Single Choice)
 * 6. Reading Comprehension (Multi-Select)
 * 7. Reading Comprehension (Select-in-Passage)
 * 8. Critical Reasoning / Argument Analysis
 */

import verbalBank from '../../data/gre/verbalBank.json';

export const GRE_VERBAL_QUESTIONS = verbalBank;

/**
 * Returns a balanced section of Verbal Reasoning questions
 * Mixes Text Completion, Sentence Equivalence, Reading Comprehension, and Critical Reasoning
 * @param {number} count (12 for Section 1, 15 for Section 2)
 */
export function getVerbalSection(count = 12) {
  const tc1 = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'text_completion_1');
  const tc2 = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'text_completion_2');
  const tc3 = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'text_completion_3');
  const se  = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'sentence_equivalence');
  const rcS = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'reading_comprehension_single');
  const rcM = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'reading_comprehension_multi');
  const sip = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'reading_comprehension_select_passage');
  const cr  = GRE_VERBAL_QUESTIONS.filter(q => q.type === 'critical_reasoning');

  const shuffle = (arr) => [...arr].sort(() => 0.5 - Math.random());

  const selected = [
    ...shuffle(tc1).slice(0, 2),
    ...shuffle(tc2).slice(0, 2),
    ...shuffle(tc3).slice(0, 1),
    ...shuffle(se).slice(0, 2),
    ...shuffle(rcS).slice(0, 2),
    ...shuffle(rcM).slice(0, 1),
    ...shuffle(sip).slice(0, 1),
    ...shuffle(cr).slice(0, 1),
  ];

  if (selected.length < count) {
    const existingIds = new Set(selected.map(q => q.id));
    const remainder = GRE_VERBAL_QUESTIONS.filter(q => !existingIds.has(q.id));
    selected.push(...shuffle(remainder).slice(0, count - selected.length));
  }

  return shuffle(selected).slice(0, count).map((q, idx) => ({
    ...q,
    instanceId: `${q.id}_${idx}_${Date.now()}`
  }));
}
