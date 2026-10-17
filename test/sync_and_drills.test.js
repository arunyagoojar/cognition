import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { serializeAttempt, mergeAttemptData } from '../src/utils/attemptPayload.js';
import { isBandEligible } from '../src/utils/practiceScope.js';
import { chooseFreshTest } from '../src/utils/practiceSelection.js';
import { suggestVocabulary } from '../src/utils/harper/vocabularyCoach.js';
import { deriveFocusedRecommendations } from '../src/utils/focusedPractice.js';
import { derivePerformanceSummary, hydrateFromRemoteAttempts, getPerformanceStore, recordAttempt } from '../src/utils/performanceStore.js';
import { setDraftScope, writeDraft, readDraft } from '../src/utils/drafts.js';
import { configureSync, queueAttempt, flushSync, getSyncStatus } from '../src/utils/syncQueue.js';
import worker from '../worker/src/index.js';
const values = new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
let passed=0;
function check(name,fn){fn();passed++;console.log('✓',name);}
check('result payload preserves original/corrected text and excludes secrets/media',()=>{
 const value=serializeAttempt({id:'a',type:'speaking',band:0,transcripts:{'0_0':'corrected'},originalTranscripts:{'0_0':'original'},speechMeta:{'0_0':{durationSec:12}},apiKey:'never',recordings:{x:{blob:{secret:1},url:'blob:secret',duration:12}}});
 assert.equal(value.band,0);assert.equal(value.data.originalTranscripts['0_0'],'original');assert(!JSON.stringify(value).includes('never'));assert(!JSON.stringify(value).includes('blob:secret'));
});
check('updates retain old and unknown result fields and reject stale edits',()=>{
 const prev={clientUpdatedAt:'2026-10-17T10:00:00Z',unknown:42,criteria:{grammar:{band:6,comment:'keep'}}};
 assert.equal(mergeAttemptData(prev,{clientUpdatedAt:'2026-10-17T09:00:00Z',unknown:0}).unknown,42);
 const next=mergeAttemptData(prev,{criteria:{grammar:{band:7}}});assert.equal(next.criteria.grammar.comment,'keep');
});
check('focused and coached tasks cannot inflate the full-test band',()=>{
 assert.equal(isBandEligible({type:'drill',speaking:{band:9}}),false);
 const full={id:'full',type:'reading',status:'completed',reading:{band:6},completedAt:'2026-10-17'};
 const drills=Array.from({length:20},(_,i)=>({id:`drill${i}`,type:'drill',status:'completed',reading:{band:9}}));
 const summary=derivePerformanceSummary({attempts:[...drills,full]});assert.equal(summary.latestScores.reading.band,6);assert.equal(summary.completedCount,1);
});
check('heavy drill practice cannot evict full-test evidence',()=>{
 values.clear();recordAttempt({id:'baseline',type:'reading',status:'completed',reading:{band:6},completedAt:'2026-10-01'});
 for(let i=0;i<130;i++)recordAttempt({id:`focused-${i}`,type:'drill',status:'completed',completedAt:new Date().toISOString()});
 assert(getPerformanceStore().attempts.some(a=>a.id==='baseline'));
 assert.equal(derivePerformanceSummary().latestScores.reading.band,6);
 values.clear();
});
check('recent test avoidance works without excluding explicit user-selected retries',()=>{
 const pool=[{id:'a'},{id:'b'},{id:'c'}];const picked=pool.map(()=>chooseFreshTest('reading',pool,localStorage,()=>0));assert.equal(new Set(picked).size,3);
});
check('drafts survive reopening but never cross account boundaries',()=>{
 setDraftScope('alice');assert(writeDraft('writing',{text:'draft'}));setDraftScope('bob');assert.equal(readDraft('writing'),null);setDraftScope('alice');assert.equal(readDraft('writing').text,'draft');
});
check('vocabulary suggestions change with the actual draft',()=>{
 assert(suggestVocabulary('This is an important change.').some(v=>v.suggestion==='significant'));
 assert(!suggestVocabulary('A significant outcome.').some(v=>v.word==='important'));
});
check('recommendations need question evidence and preserve source tests',()=>{
 const itemResults=Object.fromEntries([1,2,3,4].map(i=>[i,{questionType:'matching_headings',finalResult:i===1?'CORRECT':'INCORRECT'}]));
 const suggestions=deriveFocusedRecommendations([{id:'r',type:'reading',testId:'123',reading:{itemResults}}]);assert.equal(suggestions[0].questionType,'matching_headings');assert.equal(suggestions[0].testId,'123');
 assert.equal(deriveFocusedRecommendations([{type:'speaking',speaking:{partDiagnostics:{part2:{needsPractice:true,evidence:'invented'}},transcripts:{x:'actual'}}}]).length,0);
});
// Controlled sender tests use no network.
let sends=0;
configureSync('alice',async()=>{sends++;return sends===1?{ok:false,status:503}:{ok:true};});
await queueAttempt(serializeAttempt({id:'retry',type:'reading',status:'completed',updatedAt:'2026-10-17T10:01:00Z'}));
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(getSyncStatus().pending,1);await flushSync(true);assert.equal(getSyncStatus().pending,0);passed++;
configureSync('bob',async()=>({ok:true}));assert.equal(getSyncStatus().pending,0);configureSync('',async()=>({ok:true}));
// Exercise the actual Worker routes against a disposable in-memory SQLite DB.
const db=new DatabaseSync(':memory:');
for(const file of ['0001_initial_schema.sql','0002_user_ai_credentials.sql','0003_onboarding_state.sql']) db.exec(fs.readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
db.exec("INSERT INTO users(clerk_user_id) VALUES('alice'),('bob')");
const DB={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);},async all(){return{results:db.prepare(sql).all(...args)};}};}};}};
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test';
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});
async function token(user){const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url');const body=Buffer.from(JSON.stringify({sub:user,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(`${header}.${body}`));return`${header}.${body}.${Buffer.from(sig).toString('base64url')}`;}
async function call(user,method,path,body){return worker.fetch(new Request(`http://localhost${path}`,{method,headers:{Authorization:`Bearer ${await token(user)}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB});}
const payload=serializeAttempt({id:'retained',type:'speaking',band:0,updatedAt:'2026-10-17T10:00:00Z',originalTranscripts:{'0_0':'um original'},transcripts:{'0_0':'corrected'},futureField:{value:123}});
assert.equal((await call('alice','POST','/api/attempts',payload)).status,201);
assert.equal((await call('alice','POST','/api/attempts',payload)).status,409);
assert.equal((await call('bob','PUT','/api/attempts/retained',{band:9})).status,404);
assert.equal((await call('alice','PUT','/api/attempts/retained',{band:6,data:{clientUpdatedAt:'2026-10-17T11:00:00Z',overallSummary:'new'}})).status,200);
assert.equal((await call('alice','PUT','/api/attempts/retained',{band:1,data:{clientUpdatedAt:'2026-10-17T09:00:00Z'}})).status,200);
const row=await (await call('alice','GET','/api/attempts/retained')).json();assert.equal(row.band,6);assert.equal(JSON.parse(row.data).futureField.value,123);assert.equal(JSON.parse(row.data).originalTranscripts['0_0'],'um original');
hydrateFromRemoteAttempts([row],'alice');assert.equal(getPerformanceStore().attempts[0].speaking.transcripts['0_0'],'corrected');assert.equal(getPerformanceStore().attempts[0].speaking.originalTranscripts['0_0'],'um original');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,2);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n,1);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
passed++;
for(let i=0;i<130;i++)db.prepare("INSERT INTO attempts(id,clerk_user_id,type) VALUES(?,'alice','drill')").run(`drill-${i}`);
const history=await (await call('alice','GET','/api/attempts')).json();
assert(history.some(a=>a.id==='retained'));assert.equal(history.filter(a=>a.type==='drill').length,100);passed++;
const question='Should cities invest in public transport?', draft='Buses help residents reach work.';
const coaching={questionFocus:'public transport',criteria:Object.fromEntries(['taskResponse','coherenceAndCohesion','lexicalResource','grammaticalRangeAndAccuracy'].map(key=>[key,{band:6,feedback:'Explain the link to employment.',evidence:'reach work',nextAction:'Add a specific commuter example.'}])),summary:'Relevant but brief.',nextActions:['Add an example.'],conciseness:{feedback:'Direct wording.',evidence:'Buses help residents'},limitations:'Short draft'};
let aiPayload;
globalThis.fetch=async(url,options)=>{
 if(String(url).includes('/jwks'))return new Response(JSON.stringify({keys:[jwk]}));
 if(String(url).endsWith('/models'))return new Response(JSON.stringify({data:[{id:'openai/gpt-oss-120b'}]}));
 aiPayload=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(coaching)}}]}));
};
const coached=await (await call('alice','POST','/api/ai/evaluate-writing',{mode:'single_task',text:draft,taskKind:2,task:{prompt:question},provider:'groq',key:'fixture-server-key'})).json();
assert.equal(coached.status,'completed');assert(aiPayload.messages[1].content.includes(question));assert(aiPayload.messages[1].content.includes(draft));assert(aiPayload.max_completion_tokens<=2000);passed++;
globalThis.fetch=originalFetch;db.close();
console.log(`${passed} sync, drill, draft, and real Worker/database integration checks passed.`);
