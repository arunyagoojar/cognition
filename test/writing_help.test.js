import assert from 'node:assert/strict';
import {createHarperSession, applyHarperFix, summarizeIssues} from '../src/utils/harper/harperService.js';
import {analyzeRepetition, replaceRepeatedWord} from '../src/utils/harper/repetitionService.js';
import {editorSegments} from '../src/utils/harper/editorHighlights.js';
import {PHRASE_CATEGORIES, phrasesFor, phraseCategories} from '../src/utils/harper/phraseBank.js';
import {topicWords, wordUsed} from '../src/utils/harper/topicVocabulary.js';
assert.equal(replaceRepeatedWord('People help people.','people',{start:0,end:6},'individuals').text,'Individuals help people.');
assert.equal(replaceRepeatedWord('People help people.','people',{start:12,end:18},'individuals').text,'People help individuals.');
assert.equal(replaceRepeatedWord('PEOPLE help.','people',{start:0,end:6},'individuals').text,'INDIVIDUALS help.');
assert.equal(replaceRepeatedWord('Edited draft.','people',{start:0,end:6},'individuals'),null);
for(const word of ['words','thing','view'])assert(analyzeRepetition(`${word} ${word} ${word}`).repetitiveWords[0].synonyms.length>=3);
const session=createHarperSession();
try {
 const exact='he go to university everyday';
 const pending=session.lint(exact);assert.equal(session.lint(exact),pending,'in-flight work is reused');
 const result=await pending;assert.equal(await session.lint(exact),result,'unchanged result is cached');
 const agreement=result.issues.find(i=>i.rule==='PronounVerbAgreement');
 assert.equal(agreement.snippet,'go');assert(agreement.suggestions.some(s=>s.replace==='goes'));
 assert.match(await session.explain(agreement.rule),/pronouns agree/i);
 assert(!result.issues.some(i=>i.rule==='Everyday'),'document actual missing-period detection limit');
 const completed=await session.lint(`${exact}.`);assert(completed.issues.some(i=>i.rule==='Everyday'));
 const text='😀 He are happi. This is a a test. This is a a test. Caribbean is beautiful.';
 const findings=await session.lint(text);
 assert(findings.issues.some(i=>i.type==='spelling'));
 assert(findings.issues.filter(i=>i.snippet==='a a').length===2);
 assert(!findings.issues.some(i=>i.type==='spelling' && i.snippet==='Caribbean'));
 assert(findings.issues.every(i=>text.slice(i.start,i.end)===i.snippet));
 assert.equal(findings.errorCount+findings.warningCount,findings.issues.length);
 const stale=applyHarperFix('Prefix '+text,findings.issues[0],'wrong');assert.equal(stale,'Prefix '+text);
 const repeated='People need good schools. People need good roads. People need good parks. Caribbean Caribbean Caribbean. Alice Alice Alice.';
 const repetitions=analyzeRepetition(repeated).repetitiveWords;
 assert(repetitions.find(w=>w.word==='people').synonyms.length>=3);
 assert(!repetitions.some(w=>['caribbean','alice'].includes(w.word)));
 assert(!analyzeRepetition(repeated,['people']).repetitiveWords.some(w=>w.word==='people'));
 const segments=editorSegments(repeated,[],repetitions);assert.equal(segments.map(s=>s.text).join(''),repeated);
 assert.equal(segments.filter(s=>s.repeat?.word==='people').length,3);
 assert.equal(summarizeIssues('',[]).totalSentences,0);
 assert.equal(summarizeIssues('A sentence. Another sentence.',[{start:2,end:10,severity:'warning'}]).errorFreeSentences,1);
 for(const task of [1,2]) for(const category of phraseCategories(task)) {
  const phrases=phrasesFor(task,category);assert(phrases.length>=5 && phrases.length<=7);
  assert(phrases.every(p=>p.meaning && p.example && p.phrase));
 }
 assert.equal(phraseCategories(2).length,PHRASE_CATEGORIES.length);
 assert(!phraseCategories(1).includes('Expressing an opinion'));
 for(const prompt of ['schools','climate','technology','health','cities','employment','culture']) {
  const words=topicWords(prompt,2);assert.equal(new Set(words.map(w=>w.word)).size,10);assert(words.every(w=>w.meaning && w.example));
  assert.notDeepEqual(words,topicWords(prompt,2,1));
 }
 assert(wordUsed('DIGITAL LITERACY matters','digital literacy'));assert(!wordUsed('reinvestment','investment'));
 console.log('Writing Help tests passed: real Harper detections and limits, caching, rule explanations, Unicode spans, accurate counts, repetition ignores, topic vocabulary and 102 local phrases.');
} finally {await session.dispose();}
await assert.rejects(session.lint('A new sentence.'),/closed/);
const closing=createHarperSession();const job=closing.lint('He are happy.');await closing.dispose();assert((await job).issues.length);
console.log('Worker lifecycle: disposal waits for in-flight work and rejects later checks.');
