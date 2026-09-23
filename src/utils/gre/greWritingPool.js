/**
 * Official ETS & MiM-Essay "Analyze an Issue" Prompts for GRE Analytical Writing (AWA)
 * Standard testing duration: 30 minutes
 * Scored on 0.0 to 6.0 scale in half-point increments
 */

export const GRE_ISSUE_PROMPTS = [
  {
    id: 'awa_issue_mim_01',
    source: 'MiM-Essay GRE Diagnostic Paper 1 (2026)',
    topic: 'Technology & Human Independence',
    prompt: 'As people rely increasingly on technology to solve problems, the ability to think independently has become less important.',
    claim: 'As people rely increasingly on technology to solve problems, the ability to think independently has become less important.',
    instructions: 'Write a response in which you discuss the extent to which you agree or disagree with the statement and explain the reasons for your position. In developing your response, you should consider situations in which the statement might or might not hold true and explain how these considerations shape your position.',
    instruction: 'Write a response in which you discuss the extent to which you agree or disagree with the statement and explain the reasons for your position. In developing your response, you should consider situations in which the statement might or might not hold true and explain how these considerations shape your position.',
    guidelines: [
      'Present a clear thesis with a balanced or nuanced perspective.',
      'Provide specific examples from education, professional environments, or daily life.',
      'Address counterarguments (e.g. how technology offloads menial tasks to allow higher-order creative thinking).',
      'Maintain strong lexical variety and cohesive transitions.'
    ]
  },
  {
    id: 'awa_issue_mim_02',
    source: 'MiM-Essay GRE Sample Paper 2 (2026)',
    topic: 'Scientific Research Priorities',
    prompt: 'Governments should prioritize funding scientific research that has immediate practical applications rather than research that expands fundamental knowledge without obvious short-term benefits.',
    claim: 'Governments should prioritize funding scientific research that has immediate practical applications rather than research that expands fundamental knowledge without obvious short-term benefits.',
    instructions: 'Write an essay in which you discuss the extent to which you agree or disagree with the statement. Be sure to explain your reasoning and consider circumstances under which the statement might or might not hold true.',
    instruction: 'Write an essay in which you discuss the extent to which you agree or disagree with the statement. Be sure to explain your reasoning and consider circumstances under which the statement might or might not hold true.',
    guidelines: [
      'Compare utilitarian short-term applied research vs long-term serendipitous fundamental research.',
      'Reference historical discoveries (e.g. quantum mechanics leading to semiconductors, penicillin, CRISPR).',
      'Acknowledge public health crises where immediate application is paramount.'
    ]
  },
  {
    id: 'awa_issue_ets_01',
    source: 'Official ETS Issue Pool',
    topic: 'Education & Curriculum Diversity',
    prompt: 'Educational institutions should actively encourage students to choose fields of study that prepare them for in-demand careers rather than allowing them to pursue subjects strictly according to their personal interests.',
    claim: 'Educational institutions should actively encourage students to choose fields of study that prepare them for in-demand careers rather than allowing them to pursue subjects strictly according to their personal interests.',
    instructions: 'Discuss the extent to which you agree or disagree with the recommendation and explain your reasoning for the position you take. In developing and supporting your position, describe specific circumstances in which adopting the recommendation would or would not be advantageous.',
    instruction: 'Discuss the extent to which you agree or disagree with the recommendation and explain your reasoning for the position you take. In developing and supporting your position, describe specific circumstances in which adopting the recommendation would or would not be advantageous.',
    guidelines: [
      'Examine economic workforce readiness vs personal fulfillment and intellectual breadth.',
      'Explore how interdisciplinary studies foster disruptive innovation.'
    ]
  },
  {
    id: 'awa_issue_ets_02',
    source: 'Official ETS Issue Pool',
    topic: 'Leadership & Moral Character',
    prompt: 'The effectiveness of a leader in politics, business, or the military depends fundamentally on their moral character, not merely on their technical competence or strategic vision.',
    claim: 'The effectiveness of a leader in politics, business, or the military depends fundamentally on their moral character, not merely on their technical competence or strategic vision.',
    instructions: 'Write a response in which you discuss the extent to which you agree or disagree with the statement. Explain your reasoning and consider situations where technical brilliance might outweigh or require ethical grounding.',
    instruction: 'Write a response in which you discuss the extent to which you agree or disagree with the statement. Explain your reasoning and consider situations where technical brilliance might outweigh or require ethical grounding.',
    guidelines: [
      'Analyze the interplay between public trust, ethical integrity, and pragmatic effectiveness.',
      'Provide historical or contemporary case studies of leadership triumphs and moral failures.'
    ]
  }
];

export function getRandomIssuePrompt() {
  const idx = Math.floor(Math.random() * GRE_ISSUE_PROMPTS.length);
  return GRE_ISSUE_PROMPTS[idx];
}

export const getRandomWritingPrompt = getRandomIssuePrompt;
