import assert from 'node:assert/strict';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
import { speakingPartComplete, speakingQuestionKey, speakingTestContext } from '../src/utils/speakingContext.js';
import { buildSpeakingUserPrompt } from '../src/utils/ieltsRubric.js';
import { getProductionListeningTest, getProductionReadingTest, getProductionSpeakingPackage } from '../src/data/production/adapters.js';
import { CONTENT_CATALOG } from '../src/data/production/registry.js';

const readingSource = getProductionReadingTest(100, true);
const listeningSource = getProductionListeningTest(185, true);
const speakingSource = getProductionSpeakingPackage(CONTENT_CATALOG.speaking[0].id);

for (let part = 1; part <= 3; part++) {
  const selected = selectFocusedContent(readingSource, { skill: 'reading', part });
  assert.deepEqual(selected.passages.map(p => p.passageNumber), [part]);
  assert.equal(readingSource.passages.length, 3, 'source bank must remain unchanged');
}
for (let part = 1; part <= 4; part++) {
  const selected = selectFocusedContent(listeningSource, { skill: 'listening', part });
  assert.deepEqual(selected.sections.map(p => p.part), [part]);
  assert.deepEqual(selected.parts.map(p => p.part), [part], 'all renderer aliases must expose only the selected part');
  assert.equal(selected.sections[0].audioFile, listeningSource.parts[part - 1].audioFile);
  assert.deepEqual(selected.sections[0].questions.map(q => q.id), listeningSource.parts[part - 1].questions.map(q => q.id));
  assert.equal(listeningSource.parts.length, 4, 'source bank must remain unchanged');
}
for (let part = 1; part <= 3; part++) {
  const selected = selectFocusedContent(speakingSource, { skill: 'speaking', part });
  assert.deepEqual(selected.parts.map(p => p.partNumber), [part]);
  const selectedPart = selected.parts[0];
  const key = speakingQuestionKey(selectedPart, 0);
  assert.equal(key, `${part - 1}_0`, 'recording identity must keep the original IELTS part');
  const context = speakingTestContext(selected);
  assert(Object.keys(context.questions).every(k => k.startsWith(`${part - 1}_`)));
  assert.equal(context.questions[key], selectedPart.questions[0]);
  const prompt = buildSpeakingUserPrompt({ transcripts: { [key]: 'This is my spoken response to the selected question.' }, testMeta: context });
  assert(prompt.includes(`Part ${part}`));
  assert(prompt.includes(selectedPart.questions[0]));
  const records = Object.fromEntries(selectedPart.questions.map((_, i) => [speakingQuestionKey(selectedPart, i), { transcript: 'A recorded answer.' }]));
  assert(speakingPartComplete(selectedPart, records));
  assert(!speakingPartComplete(selectedPart, {}));
  if (part > 1) assert(!speakingPartComplete(selectedPart, { '0_0': { transcript: 'A different part.' } }));
}
assert.throws(() => selectFocusedContent(speakingSource, { skill: 'speaking', part: 4 }), /No source speaking part/);
assert.throws(() => selectFocusedContent(readingSource, { skill: 'reading', part: 4 }), /No source passage/);
assert.throws(() => selectFocusedContent(listeningSource, { skill: 'listening', part: 5 }), /No source listening part/);
console.log('✓ focused Reading, Listening, and Speaking expose exactly the selected part and preserve its question identity');
