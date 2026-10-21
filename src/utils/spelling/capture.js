import {getDraftScope} from '../drafts.js';
import {readSpellingActivity,saveSpellingActivity} from './store.js';
import {dictionaryEntry,editDistance} from './dictionary.js';
import {normalizeSpelling} from './engine.js';
const pending=new Set();
const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.codePointAt(0),16777619);return (n>>>0).toString(36);};
export async function captureSpellingMistakes(texts,source,issues) {
 const owner=getDraftScope();
 const text=texts.filter(t=>typeof t==='string').join('\n').slice(0,30000);
 if(!text.trim())return;
 const id=`capture_${source}_${hash(text)}`,jobKey=`${owner}:${id}`;
 if(pending.has(jobKey) || readSpellingActivity(owner).some(r=>r.id===id))return;
 pending.add(jobKey);
 let checker;
 try {
  if(!issues) {const {createHarperSession}=await import('../harper/harperService.js');checker=createHarperSession();issues=(await checker.lint(text)).issues;}
  const results=[];
  for(const issue of issues.filter(i=>i.type==='spelling').slice(0,100)) {
   const answer=normalizeSpelling(issue.snippet);
   if(!/^[a-z]{3,30}$/.test(answer))continue;
   // Do not turn grammar corrections, names, or valid dictionary words into mistakes.
   if(await dictionaryEntry(answer))continue;
   const candidates=[];
   for(const suggestion of (issue.suggestions || []).slice(0,5)) {
    const word=normalizeSpelling(suggestion.replace);
    if(!/^[a-z]{3,30}$/.test(word) || word===answer || editDistance(answer,word)>2)continue;
    if(await dictionaryEntry(word))candidates.push(word);
   }
   const ranked=[...new Set(candidates)].sort((a,b)=>editDistance(answer,a)-editDistance(answer,b));
   // Ambiguous corrections are left out instead of guessing the learner's intent.
   if(!ranked.length || ranked[1] && editDistance(answer,ranked[0])===editDistance(answer,ranked[1]))continue;
   if(!results.some(r=>r.word===ranked[0]))results.push({word:ranked[0],answer,correct:false,confidence:'unsure'});
  }
  if(owner===getDraftScope() && results.length)saveSpellingActivity({id,kind:'capture',source,completedAt:new Date().toISOString(),results},owner);
 }catch(error){console.warn('Spelling capture unavailable; your practice result is saved.',error.message);}
 finally {await checker?.dispose();pending.delete(jobKey);}
}
