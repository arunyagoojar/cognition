import assert from 'node:assert/strict';
import {INITIAL_WORDS,SPELLING_WORDS} from '../src/data/spelling/words.js';
import {createSessionWords,gradeWord,summarizeActivity,sessionSummary,spellingScoreOutOf9,isQuickCorrect,MAX_REVIEW_WORDS} from '../src/utils/spelling/engine.js';
const timed=(word,ms=2000)=>gradeWord(word,word,{responseTimeMs:ms});
const target='because';
const filler=INITIAL_WORDS.filter(word=>word.word!==target).map(word=>gradeWord(word.word,'misspelled',{responseTimeMs:1000}));
function session(index,result=null) {
 const results=result?[result,...filler]:[...filler,gradeWord('always','misspelled',{responseTimeMs:1000})];
 return {id:`schedule_${String(index).padStart(3,'0')}`,kind:'session',source:'spelling-bee',policyVersion:2,completedAt:new Date(Date.UTC(2026,9,index)).toISOString(),results};
}
assert(isQuickCorrect(timed(target,5000)));assert(!isQuickCorrect(timed(target,5001)));
assert(!isQuickCorrect({...timed(target),correct:false}));assert(!isQuickCorrect({...timed(target),responseTimeMs:null}));
let history=[session(1,timed(target))];
let state=summarizeActivity(history);assert.equal(state.bank[target].status,'checking');assert.equal(state.bank[target].rechecks,0);assert.equal(state.bank[target].reviewAfterSession,6);
for(let index=2;index<=6;index++) {
 assert(!createSessionWords(history,()=>.5).some(word=>word.word===target),`skip word in session ${index}`);
 history.push(session(index));
}
assert(createSessionWords(history,()=>.5).some(word=>word.word===target),'eligible only after FIVE other completed sessions');
history.push(session(7,timed(target)));assert.equal(summarizeActivity(history).bank[target].rechecks,1);
for(let index=8;index<=12;index++)history.push(session(index));
history.push(session(13,timed(target)));assert.equal(summarizeActivity(history).bank[target].rechecks,2);
for(let index=14;index<=18;index++)history.push(session(index));
const final=session(19,timed(target));const prior=[...history];history.push(final);
state=summarizeActivity(history);assert(!state.bank[target],'retired word is removed from active bank');assert(state.retiredWords.includes(target));assert(!createSessionWords(history,()=>.5).some(word=>word.word===target),'retired seed cannot return through the filler pool');
assert.equal(sessionSummary(final,prior).retired[0].word,target);assert.equal(spellingScoreOutOf9(history[0]),.3,'historical score survives retirement');assert(history[0].results.some(word=>word.word===target),'score evidence is retained');
assert.deepEqual(summarizeActivity([...history,...history].reverse()),state,'duplicate retries and out-of-order sync produce identical scheduling');
// An early repeat cannot substitute for one of the three spaced checks.
const early=[session(1,timed(target)),session(2,timed(target))];assert.equal(summarizeActivity(early).bank[target].rechecks,0);assert.equal(summarizeActivity(early).bank[target].reviewAfterSession,6);
// Both a slow check and a miss reset the word to regular practice.
const slow=[...prior,session(19,timed(target,7000))];assert.equal(summarizeActivity(slow).bank[target].status,'learning');assert.equal(summarizeActivity(slow).bank[target].rechecks,0);
const wrong=[...prior,session(19,gradeWord(target,'becaus',{responseTimeMs:1500}))];assert.equal(summarizeActivity(wrong).bank[target].status,'learning');assert.equal(summarizeActivity(wrong).bank[target].rechecks,0);
// A genuinely new spelling mistake can reopen a retired word.
const capture={id:'later_capture',kind:'capture',source:'writing',completedAt:'2026-10-20T00:00:00.000Z',results:[gradeWord(target,'becaus')]};
state=summarizeActivity([...history,capture]);assert.equal(state.bank[target].status,'learning');assert(!state.retiredWords.includes(target));
// Objective-answer/writing captures do not advance the five-session clock.
const captures=Array.from({length:10},(_,i)=>({...capture,id:`capture_${i}`,completedAt:new Date(Date.UTC(2026,9,2,i)).toISOString(),results:[gradeWord('receive','recieve')]}));
assert(!createSessionWords([session(1,timed(target)),...captures],()=>.5).some(word=>word.word===target));
const allKnown={...session(1),results:INITIAL_WORDS.map(word=>timed(word.word))};
const otherWords=SPELLING_WORDS.filter(word=>!INITIAL_WORDS.some(initial=>initial.word===word.word));
const crowded=[allKnown,...Array.from({length:5},(_,i)=>({...session(i+2),results:otherWords.map(word=>gradeWord(word.word,'misspelled',{responseTimeMs:1000}))}))];
const selected=createSessionWords(crowded,()=>.5);assert.equal(selected.filter(word=>INITIAL_WORDS.some(initial=>initial.word===word.word)).length,MAX_REVIEW_WORDS,'only a few spaced checks are introduced per session');
console.log('Spelling schedule passed: quick threshold, five-session gap, three checks, no early repeats, retirement, fresh words, old scores, slow/missed checks, relapse and sync idempotency.');
