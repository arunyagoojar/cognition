import { getTipsCategory, getTipsSkill } from '../data/tips/index.js';
import { LEARNING_SKILLS } from '../data/learningCatalog.js';

// Resolve the selected resource by its stable ID. Never substitute a different
// strategy or lesson when a saved recommendation contains an obsolete link.
export function resolvePracticeResource(resource) {
  if (resource?.kind === 'strategy') {
    const link = resource.tip;
    const skill = getTipsSkill(link?.skill);
    const category = getTipsCategory(link?.skill, link?.categoryId);
    if (!skill || !category) return null;
    const tips = link.tipId ? category.tips.filter(tip => tip.id === link.tipId) : category.tips;
    if (!tips.length) return null;
    return { kind: 'strategy', skill, category, tips,
      title: link.tipId ? tips[0].title : category.title };
  }
  if (resource?.kind === 'lesson') {
    const skill = LEARNING_SKILLS.find(group => group.lessons.some(lesson => lesson.id === resource.lesson?.id));
    const lesson = skill?.lessons.find(item => item.id === resource.lesson?.id);
    return lesson ? { kind: 'lesson', skill, lesson, title: lesson.title } : null;
  }
  return null;
}
