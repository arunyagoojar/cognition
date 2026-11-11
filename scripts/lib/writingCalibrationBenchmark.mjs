import { WRITING_FAIRNESS_GUIDANCE } from '../../src/utils/writingCalibration.js';
import { WRITING_SYSTEM_PROMPT_V2, WRITING_SYSTEM_PROMPT_COMPACT, normalizeWritingEvaluation } from '../../src/utils/ieltsRubric.js';
import { prepareWritingCoaching } from '../../src/utils/harper/writingCoachContract.js';
import fixtures from '../../qa/writing-calibration-benchmark.json' with { type: 'json' };

export function checkWritingCalibration() {
  const checks = [];
  const check = (id, sampleIds, passed, rule) => checks.push({ id, sampleIds, passed: Boolean(passed), rule });
  const coaching = prepareWritingCoaching({ text: 'A practice response.', task: { prompt: 'To what extent do you agree?' }, taskKind: 2 }).system;
  check('same-calibration', fixtures.samples.map(s => s.id), [WRITING_SYSTEM_PROMPT_V2, WRITING_SYSTEM_PROMPT_COMPACT, coaching].every(p => p.includes(WRITING_FAIRNESS_GUIDANCE)), 'All evaluation paths share calibration.');
  check('errors-are-not-blanket-caps', ['1B-B', '1C-C', '2A-C', '2B-B'], /few slips can coexist with Band 7 or 8/.test(WRITING_FAIRNESS_GUIDANCE), 'Assess severity and communication in context.');
  check('no-four-paragraph-rule', ['1B-B', '1C-B'], /no mandatory four-paragraph/.test(WRITING_FAIRNESS_GUIDANCE), 'Judge organisation rather than a template.');
  check('optional-comparison', ['2A-C'], /optional comparison is not an omitted task requirement/.test(WRITING_FAIRNESS_GUIDANCE), 'Do not invent additional prompt requirements.');
  check('copying-not-original-development', ['2A-B', '2B-A'], /Do not credit copied question text/.test(WRITING_FAIRNESS_GUIDANCE), 'Credit original task development.');
  const profile = (ta, cc, lr, gra) => ({ criteria: Object.fromEntries(['taskAchievement','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map((k, i) => [k, { band: [ta,cc,lr,gra][i] }])), hasOverview: false, overviewStatus: 'absent' });
  // Illustrative profiles test application mechanics; they are NOT claimed to
  // be the unpublished criterion marks of the human-scored sample scripts.
  const independent = normalizeWritingEvaluation({ task1: profile(5,7,8,8) }, { task1Words: 180, task2Words: 0 });
  check('criteria-independent', ['1C-B'], independent?.task1Band === 7, 'A task-fulfilment weakness does not cap the entire task at 5.');
  const imperfect = normalizeWritingEvaluation({ task1: { ...profile(6,6,6,6), overviewStatus: 'inadequate' } }, { task1Words: 180, task2Words: 0 });
  check('imperfect-not-absent', ['1A-B', '1B-A', '1C-C'], imperfect?.taskCriteria?.task1?.taskAchievement?.band === 6, 'An imperfect overview is distinguished from absence.');
  const weak = normalizeWritingEvaluation({ task1: profile(4,4,4,4) }, { task1Words: 180, task2Words: 0 });
  check('no-automatic-inflation', ['1A-A', '1C-A', '2A-A', '2B-A'], weak?.task1Band === 4, 'Low criterion evidence remains low.');
  return { mode: fixtures.mode, source: fixtures.source, sourceSha256: fixtures.sourceSha256, humanReferenceSamples: fixtures.samples,
    checks, passed: checks.every(c => c.passed), predictiveModelMetrics: null,
    limitation: 'Offline calibration and application-rule checks only. No Gemini/GPT-OSS predictions were requested, and no model accuracy or model-to-model equivalence was measured.' };
}
