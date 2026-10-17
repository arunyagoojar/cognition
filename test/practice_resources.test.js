import assert from 'node:assert/strict';
import { resolvePracticeResource } from '../src/utils/practiceResources.js';
import { resolveRecommendations } from '../src/data/recommendations.js';
import { getTipsCategory } from '../src/data/tips/index.js';
import { LEARNING_SKILLS } from '../src/data/learningCatalog.js';
import { makeDialogBackgroundInert } from '../src/hooks/useDialog.js';

const linked = resolveRecommendations({ key: 'reading.matching_headings', skill: 'reading' });
const strategy = resolvePracticeResource({ kind: 'strategy', tip: linked.tip });
assert.equal(strategy.category.id, 'reading-matching-headings');
assert.equal(strategy.tips, getTipsCategory('reading', linked.tip.categoryId).tips);
assert.ok(strategy.tips.every(tip => tip.demos?.length), 'The existing worked examples are retained.');

const specificTip = strategy.tips[0];
const single = resolvePracticeResource({ kind: 'strategy', tip: { ...linked.tip, tipId: specificTip.id } });
assert.deepEqual(single.tips, [specificTip]);
assert.equal(single.title, specificTip.title);
assert.equal(resolvePracticeResource({ kind: 'strategy', tip: { ...linked.tip, tipId: 'obsolete-tip' } }), null);
assert.equal(resolvePracticeResource({ kind: 'strategy', tip: { skill: 'reading', categoryId: 'writing-t1-overview' } }), null);

const lesson = resolvePracticeResource({ kind: 'lesson', lesson: { id: 'sp-3', title: 'Ignore this stale title' } });
assert.equal(lesson.lesson, LEARNING_SKILLS.find(skill => skill.id === 'speaking').lessons.find(item => item.id === 'sp-3'));
assert.equal(lesson.title, 'Mastering Speaking Part 2: Long Turn & Cue Card');
assert.ok(lesson.lesson.duration && lesson.lesson.description && lesson.lesson.takeaways.length);
assert.equal(resolvePracticeResource({ kind: 'lesson', lesson: { id: 'missing' } }), null);
assert.equal(resolvePracticeResource(null), null);

for (const [key, lessonId, categoryId] of [
  ['speaking.part1', 'sp-2', 'speaking-part1'],
  ['speaking.part2', 'sp-3', 'speaking-part2'],
  ['speaking.part3', 'sp-4', 'speaking-part3'],
  ['writing.task1', 'wr-6', 'writing-t1-overview'],
  ['writing.task2', 'wr-7', 'writing-t2-understand'],
]) {
  const resources = resolveRecommendations({ key, skill: key.split('.')[0] });
  assert.equal(resources.lesson.id, lessonId, `${key} opens its own task or part lesson.`);
  assert.equal(resources.tip.categoryId, categoryId, `${key} opens the corresponding strategy.`);
  const preview = resolvePracticeResource({ kind: 'lesson', lesson: resources.lesson });
  const part = Number(key.at(-1));
  assert.match(preview.title, new RegExp(`(?:Part|Task) ${part}`));
  assert.ok(resources.moreLessonIds.every(id => LEARNING_SKILLS.find(skill => skill.id === key.split('.')[0]).lessons.some(item => item.id === id)));
}

const grammar = resolveRecommendations({ key: 'speaking.grammaticalRangeAndAccuracy', skill: 'speaking' });
assert.equal(grammar.lesson, null, 'An unrelated Part 3 lesson is not presented as grammar training.');
assert.equal(grammar.tip.categoryId, 'speaking-grammar');
const writingGrammar = resolveRecommendations({ key: 'writing.grammaticalRangeAndAccuracy', skill: 'writing' });
const grammarPreview = resolvePracticeResource({ kind: 'strategy', tip: writingGrammar.tip });
assert.deepEqual(grammarPreview.tips.map(tip => tip.id), ['w-assess-grammar']);
for (const skill of ['reading', 'listening', 'writing', 'speaking']) {
  const unknown = resolveRecommendations({ key: `${skill}.unsupported-part`, skill });
  assert.equal(unknown.lesson, null);
  assert.equal(unknown.tip, null);
  assert.equal(unknown.practice.view, skill);
}

// A portaled sheet must make the underlying app inert, including body siblings.
// Preserve pre-existing inert state so another hidden surface stays hidden.
class Element {
  constructor(children = [], inert = false) {
    this.children = children;
    this.inert = inert;
    for (const child of children) child.parentElement = this;
  }
}
const savedDocument = globalThis.document;
const savedHTMLElement = globalThis.HTMLElement;
try {
  globalThis.HTMLElement = Element;
  const dialog = new Element();
  const insideSibling = new Element();
  const portal = new Element([insideSibling, dialog]);
  const app = new Element();
  const previouslyHidden = new Element([], true);
  globalThis.document = { body: new Element([app, previouslyHidden, portal]) };
  const restore = makeDialogBackgroundInert(dialog);
  assert.equal(app.inert, true, 'Underlying app cannot receive focus.');
  assert.equal(insideSibling.inert, true, 'Other content inside the portal is isolated.');
  assert.equal(dialog.inert, false);
  assert.equal(portal.inert, false, 'The dialog ancestor stays interactive.');
  restore();
  assert.equal(app.inert, false);
  assert.equal(insideSibling.inert, false);
  assert.equal(previouslyHidden.inert, true, 'Previously inert content remains inert after close.');
} finally {
  globalThis.document = savedDocument;
  globalThis.HTMLElement = savedHTMLElement;
}
console.log('Practice resources: exact content mapping and portaled-dialog background isolation passed.');
