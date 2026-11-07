import assert from 'node:assert/strict';
import { PRODUCTION_READING, PRODUCTION_WRITING } from '../src/data/production/registry.js';
import { adaptProductionReading, adaptProductionWriting } from '../src/data/production/adapters.js';
import { getRandomizedReadingTest } from '../src/data/reading/index.js';
import { getRandomizedWritingTest } from '../src/data/writing/index.js';
import { getAuthenticExam, getRandomizedFullExam } from '../src/data/exams/examAssembler.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';

function checkReading(test) {
  const source = PRODUCTION_READING.find(record => record.id === test.id);
  assert(source, 'one complete source test is selected');
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
