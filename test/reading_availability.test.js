import assert from 'node:assert/strict';
import { CONTENT_CATALOG, PRODUCTION_READING, PRODUCTION_LISTENING, loadSkillContent } from '../src/data/production/registry.js';
import { EXCLUDED_READING_TEST_IDS, isReadingTestEnabled } from '../src/data/production/readingAvailability.js';
import { getAllProductionReadingTests, getProductionReadingTest } from '../src/data/production/adapters.js';
import { getReadingTest, getReadingTestForReview, getRandomizedReadingTest } from '../src/data/reading/index.js';
import { getAuthenticExam, getRandomizedFullExam } from '../src/data/exams/examAssembler.js';
import { chooseFreshTest } from '../src/utils/practiceSelection.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
import { buildAnswerReviewItems } from '../src/utils/answerReview.js';

assert.equal(PRODUCTION_READING.length, 109, 'all archived records remain available');
assert.equal((await loadSkillContent('reading')).length, 109, 'lazy loading retains original data');
assert.equal(EXCLUDED_READING_TEST_IDS.length, 36);
assert.equal(getAllProductionReadingTests().length, 73);
assert.equal(CONTENT_CATALOG.reading.length, 73);
assert.deepEqual(CONTENT_CATALOG.reading.map(r => r.id), getAllProductionReadingTests().map(r => r.id));
for (const record of PRODUCTION_READING) {
  const enabled = isReadingTestEnabled(record);
  for (const alias of [record.testId, String(record.testId), record.id, record.slug]) {
    assert.equal(Boolean(getReadingTest(alias)), enabled, `${alias}: explicit practice respects availability`);
    assert.equal(Boolean(getProductionReadingTest(alias, true)), enabled, `${alias}: focused practice respects availability`);
    assert.equal(getReadingTestForReview(alias, true).id, record.id, `${alias}: historical review retains original source`);
  }
  if (enabled) {
    const focused = selectFocusedContent(getProductionReadingTest(record.testId, true), {skill:'reading',part:3});
    assert.equal(focused.passages[0].sourceClusterId, record.id);
  }
}
const originalRandom = Math.random;
try {
  const randomIds = new Set();
  for (let i = 0; i < 73; i++) {
    Math.random = () => (i + 0.5) / 73;
    randomIds.add(getRandomizedReadingTest().testId);
    assert(isReadingTestEnabled(getReadingTest(chooseFreshTest('reading', CONTENT_CATALOG.reading, null))));
    assert(isReadingTestEnabled(getReadingTest(chooseFreshTest('reading-drill', CONTENT_CATALOG.reading, null))));
  }
  assert.equal(randomIds.size, 33, 'random practice prioritizes the 33 Cambridge matches; all 73 remain explicitly selectable');
  for (const test of PRODUCTION_LISTENING) {
    assert(isReadingTestEnabled(getAuthenticExam(test.testId).reading));
    assert(isReadingTestEnabled(getRandomizedFullExam(test.testId).reading));
  }
} finally { Math.random = originalRandom; }
assert.equal(getReadingTest(235, true), null, 'excluded original source cannot start a new test');
const archived = getReadingTestForReview(235, true);
const review = buildAnswerReviewItems({answers:{q11:'FALSE'}}, archived, 'reading');
assert.equal(review.q11.officialAnswer, 'FALSE', 'archived answer review still resolves corrected keys');
assert(review.q11.questionText);
assert.equal(getReadingTestForReview('missing'), null);
console.log('Reading availability passed: 36 excluded, 73 selectable, all 109 preserved for review; standalone, focused, and full mock selection checked.');
