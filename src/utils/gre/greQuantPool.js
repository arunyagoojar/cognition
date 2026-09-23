/**
 * Official ETS-calibrated GRE Quantitative Reasoning Question Pool
 * Complete 500-Question Official Bank covering all 6 GRE Quantitative Question Types:
 * 1. Quantitative Comparison (Quantity A vs Quantity B)
 * 2. Problem Solving - Select One Answer Choice (5 options)
 * 3. Problem Solving - Select One or More Answer Choices (Square checkboxes)
 * 4. Numeric Entry - Single Box (Integer or Decimal)
 * 5. Numeric Entry - Fraction Boxes (Numerator & Denominator)
 * 6. Data Interpretation Sets (Visual Bar Charts, Tables)
 */

import quantBank from '../../data/gre/quantBank.json';

export const QC_CHOICES = [
  'Quantity A is greater.',
  'Quantity B is greater.',
  'The two quantities are equal.',
  'The relationship cannot be determined from the information given.'
];

export const GRE_QUANT_QUESTIONS = quantBank;

/**
 * Returns a balanced section of Quantitative Reasoning questions
 * Mixes QC, Single Choice PS, Multi Choice PS, Numeric Entry, and Data Interpretation
 * @param {number} count (12 for Section 1, 15 for Section 2)
 */
export function getQuantSection(count = 12) {
  const qc = GRE_QUANT_QUESTIONS.filter(q => q.type === 'quant_comparison');
  const sc = GRE_QUANT_QUESTIONS.filter(q => q.type === 'single_choice');
  const mc = GRE_QUANT_QUESTIONS.filter(q => q.type === 'multi_choice');
  const ne = GRE_QUANT_QUESTIONS.filter(q => q.type === 'numeric_entry' || q.type === 'numeric_entry_fraction');
  const di = GRE_QUANT_QUESTIONS.filter(q => q.type === 'data_interpretation');

  const shuffle = (arr) => [...arr].sort(() => 0.5 - Math.random());

  const selected = [
    ...shuffle(qc).slice(0, 4),
    ...shuffle(sc).slice(0, 3),
    ...shuffle(mc).slice(0, 2),
    ...shuffle(ne).slice(0, 2),
    ...shuffle(di).slice(0, 2)
  ];

  if (selected.length < count) {
    const existingIds = new Set(selected.map(q => q.id));
    const remainder = GRE_QUANT_QUESTIONS.filter(q => !existingIds.has(q.id));
    selected.push(...shuffle(remainder).slice(0, count - selected.length));
  }

  return shuffle(selected).slice(0, count).map((q, idx) => ({
    ...q,
    instanceId: `${q.id}_${idx}_${Date.now()}`
  }));
}
