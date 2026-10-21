import { INITIAL_WORDS, SPELLING_WORDS, WORD_NOTES } from '../../data/spelling/words.js';
export const SESSION_SIZE = 30;
export const WORD_TIME_MS = 10000;
export const FIXED_STREAK = 5;
export const normalizeSpelling = value => String(value || '').normalize('NFKC').trim().toLowerCase();
export function summarizeActivity(records = []) {
 const bank = {};
 const sessions = [];
 const unique = [...new Map(records.map(r=>[r.id,r])).values()].sort((a,b)=>a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
 for(const record of unique) {
  if(record.kind==='session') sessions.push(record);
  for(const result of record.results || []) {
   const word=normalizeSpelling(result.word);
   if(!word)continue;
   const entry=bank[word] ||= {word,mistakes:0,correct:0,streak:0,confident:0,unsure:0,sources:[],status:'learning'};
   if(!entry.sources.includes(record.source))entry.sources.push(record.source);
   if(result.correct) { entry.correct++; entry.streak++; if(result.confidence==='confident')entry.confident++;else entry.unsure++; }
   else {entry.mistakes++;entry.streak=0;entry.lastMisspelling=result.answer || '';}
   entry.status=entry.streak>=FIXED_STREAK?'fixed':'learning';
   entry.lastSeen=record.completedAt;
  }
 }
 return {bank,sessions};
}
export function createSessionWords(records, random=Math.random) {
 const {bank,sessions}=summarizeActivity(records);
 if(!sessions.length)return INITIAL_WORDS.map(w=>({...w}));
 const shuffle=rows=>rows.map(value=>({value,key:random()})).sort((a,b)=>a.key-b.key).map(x=>x.value);
 const learning=Object.values(bank).filter(w=>w.status!=='fixed');
 const mistakes=shuffle(learning.filter(w=>w.mistakes)).slice(0,20);
 const unsure=shuffle(learning.filter(w=>!w.mistakes && w.unsure)).slice(0,20-mistakes.length);
 const active=[...mistakes,...unsure];
 const chosen=active.map(w=>WORD_NOTES[w.word] || {word:w.word,difficulty:w.word.length>10?'difficult':w.word.length>6?'medium':'easy'});
 const seen=new Set(chosen.map(w=>w.word));
 const fresh=shuffle(SPELLING_WORDS.filter(w=>!seen.has(w.word) && !bank[w.word]));
 const rest=shuffle(SPELLING_WORDS.filter(w=>!seen.has(w.word) && bank[w.word]));
 return shuffle([...chosen,...fresh,...rest].slice(0,SESSION_SIZE));
}
export function gradeWord(word, answer, confidence, timedOut=false) {
 return {word:normalizeSpelling(word),answer:String(answer || '').trim(),confidence:confidence==='confident'?'confident':'unsure',correct:!timedOut && normalizeSpelling(word)===normalizeSpelling(answer),timedOut};
}
export function sessionSummary(session, previous=[]) {
 const before=summarizeActivity(previous).bank;
 const after=summarizeActivity([...previous,session]).bank;
 const results=session.results || [];
 return {correct:results.filter(r=>r.correct).length,missed:results.filter(r=>!r.correct),confident:results.filter(r=>r.correct && r.confidence==='confident'),unsure:results.filter(r=>r.correct && r.confidence!=='confident'),improving:results.filter(r=>r.correct && before[r.word]?.mistakes>0 && before[r.word]?.status!=='fixed'),fixed:results.filter(r=>after[r.word]?.status==='fixed' && before[r.word]?.status!=='fixed')};
}

// A spelling accuracy scale, independent of the IELTS band calculation.
export function spellingScoreOutOf9(session) {
 if(!session || session.results?.length!==SESSION_SIZE)return null;
 return Math.round(session.results.filter(result=>result.correct).length/SESSION_SIZE*90)/10;
}
