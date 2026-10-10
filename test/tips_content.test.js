/**
 * Tips & Tricks content contract tests.
 * Guards the unified content architecture: four skills, stable IDs,
 * micro-example coverage, and the unified vocabulary card model.
 * Data-only (no DOM) — mirrors how production content tests run in Node.
 */
import assert from 'node:assert/strict';
import {
  TIPS_SKILLS_ORDERED,
  TIPS_ORDER,
  getTipsSkill,
  getTipsCategory,
  countTipsWithExamples,
} from '../src/data/tips/index.js';
import {
  PHRASE_BANK,
  PHRASE_BANK_LINKED_CATEGORIES,
  countPhrases,
  filterPhraseBank,
} from '../src/data/tips/phraseBank.js';
import { shouldShowOnboarding, markOnboardingComplete, getCompletedOnboardingUser } from '../src/utils/onboarding.js';

let passed = 0, failed = 0;
function t(label, fn) {
  try { fn(); passed++; console.log('  ✓ PASS:', label); }
  catch (e) { failed++; console.error('  ✗ FAIL:', label, '—', e.message); }
}

console.log('== Tips & Tricks: skill structure ==');
t('exactly four skill sections in fixed order', () => {
  assert.deepEqual(TIPS_SKILLS_ORDERED.map(s => s.id), TIPS_ORDER);
  assert.deepEqual(TIPS_ORDER, ['listening', 'reading', 'writing', 'speaking']);
});
t('every skill has name, tagline, icon and categories', () => {
  for (const skill of TIPS_SKILLS_ORDERED) {
    assert.ok(skill.name && skill.tagline && skill.icon, `${skill.id} metadata`);
    assert.ok(skill.categories.length >= 5, `${skill.id} has a meaningful category set`);
    for (const cat of skill.categories) {
      assert.ok(cat.id && cat.title, `${skill.id}/${cat.id} identity`);
      assert.ok(cat.tips.length >= 1, `${skill.id}/${cat.id} has tips`);
    }
  }
});
t('all tip IDs are globally unique and stable (slug-shaped)', () => {
  const ids = [];
  for (const skill of TIPS_SKILLS_ORDERED) {
    for (const cat of skill.categories) {
      for (const tip of cat.tips) ids.push(tip.id);
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate tip id found');
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});
t('all category IDs are globally unique', () => {
  const ids = TIPS_SKILLS_ORDERED.flatMap(s => s.categories.map(c => c.id));
  assert.equal(new Set(ids).size, ids.length);
});

console.log('== Tips & Tricks: micro-example coverage ==');
t('the vast majority of tips carry at least one demo block', () => {
  const { total, withExamples } = countTipsWithExamples();
  assert.ok(total >= 50, `expected a substantial toolkit, got ${total} tips`);
  const ratio = withExamples / total;
  assert.ok(ratio >= 0.85, `example coverage ${(ratio * 100).toFixed(1)}% below 85%`);
});
t('demo blocks always use a known renderer type', () => {
  const KNOWN = new Set(['beforeAfter', 'qa', 'flow', 'lines', 'vocab']);
  for (const skill of TIPS_SKILLS_ORDERED) {
    for (const cat of skill.categories) {
      for (const tip of cat.tips) {
        for (const demo of tip.demos || []) {
          assert.ok(KNOWN.has(demo.type), `${tip.id} has unknown demo type ${demo.type}`);
        }
      }
    }
  }
});
t('no walls of text — explanations stay compact', () => {
  for (const skill of TIPS_SKILLS_ORDERED) {
    for (const cat of skill.categories) {
      for (const tip of cat.tips) {
        assert.ok(
          (tip.explanation || '').length <= 400,
          `${tip.id} explanation too long (${(tip.explanation || '').length} chars)`
        );
      }
    }
  }
});
t('helpers resolve skills and categories by stable id', () => {
  assert.equal(getTipsSkill('writing').name, 'Writing');
  assert.equal(getTipsSkill('nonsense'), null);
  assert.ok(getTipsCategory('writing', 'writing-t2-intro').tips.length >= 1);
  assert.equal(getTipsCategory('writing', 'nonsense'), null);
});

console.log('== Tips & Tricks: unified vocabulary system ==');
t('vocabulary lives in the Writing vocabulary bank as expandable cards', () => {
  const bank = getTipsCategory('writing', 'writing-vocab-bank');
  assert.ok(bank, 'vocabulary bank category exists');
  assert.equal(bank.kind, 'vocab');
  const expectedCards = ['w-vocab-upward', 'w-vocab-downward', 'w-vocab-stable', 'w-vocab-fluctuations',
    'w-vocab-size', 'w-vocab-fractions', 'w-vocab-time', 'w-vocab-comparisons', 'w-vocab-map', 'w-vocab-process'];
  for (const id of expectedCards) {
    const card = bank.tips.find(tip => tip.id === id);
    assert.ok(card, `missing vocab card ${id}`);
    assert.ok(card.chips.length >= 3, `${id} shows word chips`);
    assert.ok(card.quickExample && card.quickNote, `${id} has quick example + note`);
    for (const item of card.items) {
      assert.ok(item.word && item.meaning && item.example && item.strength, `${id} item missing fields`);
    }
  }
});
t('every vocab item includes a usage strength note (natural-usage teaching)', () => {
  const bank = getTipsCategory('writing', 'writing-vocab-bank');
  for (const card of bank.tips) {
    for (const item of card.items) {
      assert.ok(item.strength.length >= 10, `${item.word} lacks guidance`);
    }
  }
});

console.log('== Tips & Tricks: Writing from handwritten notes ==');
t('Writing preserves the notes’ core terminology', () => {
  const writing = JSON.stringify(getTipsSkill('writing'));
  for (const term of [
    'Family Feud', 'topic sentence', 'Therefore', 'linear, multi-stage', 'constituted',
    'accounting for', 'foyer', 'repurposed', 'doubled', 'halved', 'well regarded',
    'just below', 'sizeable', 'latter half', 'Initially', 'Subsequently',
  ]) {
    assert.ok(writing.includes(term), `notes term missing: ${term}`);
  }
});
t('Writing covers Task 2, Task 1, Vocabulary and Assessment groups', () => {
  const cats = getTipsSkill('writing').categories.map(c => c.id);
  for (const expected of [
    'writing-t2-understand', 'writing-t2-plan', 'writing-t2-structures', 'writing-t2-intro',
    'writing-t2-body', 'writing-t2-conclusion', 'writing-t2-question-types', 'writing-t2-final-scan',
    'writing-t1-intro', 'writing-t1-overview', 'writing-t1-body', 'writing-t1-line-graphs',
    'writing-t1-bar-charts', 'writing-t1-pie-charts', 'writing-t1-tables',
    'writing-t1-process-diagrams', 'writing-t1-maps', 'writing-vocab-bank', 'writing-assessment',
  ]) {
    assert.ok(cats.includes(expected), `missing writing category ${expected}`);
  }
});

console.log('== Speaking: Band 7–9 Phrase Bank ==');
t('phrase bank has its own id, title, intro and advice', () => {
  assert.equal(PHRASE_BANK.id, 'speaking-phrase-bank');
  assert.ok(PHRASE_BANK.title && PHRASE_BANK.intro);
  assert.ok(PHRASE_BANK.advice.length >= 3);
  const tipCategoryIds = TIPS_SKILLS_ORDERED.flatMap(s => s.categories.map(c => c.id));
  assert.ok(!tipCategoryIds.includes(PHRASE_BANK.id), 'section anchor must not collide with a tips category');
});
t('categories are complete and uniquely identified', () => {
  assert.ok(PHRASE_BANK.categories.length >= 10, 'expected the full set of functional groups');
  const ids = PHRASE_BANK.categories.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate phrase bank category id');
  for (const cat of PHRASE_BANK.categories) {
    assert.match(cat.id, /^pb-[a-z0-9-]+$/);
    assert.ok(cat.title && cat.chip && cat.intro, `${cat.id} metadata`);
    assert.ok(cat.phrases.length >= 5, `${cat.id} has phrases`);
  }
});
t('every phrase has a unique slug id and non-empty phrase, tag, note and example', () => {
  const ids = [];
  const phrases = [];
  for (const cat of PHRASE_BANK.categories) {
    for (const item of cat.phrases) {
      ids.push(item.id);
      phrases.push(item.phrase.toLowerCase());
      assert.match(item.id, /^pb-[a-z0-9-]+$/);
      for (const field of ['phrase', 'tag', 'note', 'example']) {
        assert.ok(typeof item[field] === 'string' && item[field].trim().length > 0, `${item.id} missing ${field}`);
      }
      assert.ok(item.note.length >= 30 && item.note.length <= 220, `${item.id} note should be short but useful`);
      assert.ok(item.example.length >= 30, `${item.id} example should be a full sentence`);
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate phrase id');
  assert.equal(new Set(phrases).size, phrases.length, 'duplicate phrase');
  assert.equal(countPhrases(), ids.length);
  assert.ok(ids.length >= 100, `expected at least 100 phrases, got ${ids.length}`);
});
t('search is case- and apostrophe-insensitive; category filter narrows', () => {
  const hit = filterPhraseBank('IM OF THE OPINION').flatMap(c => c.phrases);
  assert.deepEqual(hit.map(p => p.id), ['pb-im-of-the-opinion-that']);
  assert.equal(filterPhraseBank("I'm inclined").flatMap(c => c.phrases).length, 1);
  assert.equal(filterPhraseBank('no-such-phrase-anywhere').length, 0);
  const one = filterPhraseBank('', 'pb-linking');
  assert.equal(one.length, 1);
  assert.equal(one[0].phrases.length, PHRASE_BANK.categories.find(c => c.id === 'pb-linking').phrases.length);
  assert.equal(filterPhraseBank('').length, PHRASE_BANK.categories.length);
});
t('linked speaking categories exist so the coach links render', () => {
  for (const id of PHRASE_BANK_LINKED_CATEGORIES) {
    assert.ok(getTipsCategory('speaking', id), `missing speaking category ${id}`);
  }
});

console.log('== Onboarding persistence ==');
t('shows for a fresh user and stays hidden after completion', () => {
  globalThis.localStorage = {
    store: {},
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; },
  };
  assert.equal(getCompletedOnboardingUser(), '');
  assert.equal(shouldShowOnboarding('user_1'), true);
  markOnboardingComplete('user_1');
  assert.equal(shouldShowOnboarding('user_1'), false, 'must not replay for the same user');
  assert.equal(shouldShowOnboarding('user_2'), true, 'a different account still gets the tour');
});
t('repeated completion is idempotent', () => {
  markOnboardingComplete('user_1');
  markOnboardingComplete('user_1');
  assert.equal(shouldShowOnboarding('user_1'), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
