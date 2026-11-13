import assert from 'node:assert/strict';
import { CONTENT_CATALOG, PRODUCTION_LISTENING, loadSkillContent } from '../src/data/production/registry.js';
import { isListeningTestEnabled, getAuditedListeningIdentity } from '../src/data/production/listeningAvailability.js';
import { getAllProductionListeningTests, getProductionListeningTest, getProductionListeningTestForReview } from '../src/data/production/adapters.js';
import { getListeningTest, getRandomizedListeningTest } from '../src/data/listening/index.js';
import { AVAILABLE_AUTHENTIC_TESTS, getAuthenticExam, getRandomizedFullExam } from '../src/data/exams/examAssembler.js';
import { sourceIdentity } from '../src/utils/sourceIdentity.js';
import { chooseFreshTest } from '../src/utils/practiceSelection.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
import { buildAnswerReviewItems } from '../src/utils/answerReview.js';
assert.equal(PRODUCTION_LISTENING.length, 86, 'original question/audio records are retained');
assert.equal((await loadSkillContent('listening')).length, 86);
assert.equal(getAllProductionListeningTests().length, 45);
assert.equal(CONTENT_CATALOG.listening.length, 45);
assert.equal(AVAILABLE_AUTHENTIC_TESTS.length, 45);
for (const record of PRODUCTION_LISTENING) {
 const enabled = isListeningTestEnabled(record);
 for (const alias of [record.testId, String(record.testId), record.id, record.slug]) {
  assert.equal(Boolean(getListeningTest(alias)), enabled, `${alias}: direct practice gate`);
  assert.equal(Boolean(getProductionListeningTest(alias, true)), enabled, `${alias}: focused source gate`);
  assert.equal(getProductionListeningTestForReview(alias,true).id,record.id, `${alias}: review retains original content`);
 }
 if(enabled) {
  assert(!isListeningTestEnabled({...record,source:{...record.source,sha256:'changed'}}),'changed content cannot inherit eligibility');
  const focused=selectFocusedContent(getProductionListeningTest(record.testId,true),{skill:'listening',part:2});
  assert.equal(focused.sections[0].part,2);
  assert.equal(focused.sections[0].questions.length,10);
 }
 for (const build of [getAuthenticExam,getRandomizedFullExam]) assert(isListeningTestEnabled(build(record.testId).listening),'all mock entry points use eligible content');
}
const originalRandom=Math.random;
try {
 const picked=new Set();
 for(let i=0;i<45;i++) {
  Math.random=()=> (i+.5)/45;
  picked.add(getRandomizedListeningTest().testId);
  assert(isListeningTestEnabled(getListeningTest(chooseFreshTest('listening',CONTENT_CATALOG.listening,null))));
  assert(isListeningTestEnabled(getListeningTest(chooseFreshTest('listening-drill',CONTENT_CATALOG.listening,null))));
 }
 assert.equal(picked.size,45,'all retained tests remain reachable');
} finally {Math.random=originalRandom;}
for(const [id,label] of [[77,'Cambridge IELTS 11 · Test 4'],[78,'Cambridge IELTS 11 · Test 1'],[79,'Cambridge IELTS 11 · Test 2'],[80,'Cambridge IELTS Trainer 1 · Test 5'],[21,'Cambridge IELTS 11 · Test 3']]) {
 assert.equal(sourceIdentity(getListeningTest(id),'listening').primary,label);
 assert.equal(AVAILABLE_AUTHENTIC_TESTS.find(t=>t.id===id).label,label);
}
assert.equal(getAuditedListeningIdentity(getListeningTest(135)).family,'Cambridge IELTS Trainer');
assert.equal(getListeningTest(19),null,'commercial set is not served');
assert.equal(getListeningTest(82),null,'unresolved set is held out pending verification');
assert.equal(getListeningTest('missing'),null,'no silent test substitution');
const old=getProductionListeningTestForReview(19,true);
const review=buildAnswerReviewItems({answers:{q1:'accountant'}},old,'listening');
assert(review.q1.questionText);
assert.equal(old.parts.length,4);
console.log('Listening availability: 45 selectable, 41 excluded, all 86 retained; all aliases, drills, mock assemblers, source-label corrections, and archived reviews passed.');
