import assert from 'node:assert/strict';
import { sourceIdentity } from '../src/utils/sourceIdentity.js';
import { getReadingTest } from '../src/data/reading/index.js';
import { getProductionListeningTest } from '../src/data/production/adapters.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
for (const [id, number] of [[106, 2], [107, 3]]) {
  const test = getReadingTest(id);
  assert.equal(sourceIdentity(test, 'reading').primary, `Cambridge IELTS 13 · Test ${number}`);
  assert.equal(sourceIdentity(test, 'reading').code, 'verified');
  assert.equal(sourceIdentity(selectFocusedContent(test, { skill: 'reading', part: 2 }), 'reading').code, 'verified');
  assert.equal(sourceIdentity({ ...test, source: { ...test.source, sha256: 'changed' } }, 'reading').code, 'imported');
  assert.equal(sourceIdentity({ ...test, passages: [...test.passages].reverse().map((p, i) => ({ ...p, passageNumber: i + 1 })) }, 'reading').code, 'imported');
  assert.equal(sourceIdentity({ ...test, passages: [...test.passages].reverse() }, 'reading').code, 'imported');
  assert.equal(sourceIdentity({ ...test, passages: [test.passages[0], test.passages[0]] }, 'reading').code, 'imported');
}
assert.equal(sourceIdentity(getReadingTest(235), 'reading').code, 'imported');
const listening = sourceIdentity(getProductionListeningTest(185), 'listening');
assert.equal(listening.code, 'imported');
assert.match(listening.status, /Source-reported/);
assert.equal(sourceIdentity(null, 'reading'), null);
console.log('Source labels: independent evidence, exact content guards, focused practice, honest unverified identities passed.');
