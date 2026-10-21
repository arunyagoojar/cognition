import { INITIAL_WORDS, SPELLING_WORDS, WORD_NOTES } from '../../data/spelling/words.js';
import PRACTICE_WORDS from '../../data/spelling/practiceWords.json' with {type:'json'};
export const SESSION_SIZE = 30;
export const WORD_TIME_MS = 10000;
export const QUICK_ANSWER_MS = 5000;
export const REVIEW_GAP_SESSIONS = 5;
export const REQUIRED_RECHECKS = 3;
export const MAX_REVIEW_WORDS = 3;
export const normalizeSpelling = value => String(value || '').normalize('NFKC').trim().toLowerCase();
export const isQuickCorrect = result => Boolean(result?.correct && !result.timedOut && Number.isFinite(result.responseTimeMs) && result.responseTimeMs>=0 && result.responseTimeMs<=QUICK_ANSWER_MS);

export function summarizeActivity(records = []) {
 const words = {};
 const sessions = [];
 const unique = [...new Map(records.map(r=>[r.id,r])).values()].sort((a,b)=>a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
 for(const record of unique) {
  const isSession=record.kind==='session';
  if(isSession)sessions.push(record);
  const sessionNumber=sessions.length;
  for(const result of record.results || []) {
   const word=normalizeSpelling(result.word);
   if(!word)continue;
   const entry=words[word] ||= {word,mistakes:0,correct:0,streak:0,rechecks:0,reviewAfterSession:null,sources:[],status:'learning'};
   if(!entry.sources.includes(record.source))entry.sources.push(record.source);
   entry.lastSeen=record.completedAt;
   if(!result.correct) {
    entry.mistakes++;entry.streak=0;entry.rechecks=0;
    entry.lastMisspelling=result.answer || '';entry.status='learning';entry.reviewAfterSession=null;
    continue;
   }
   entry.correct++;entry.streak++;
   // Historical scores stay valid, but old confidence labels cannot stand in
   // for timing measurements that were never recorded.
   if(entry.status==='retired')continue;
   const quick=isSession && isQuickCorrect(result);
   if(!quick) {entry.status='learning';entry.rechecks=0;entry.reviewAfterSession=null;continue;}
   if(entry.status==='checking') {
    // Replays, duplicates, and early cross-device repeats do not count as a
    // spaced check. Five OTHER completed sessions must have elapsed first.
    if(sessionNumber<=entry.reviewAfterSession)continue;
    entry.rechecks++;
    if(entry.rechecks>=REQUIRED_RECHECKS) {entry.status='retired';entry.reviewAfterSession=null;continue;}
   } else {entry.status='checking';entry.rechecks=0;}
   entry.reviewAfterSession=sessionNumber+REVIEW_GAP_SESSIONS;
  }
 }
 const retiredWords=Object.values(words).filter(word=>word.status==='retired').map(word=>word.word);
 const bank=Object.fromEntries(Object.entries(words).filter(([,word])=>word.status!=='retired'));
 return {bank,sessions,retiredWords};
}

export function createSessionWords(records, random=Math.random) {
 const {bank,sessions,retiredWords}=summarizeActivity(records);
 if(!sessions.length)return INITIAL_WORDS.map(w=>({...w}));
 const shuffle=rows=>rows.map(value=>({value,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.value);
 const due=Object.values(bank).filter(word=>word.status==='checking' && sessions.length>=word.reviewAfterSession)
  .sort((a,b)=>a.reviewAfterSession-b.reviewAfterSession || a.word.localeCompare(b.word)).slice(0,MAX_REVIEW_WORDS);
 const learning=Object.values(bank).filter(word=>word.status==='learning');
 const mistakes=shuffle(learning.filter(word=>word.mistakes)).slice(0,20-due.length);
 const slower=shuffle(learning.filter(word=>!word.mistakes)).slice(0,20-due.length-mistakes.length);
 const describe=word=>WORD_NOTES[word] || {word,difficulty:word.length>10?'difficult':word.length>6?'medium':'easy'};
 const chosen=[...due,...mistakes,...slower].map(entry=>describe(entry.word));
 // Exclude ALL previously seen words from the fresh pool, including known
 // words waiting for review and words removed from the active bank.
 const seen=new Set([...Object.keys(bank),...retiredWords]);
 const fresh=shuffle(SPELLING_WORDS.filter(word=>!seen.has(word.word)));
 const seedWords=new Set(SPELLING_WORDS.map(word=>word.word));
 const extra=shuffle(PRACTICE_WORDS.filter(word=>!seen.has(word) && !seedWords.has(word)).slice(0,120)).map(describe);
 return shuffle([...chosen,...fresh,...extra].slice(0,SESSION_SIZE));
}

export function gradeWord(word, answer, {responseTimeMs=null,timedOut=false}={}) {
 const measured=Number.isFinite(responseTimeMs) && responseTimeMs>=0?Math.round(responseTimeMs):null;
 const expired=Boolean(timedOut || measured!==null && measured>=WORD_TIME_MS);
 return {word:normalizeSpelling(word),answer:String(answer || '').trim(),correct:!expired && normalizeSpelling(word)===normalizeSpelling(answer),timedOut:expired,responseTimeMs:expired?WORD_TIME_MS:measured};
}
export function sessionSummary(session, previous=[]) {
 const before=summarizeActivity(previous);
 const after=summarizeActivity([...previous,session]);
 const results=session.results || [];
 const retiredBefore=new Set(before.retiredWords);
 return {
  correct:results.filter(result=>result.correct).length,
  missed:results.filter(result=>!result.correct),
  quick:results.filter(isQuickCorrect),
  steady:results.filter(result=>result.correct && !isQuickCorrect(result)),
  improving:results.filter(result=>result.correct && before.bank[result.word]?.mistakes>0),
  known:results.filter(result=>after.bank[result.word]?.status==='checking' && before.bank[result.word]?.status!=='checking'),
  retired:results.filter(result=>after.retiredWords.includes(result.word) && !retiredBefore.has(result.word)),
 };
}

// A spelling accuracy scale, independent of the IELTS band calculation.
export function spellingScoreOutOf9(session) {
 if(!session || session.results?.length!==SESSION_SIZE)return null;
 return Math.round(session.results.filter(result=>result.correct).length/SESSION_SIZE*90)/10;
}
