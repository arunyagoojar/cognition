/**
 * Weakness → resource mapping layer (Phase 6).
 * Every recommendation points at EXISTING Cognition content:
 *   lesson:  learningCatalog lesson id (Learning Hub)
 *   tip:     tips category id (Tips & Tricks page, pre-opened)
 *   practice: a skill view the dashboard can route to
 * Extend by adding rows — the UI never hardcodes routes.
 */
import { LEARNING_SKILLS } from './learningCatalog.js';
import { TIPS_SKILLS_ORDERED } from './tips/index.js';

const lessonById = new Map();
for (const s of LEARNING_SKILLS) for (const l of s.lessons) lessonById.set(l.id, l);

const tipCategoryById = new Map();
for (const s of TIPS_SKILLS_ORDERED) for (const c of s.categories) tipCategoryById.set(c.id, { skill: s.id, category: c });

const PRACTICE_VIEWS = {
  reading: 'Reading Practice',
  listening: 'Listening Practice',
  writing: 'Writing Practice',
  speaking: 'Speaking Practice',
};

const MAPPING = {
  // ── Reading ──
  'reading.tfng': { lessons: ['rd-4'], tips: ['reading-tfng'], practice: 'reading' },
  'reading.ynng': { lessons: ['rd-4'], tips: ['reading-ynng'], practice: 'reading' },
  'reading.matching_headings': { lessons: ['rd-2', 'rd-3'], tips: ['reading-matching-headings'], practice: 'reading' },
  'reading.matching_information': { lessons: ['rd-3'], tips: ['reading-matching-info'], practice: 'reading' },
  'reading.matching_features': { lessons: ['rd-3'], tips: ['reading-matching-info'], practice: 'reading' },
  'reading.matching_box': { lessons: ['rd-3'], tips: ['reading-matching-info'], practice: 'reading' },
  'reading.mcq_single': { lessons: ['rd-2'], tips: ['reading-multiple-choice'], practice: 'reading' },
  'reading.mcq_multi': { lessons: ['rd-2'], tips: ['reading-multiple-choice'], practice: 'reading' },
  'reading.completion': { lessons: ['rd-2'], tips: ['reading-sentence-completion'], practice: 'reading' },
  'reading.short_answer': { lessons: ['rd-2'], tips: ['reading-scanning'], practice: 'reading' },
  'reading.overall': { lessons: ['rd-2', 'rd-5'], tips: ['reading-time-management'], practice: 'reading' },

  // ── Listening ──
  'listening.fill_in_blank': { lessons: ['ls-2'], tips: ['listening-predict', 'listening-word-limits'], practice: 'listening' },
  'listening.completion': { lessons: ['ls-2'], tips: ['listening-word-limits'], practice: 'listening' },
  'listening.short_answer': { lessons: ['ls-2'], tips: ['listening-question-order'], practice: 'listening' },
  'listening.map_labeling': { lessons: ['ls-1'], tips: ['listening-map-diagram'], practice: 'listening' },
  'listening.diagram_labeling': { lessons: ['ls-1'], tips: ['listening-map-diagram'], practice: 'listening' },
  'listening.mcq_single': { lessons: ['ls-3'], tips: ['listening-multiple-choice', 'listening-distractors'], practice: 'listening' },
  'listening.mcq_multi': { lessons: ['ls-3'], tips: ['listening-multiple-choice'], practice: 'listening' },
  'listening.matching_box': { lessons: ['ls-3'], tips: ['listening-distractors'], practice: 'listening' },
  'listening.overall': { lessons: ['ls-1', 'ls-3'], tips: ['listening-common-traps'], practice: 'listening' },

  // ── Writing ──
  'writing.taskAchievement': { lessons: ['wr-6', 'wr-7'], tips: ['writing-t2-understand', 'writing-t1-overview'], practice: 'writing' },
  'writing.taskResponse': { lessons: ['wr-7'], tips: ['writing-t2-understand'], practice: 'writing' },
  'writing.coherenceAndCohesion': { lessons: ['wr-5', 'wr-2', 'wr-3'], tips: ['writing-t2-body'], practice: 'writing' },
  'writing.lexicalResource': { lessons: ['wr-8', 'wr-4'], tips: ['writing-vocab-bank'], practice: 'writing' },
  'writing.grammaticalRangeAndAccuracy': { lessons: ['wr-1', 'wr-4'], tips: ['writing-t2-structures'], practice: 'writing' },

  // ── Speaking ──
  'speaking.fluencyAndCoherence': { lessons: ['sp-1', 'sp-2'], tips: ['speaking-fluency', 'speaking-natural'], practice: 'speaking' },
  'speaking.lexicalResource': { lessons: ['sp-1'], tips: ['speaking-vocabulary'], practice: 'speaking' },
  'speaking.grammaticalRangeAndAccuracy': { lessons: ['sp-4'], tips: ['speaking-grammar'], practice: 'speaking' },
  'speaking.developing_answers': { lessons: ['sp-3', 'sp-4'], tips: ['speaking-developing-answers', 'speaking-part3'], practice: 'speaking' },
  'speaking.overall': { lessons: ['sp-2'], tips: ['speaking-part1'], practice: 'speaking' },
};

/**
 * Resolves a focus area to real, existing resources.
 * Returns null entries when no mapping exists — the UI then shows practice only.
 */
export function resolveRecommendations(focusArea) {
  if (!focusArea?.key) return null;
  const base = MAPPING[focusArea.key] || MAPPING[`${focusArea.skill}.${focusArea.skill === 'speaking' ? 'developing_answers' : 'overall'}`] || null;
  if (!base) {
    return {
      practice: { label: PRACTICE_VIEWS[focusArea.skill] || 'Practice', view: focusArea.skill },
      lesson: null,
      tip: null,
    };
  }

  const lessonIds = (base.lessons || []).filter(id => lessonById.has(id));
  const lesson = lessonIds.length
    ? { id: lessonIds[0], title: lessonById.get(lessonIds[0]).title }
    : null;
  const moreLessonIds = lessonIds.slice(1).filter(id => lessonById.has(id));

  const tipCategory = (base.tips || []).map(id => tipCategoryById.get(id)).find(Boolean) || null;
  const tip = tipCategory
    ? { skill: tipCategory.skill, categoryId: tipCategory.category.id, title: tipCategory.category.title }
    : null;

  return {
    practice: { label: PRACTICE_VIEWS[focusArea.skill] || 'Practice', view: focusArea.skill },
    lesson,
    moreLessonIds,
    tip,
  };
}
