import { readDraft, writeDraft, setDraftScope, transitionPracticeSession } from '../src/utils/drafts.js';
import assert from 'node:assert/strict';
import { buildPracticeInsights, objectiveBreakdown } from '../src/utils/focusedPractice.js';
import { buildProgressSeries } from '../src/utils/progressTimeline.js';
import { selectFocusedContent } from '../src/utils/focusedContent.js';
import { speakingTestContext } from '../src/utils/speakingContext.js';
import { prepareWritingCoaching, validateWritingCoaching } from '../src/utils/harper/writingCoachContract.js';
import { planRequestBudget } from '../src/utils/ai/requestBudget.js';
import { editorSegments, repeatColor } from '../src/utils/harper/editorHighlights.js';
import { lintTextWithHarper, applyHarperFix } from '../src/utils/harper/harperService.js';
import { analyzeRepetition } from '../src/utils/harper/repetitionService.js';
import { getRecheckableLastTest } from '../src/utils/recheckLastTest.js';
import { recordAttempt } from '../src/utils/performanceStore.js';
import { derivePerformanceSummary } from '../src/utils/performanceStore.js';
import { buildSpeakingUserPrompt } from '../src/utils/ieltsRubric.js';
import { reviewWritingPractice } from '../src/utils/geminiEvaluator.js';
import { saveLocalGroqKey, saveLocalGeminiKey, setActiveAiProvider } from '../src/utils/storage.js';
import index from '../src/data/production/analyticsIndex.json' with {type:'json'};
import { loadWritingVisual } from '../src/utils/harper/writingVisual.js';
import {getProductionReadingTest,getProductionListeningTest} from '../src/data/production/adapters.js';
const storage=new Map();globalThis.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
let passed=0;async function check(name,run){await run();console.log(`✓ ${name}`);passed++;}
const test={id:'r',testId:100,type:'reading',status:'completed',reading:{itemResults:Object.fromEntries(Array.from({length:40},(_,i)=>[`q${i+1}`,{candidateAnswer:'x',finalResult:i<13?'CORRECT':'INCORRECT'}]))}};
await check('old question records recover exact passage and type labels without answer keys',()=>{
 const b=objectiveBreakdown(test,'reading',index);assert.equal(b.sections.length,3);assert(b.types.some(t=>t.key==='matching_headings'));assert(!JSON.stringify(index).includes('"answer":'));assert(!JSON.stringify(index).includes('"acceptedAnswers":'));
 const all=buildPracticeInsights([test],index),parts=all.recommendations.filter(r=>r.kind==='section');assert(parts.some(p=>p.part===2));assert(parts.some(p=>p.part===3));assert(!parts.some(p=>p.part===1));const older=buildPracticeInsights([{id:'new-aggregate',testId:200,type:'reading',reading:{band:4}},test],index);assert(older.recommendations.every(r=>r.testId===100 && r.sourceAttemptId==='r'));assert(all.recommendations[0].priority>=all.recommendations.at(-1).priority);
});
await check('uncertain answers cannot manufacture a weak area',()=>{
 const attempt={type:'reading',reading:{itemResults:Object.fromEntries([1,2,3,4,5].map(i=>[i,{part:2,questionType:'tfng',finalResult:i<3?'CORRECT':'UNCERTAIN'}]))}};
 assert.equal(buildPracticeInsights([attempt]).recommendations.length,0);
});
await check('aggregate-only legacy results never invent section weaknesses',()=>{const recommendations=buildPracticeInsights([{type:'reading',reading:{band:4}}],index).recommendations;assert.equal(recommendations.length,1);assert.equal(recommendations[0].kind,'skill');assert.equal(recommendations[0].band,4);});
await check('focused source selection opens the requested passage and listening part',()=>{
 const reading=selectFocusedContent(getProductionReadingTest(100,true),{skill:'reading',part:3});assert.deepEqual(reading.passages.map(p=>p.passageNumber),[3]);
 const listening=selectFocusedContent(getProductionListeningTest(185,true),{skill:'listening',part:2});assert.equal(listening.sections[0].part,2);assert(listening.sections[0].audioFile.startsWith('https:'));assert(listening.sections[0].questionGroups.length);
});
await check('writing uses task-specific history, not generic criterion advice',()=>{
 const a=(id,one,two)=>({id,type:'writing',testId:1,status:'completed',writing:{task1Band:one,task2Band:two}});
 const model=buildPracticeInsights([a('new',7.5,5),a('old',7,6)]);assert(model.recommendations.some(r=>r.taskKind===2 && r.trend==='Recent dip'));assert(!model.recommendations.some(r=>r.taskKind===1));
});
await check('overall timeline waits for all four skills and agrees with the score card',()=>{
 const attempts=['listening','reading','writing','speaking'].map((s,i)=>({id:s,type:s,status:'completed',completedAt:`2026-10-0${i+1}`, [s]:{band:[7.5,5,5.5,5][i]}})).reverse();
 const summary=derivePerformanceSummary({attempts}),series=buildProgressSeries(summary.skillHistory);assert.equal(series.length,1);assert.equal(series[0].band,6);assert.equal(String(series.at(-1).band),String(summary.overallBand));
});
await check('speaking sends each actual question alongside the corresponding answer',()=>{
 const meta=speakingTestContext({parts:[{partNumber:3,questions:['How does transport affect cities?']}]});const prompt=buildSpeakingUserPrompt({transcripts:{'2_0':'Transport can connect people to jobs.'},testMeta:meta});assert(prompt.includes('How does transport affect cities?'));assert(prompt.includes('Part 3'));
});
await check('visible word groups use distinct colours and preserve text',()=>{
 const words=['start','writing','grammar','mechanics','focus','difficult'];
 assert.equal(new Set(words.map(word=>repeatColor(word,words))).size,6);
});
await check('incomplete speaking responses do not offer an AI failure retry',()=>{
 storage.clear();
 recordAttempt({id:'partial-speaking',type:'speaking',status:'partial',completedAt:new Date().toISOString(),speaking:{evaluationState:'FAILED',bandEligible:false,transcripts:{'0_0':'This is my only answer today.'}}});
 assert.equal(getRecheckableLastTest(),null);
 recordAttempt({id:'complete-speaking',type:'speaking',status:'partial',completedAt:new Date(Date.now()+1000).toISOString(),speaking:{evaluationState:'FAILED',coverage:{isComplete:true},transcripts:{'0_0':'This is my answer to part one.','1_0':'This is my answer to part two.','2_0':'This is my answer to part three.'}}});
 assert.equal(getRecheckableLastTest()?.attempt.id,'complete-speaking');storage.clear();
});
await check('incomplete writing and other test types never offer a grading failure card',()=>{
 const cases=[
  ['writing',{evaluationStatus:'failed',t1:'A submitted report.',t2:''},false],
  ['writing',{evaluationStatus:'failed',t1:'',t2:'A submitted essay.'},false],
  ['writing',{evaluationStatus:'failed',t1:'',t2:''},false],
  ['writing',{evaluationStatus:'partial',t1:'A report.',t2:'An essay.'},false],
  ['writing',{evaluationStatus:'failed',coverage:{complete:false},t1:'A report.',t2:'An essay.'},false],
  ['writing',{evaluationStatus:'failed',t1:'A report.',t2:'An essay.'},true],
  ['reading',{evaluationStatus:'failed',band:null},false],
  ['listening',{evaluationStatus:'failed',band:null},false],
  ['full_mock',{evaluationStatus:'failed',band:null},false],
 ];
 for(const [type,record,eligible] of cases){storage.clear();recordAttempt({id:'case',type,status:'partial',completedAt:new Date().toISOString(),[type]:record});assert.equal(Boolean(getRecheckableLastTest()),eligible,JSON.stringify({type,record}));}
 storage.clear();
});
await check('refresh retains drafts; confirmed exit discards only the current session',()=>{
 storage.clear();setDraftScope('alice');
 const examples=[['reading','reading:100:false'],['listening','listening:100:false'],['writing','cognition_writing_active_session'],['speaking','speaking:practice:100'],['harper-writing','harper'],['drill','drill-session'],['mock','reading:100:true']];
 for(const [view,key] of examples){
  transitionPracticeSession('home',view);
  writeDraft(key,{text:'Keep until I leave'});
  storage.set('omniprep_performance_store_v1','saved history');
  assert.equal(readDraft(key).text,'Keep until I leave');
  assert.equal(transitionPracticeSession(view,'home',{confirm:()=>false}),false);
  assert.equal(readDraft(key).text,'Keep until I leave');
  assert.equal(transitionPracticeSession(view,'home',{confirm:()=>true}),true);
  assert.equal(readDraft(key),null);
  assert.equal(writeDraft(key,{text:'late outgoing effect'}),false);
  assert.equal(storage.get('omniprep_performance_store_v1'),'saved history');
  transitionPracticeSession('home',view);assert.equal(readDraft(key),null);
  assert(writeDraft(key,{text:'New session'}));
  transitionPracticeSession(view,'home',{finished:true,confirm:()=>{throw Error('Completed work should not prompt');}});
 }
 setDraftScope('bob');writeDraft('harper',{text:'Bob draft'});setDraftScope('alice');transitionPracticeSession('harper-writing','home',{finished:true});setDraftScope('bob');assert.equal(readDraft('harper').text,'Bob draft');
 storage.clear();setDraftScope('');
});
await check('Harper flags repeated grammar findings, agreement errors, and Unicode spans',async()=>{
 const text='😀 This is a a test. This is a a test. This is a a test. He are happy.';
 const result=await lintTextWithHarper(text);assert(result.issues.filter(i=>i.snippet==='a a').length>=2);const issue=result.issues.find(i=>/agree/.test(i.message));assert(issue);assert.notEqual(applyHarperFix(text,issue,'is'),text);assert(result.issues.every(i=>text.slice(i.start,i.end)===i.snippet));
 const segments=editorSegments(text,result.issues,analyzeRepetition(text).repetitiveWords);assert.equal(segments.map(s=>s.text).join(''),text);assert(segments.some(s=>s.issue));assert(segments.some(s=>s.repeat));
});
const task={prompt:'Should cities invest more in public transport? Give reasons.'},text='Cities should invest in buses because reliable transport connects residents to work.';
const evaluation={questionFocus:'public transport',criteria:Object.fromEntries(['taskResponse','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map(k=>[k,{band:6,feedback:'Develop the link between access and employment.',evidence:'connects residents to work',nextAction:'Add an example of a commuter benefiting.'}])),nextActions:['Add a commuter example.','Explain the benefit.','Remove repetition.'],summary:'A relevant position. Develop the supporting example.',conciseness:{feedback:'The response is direct.',evidence:'Cities should invest in buses'},limitations:'Short draft'};
await check('review contracts require the original question and reject invented evidence',()=>{
 assert(prepareWritingCoaching({text,task}).prompt.includes(task.prompt));assert(prepareWritingCoaching({text,task:{instructions:'Write 250 words'}}).error);assert(validateWritingCoaching(evaluation,{text,task}));assert.equal(validateWritingCoaching({...evaluation,questionFocus:'unrelated'}, {text,task}),null);
});
await check('coaching bounds provider input plus output without truncating the draft',()=>{
 const contract=prepareWritingCoaching({text,task});const budget=planRequestBudget('groq',contract.system,contract.prompt,{coaching:true});assert(budget.ok);assert(budget.inputTokens+budget.outputTokens<=7600);assert(budget.outputTokens<=2000);assert(!planRequestBudget('groq',contract.system,'x'.repeat(20000),{coaching:true}).ok);
});
await check('AI integration sends exact question, draft, local checks and a bounded reply request',async()=>{
 saveLocalGroqKey('fixture-key-for-tests');setActiveAiProvider('groq');const original=globalThis.fetch;let sent=null,calls=0;
 globalThis.fetch=async(url,options)=>{calls++;if(String(url).endsWith('/models'))return new Response(JSON.stringify({data:[{id:'openai/gpt-oss-120b'}]}));sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(evaluation)}}]}));};
 try {const result=await reviewWritingPractice({text,task,taskKind:2,localDiagnostics:{wordCount:14,issueCount:1}});assert.equal(result.status,'completed');assert(sent.messages[1].content.includes(task.prompt));assert(sent.messages[1].content.includes(text));assert(sent.messages[1].content.includes('"issueCount":1'));assert(sent.max_completion_tokens<=2000);const before=calls;const noQuestion=await reviewWritingPractice({text,task:{}});assert.equal(noQuestion.status,'failed');assert.equal(calls,before);}finally{globalThis.fetch=original;storage.clear();}
});
await check('Task 1 sends the chart to Gemini, reserves image tokens, and validates its context',async()=>{
 const original=globalThis.fetch;const chartTask={prompt:'The maps show changes to a hospital. Summarise the changes.',image:{file:'https://pub-b158c0b753f14ee386f9d3217c48d007.r2.dev/cognition/images/writing/chart.png'}};
 const answer='The hospital entrance moved to the east.';
 const graded={...evaluation,questionFocus:'changes to a hospital',criteria:Object.fromEntries(['taskAchievement','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map(k=>[k,{band:6,feedback:'Compare the two access routes.',evidence:'entrance moved to the east',nextAction:'Describe the earlier entrance as well.'}])),conciseness:{feedback:'Direct overview.',evidence:'The hospital entrance'}};
 saveLocalGeminiKey('fixture-gemini-key');setActiveAiProvider('gemini');let request;
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('chart.png'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
  if(String(url).includes('pageSize'))return new Response(JSON.stringify({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]}));
  request=JSON.parse(options.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(graded)}]}}]}));
 };
 try {const result=await reviewWritingPractice({text:answer,task:chartTask,taskKind:1});assert.equal(result.status,'completed');assert.equal(result.evaluation.criteria.taskAchievement.band,6);assert(request.contents[0].parts.some(p=>p.inlineData));assert.equal(request.generationConfig.mediaResolution,'MEDIA_RESOLUTION_HIGH');assert(request.generationConfig.maxOutputTokens<=2000);assert.equal(await loadWritingVisual({image:{file:'https://example.com/private.png'}},'gemini'),null);}finally{globalThis.fetch=original;storage.clear();}
});
console.log(`${passed} practice experience checks passed.`);
