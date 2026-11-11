import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRODUCTION_READING, PRODUCTION_WRITING, PRODUCTION_LISTENING } from '../src/data/production/registry.js';
import { adaptProductionReading, adaptProductionWriting } from '../src/data/production/adapters.js';
import { getRandomizedReadingTest, getReadingTest } from '../src/data/reading/index.js';
import { getRandomizedWritingTest } from '../src/data/writing/index.js';
import { getAuthenticExam, getRandomizedFullExam } from '../src/data/exams/examAssembler.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';

function checkReading(test) {
  const source = PRODUCTION_READING.find(record => record.id === test.id);
  assert(source, 'one complete source test is selected');
  assert.equal(test.sourceCluster.id, source.id);
  assert(test.passages.every(p => p.sourceClusterId === source.id));
  assert.deepEqual(test.passages, adaptProductionReading(source, true).passages,
    'passages, groups, questions, and options retain source order');
}
function checkWriting(test) {
  const source = PRODUCTION_WRITING.find(record => record.id === test.id);
  assert(source, 'writing uses one source package');
  const adapted = adaptProductionWriting(source);
  assert.deepEqual(test.task1, adapted.task1);
  assert.deepEqual(test.task2, adapted.task2);
}
// Exhaustively check the adapters, then exercise the actual selection entry points.
for (const record of PRODUCTION_READING) checkReading(adaptProductionReading(record, true));
for (const record of PRODUCTION_READING) {
  const original = JSON.parse(fs.readFileSync(new URL(`../content-db/reading/tests/${record.slug}.json`, import.meta.url)));
  assert.deepEqual(original.sourceNumbers, [record.testId]);
  assert.equal(record.source.sha256, original.provenance.page.sha256.slice(0, 16));
  assert.deepEqual(record.passages.map(p => p.passageNumber), original.passages.map(p => p.passageNumber));
  assert.deepEqual(record.passages.map(p => p.questions.map(q => q.questionNumber)), original.passages.map(p => p.questionGroups.flatMap(g => g.questions.map(q => q.number))));
}
assert.equal(getReadingTest('deleted-source-test', true), null, 'a missing explicit source never substitutes random passages');
for (const id of PRODUCTION_LISTENING.slice(0, 10).map(test => test.testId)) {
  const first = getRandomizedFullExam(id).reading;
  for (let i = 0; i < 5; i++) assert.equal(getRandomizedFullExam(id).reading.id, first.id, 'mock reconstruction retains the same complete cluster');
}
for (const record of PRODUCTION_WRITING) checkWriting(adaptProductionWriting(record));
for (let i = 0; i < 25; i++) {
  const reading = getRandomizedReadingTest(true);
  checkReading(reading);
  checkWriting(getRandomizedWritingTest());
  for (const exam of [getAuthenticExam(i + 1), getRandomizedFullExam()]) {
    checkReading(exam.reading);
    checkWriting(exam.writing);
  }
  const focused = selectFocusedContent(reading, { skill: 'reading', part: 3 });
  assert.deepEqual(focused.passages, [reading.passages[2]], 'short practice keeps its original passage and question order');
}
console.log('Reading/writing source task order preserved in practice, focused practice, and mocks.');
