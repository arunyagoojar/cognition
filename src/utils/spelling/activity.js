import {gradeWord} from './engine.js';
// Shared validation keeps the durable sync protocol independent of UI state.
export function validateSpellingActivity(body) {
 if(!body || !/^[a-zA-Z0-9_:-]{5,180}$/.test(body.id || '') || !['session','capture'].includes(body.kind))return null;
 if(!['spelling-bee','writing','writing-help','reading','listening'].includes(body.source))return null;
 if(typeof body.completedAt!=='string' || !Number.isFinite(Date.parse(body.completedAt)) || body.completedAt.length>35)return null;
 if(!Array.isArray(body.results) || body.results.length<1 || body.results.length>(body.kind==='session'?30:100))return null;
 if(body.kind==='session' && (body.results.length!==30 || body.source!=='spelling-bee'))return null;
 const seen=new Set(),results=[];
 for(const row of body.results) {
  if(!/^[a-z]{3,30}$/.test(row.word || '') || seen.has(row.word) || typeof row.answer!=='string' || row.answer.length>60 || !['unsure','confident'].includes(row.confidence))return null;
  seen.add(row.word);
  const result=gradeWord(row.word,row.answer,row.confidence,Boolean(row.timedOut));
  if(body.kind==='capture' && (row.correct!==false || result.correct))return null;
  results.push(body.kind==='capture'?{...result,correct:false}:result);
 }
 return {id:body.id,kind:body.kind,source:body.source,completedAt:new Date(body.completedAt).toISOString(),results};
}
