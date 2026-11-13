import assert from 'node:assert/strict';
import identities from '../src/data/production/readingIdentities.json' with { type: 'json' };
import { CONTENT_CATALOG, PRODUCTION_LISTENING } from '../src/data/production/registry.js';
import { getAllProductionReadingTests, getAllProductionListeningTests, getProductionReadingTest, getProductionListeningTest } from '../src/data/production/adapters.js';
import { isPreferredPracticeTest, getPreferredPracticePool } from '../src/data/production/practicePriority.js';
import { chooseFreshTest } from '../src/utils/practiceSelection.js';
import { chooseFocusedPracticeTest, selectFocusedContent } from '../src/utils/focusedContent.js';
import { getAuthenticExam, getRandomizedFullExam } from '../src/data/exams/examAssembler.js';

const readingIds = [2,8,14,15,23,35,38,39,80,84,92,105,106,107,128,129,130,188,222,223,224,226,227,228,231,268,270,271,293,294,295,312,313];
const reading = getAllProductionReadingTests();
const listening = getAllProductionListeningTests();
const preferredReading = getPreferredPracticePool('reading', reading);
assert.deepEqual(preferredReading.map(r => r.testId).sort((a,b) => a-b), readingIds);
assert.equal(preferredReading.reduce((sum,r) => sum+r.questionCount,0),1320);
assert.equal(getPreferredPracticePool('listening',listening).length,45);
assert.equal(listening.reduce((sum,r) => sum+r.verifiedQuestionCount,0),1800);
assert.equal(getPreferredPracticePool('reading',CONTENT_CATALOG.reading).length,33,'lightweight catalog and loaded sources use the same priority');
for(const record of preferredReading) {
 const identity=identities[record.testId];
 assert(identity.label && identity.evidence.length && identity.evidenceTier);
 assert.equal(identity.sha256,record.source.sha256);
 assert(!isPreferredPracticeTest('reading',{...record,source:{...record.source,sha256:'changed'}}),'changed content cannot inherit a source match');
}
assert.equal(identities[188].family,'Cambridge IELTS Trainer');
assert.equal(identities[84].family,'Official Cambridge Guide');
assert.equal(getProductionReadingTest(100,true).testId,100,'other retained sources remain explicitly accessible');

const memory=new Map();
const storage={getItem:key=>memory.get(key) ?? null,setItem:(key,value)=>memory.set(key,value)};
const mixed=[100,2,188,84].map(testId=>({testId}));
for(const skill of ['reading','reading-drill']) {
 const picked=Array.from({length:3},()=>chooseFreshTest(skill,mixed,storage,()=>0));
 assert.deepEqual(picked,['2','188','84'],'repeat avoidance stays inside the Cambridge pool, including Guide and Trainer');
 memory.set(`cognition_recent_${skill}_v2`,JSON.stringify(['2','188','84']));
 assert.equal(chooseFreshTest(skill,mixed,storage,()=>0),'2','recent Cambridge sources outrank fresh lower-priority content');
}
assert.deepEqual(mixed.map(r=>r.testId),[100,2,188,84],'selection does not reorder or mutate the caller pool');
assert.equal(chooseFreshTest('reading',[{testId:100}],null,()=>0),'100','a restricted pool without Cambridge matches still works');
assert.equal(chooseFreshTest('reading',[],null),null);
for(const skill of ['writing','speaking','harper-task-1']) {
 assert.equal(chooseFreshTest(skill,mixed,null,()=>0),'100','other skills keep their existing pool');
}
const brokenStorage={getItem(){throw new Error('unavailable');},setItem(){throw new Error('unavailable');}};
assert.equal(chooseFreshTest('reading',mixed,brokenStorage,()=>0),'2');
for(let i=0;i<33;i++) {
 assert.equal(chooseFreshTest('reading',CONTENT_CATALOG.reading,null,()=> (i+.5)/33),String(preferredReading[i].testId),'every preferred source remains reachable');
}

// Check every available part/type combination against real adapted content.
// A source recommendation must never bypass preference or change the focus.
let drillChecks=0;
for(const [skill,pool,get] of [['reading',reading,getProductionReadingTest],['listening',listening,getProductionListeningTest]]) {
 const sources=new Map(pool.map(record=>[String(record.testId),get(record.testId,true)]));
 const partsFor=source=>source.passages || source.parts || source.sections;
 const focuses=new Map();
 for(const source of sources.values()) for(const part of partsFor(source)) {
  const number=part.passageNumber || part.part;
  focuses.set(`${number}:all`,{skill,part:number,testId:source.testId});
  for(const group of part.questionGroups) for(const q of group.questions) {
   const type=q.questionType || q.type;
   if(type) focuses.set(`${number}:${type}`,{skill,part:number,questionType:type,testId:source.testId});
  }
 }
 for(const focus of focuses.values()) {
  const selected=chooseFocusedPracticeTest(focus,pool,id=>sources.get(String(id)),null,()=>0);
  assert(selected,`${skill}: a matching source exists`);
  const parts=partsFor(selected);
  assert.equal(parts.length,1);
  assert.equal(parts[0].passageNumber || parts[0].part,focus.part);
  if(focus.questionType) assert(parts[0].questionGroups.every(g=>g.questions.some(q=>(q.questionType || q.type)===focus.questionType)));
  const cambridgeMatch=pool.some(record=>isPreferredPracticeTest(skill,record) && partsFor(sources.get(String(record.testId))).some(part=>(part.passageNumber || part.part)===focus.part && (!focus.questionType || part.questionGroups.some(g=>g.questions.some(q=>(q.questionType || q.type)===focus.questionType)))));
  if(cambridgeMatch) assert(isPreferredPracticeTest(skill,selected),'matching Cambridge content takes precedence over the recommendation source');
  assert.deepEqual(selected,selectFocusedContent(sources.get(String(selected.testId)),focus),'source text, audio, question groups and ordering are preserved');
  drillChecks++;
 }
 assert.equal(chooseFocusedPracticeTest({skill,part:99},pool,id=>sources.get(String(id)),null),null,'missing focus does not become an unrelated drill');
}
const focus={skill:'reading',part:2};
const onlyOther=[reading.find(record=>record.testId===100)];
assert.equal(chooseFocusedPracticeTest(focus,onlyOther,getProductionReadingTest,null,()=>0).testId,100,'focused fallback retains a matching lower-priority source');
assert.equal(chooseFocusedPracticeTest({...focus,testId:2},reading,getProductionReadingTest,null,()=>0).testId,2,'a matching preferred recommendation keeps its requested source');
const changedPool=[{testId:2},{testId:188}];
const selectedAfterChange=chooseFocusedPracticeTest({...focus,testId:2},changedPool,id=>{
 const source=getProductionReadingTest(id,true);
 return id===2 ? {...source,source:{...source.source,sha256:'changed'}} : source;
},null,()=>0);
assert.equal(selectedAfterChange.testId,188,'focused selection checks the loaded source fingerprint even with a lightweight catalog');

// Every legacy mock ID must resolve to complete Cambridge source packages.
for(const seed of PRODUCTION_LISTENING.map(r=>r.testId)) {
 for(const build of [getAuthenticExam,getRandomizedFullExam]) {
  const exam=build(seed);
  assert(isPreferredPracticeTest('reading',exam.reading));
  assert(isPreferredPracticeTest('listening',exam.listening));
  assert.equal(exam.reading.passages.length,3);
  assert.equal(exam.reading.passages.flatMap(p=>p.questions).length,40);
  assert.equal(build(seed).reading.id,exam.reading.id,'reconstructed mocks retain the same preferred cluster');
 }
}
console.log(`Cambridge-first selection passed: 33 Reading / 45 Listening sets, ${drillChecks} real drill focuses, all legacy mock IDs, repeat avoidance, and restricted-pool fallback.`);
