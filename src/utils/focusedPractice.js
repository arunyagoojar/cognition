import { typeLabel } from './insights.js';
import { resolveRecommendations } from '../data/recommendations.js';
export function deriveFocusedRecommendations(attempts = []) {
 const suggestions = new Map();
 for (const attempt of attempts.slice(0,30)) {
  if (attempt.type === 'drill' || attempt.type === 'writing_coach') continue;
  for (const skill of ['reading','listening','writing','speaking']) {
   const result=attempt[skill] || attempt.skills?.[skill] || (attempt.type===skill ? attempt : null);
   if (!result) continue;
   const add=(key,item)=>{if(!suggestions.has(key)) suggestions.set(key,{key,skill,testId:result.testId || attempt.testId,sourceAttemptId:attempt.id,...item,resources:resolveRecommendations({key,skill})});};
   if (skill==='reading' || skill==='listening') {
    const groups={};
    for (const item of Object.values(result.itemResults || {})) {
     if (!item.questionType || item.finalResult==='UNCERTAIN') continue;
     const group=groups[item.questionType] ||= {total:0,correct:0};
     group.total++;if(item.finalResult==='CORRECT' || item.deterministicCorrect===true) group.correct++;
    }
    for(const [questionType,g] of Object.entries(groups)) if(g.total>=3 && g.correct/g.total<0.65) add(`${skill}.${questionType}`,{questionType,title:`Practise ${typeLabel(questionType)}`,reason:`${g.correct}/${g.total} correct in your recent ${skill} attempt. Start with the relevant strategy, then retry that question type.`,evidenceCount:g.total});
   }
   if(skill==='speaking') {
    for(const [part,d] of Object.entries(result.partDiagnostics || {})) {
     if(!/^part[123]$/.test(part) || d?.needsPractice!==true || typeof d.evidence!=='string' || !d.evidence.trim()) continue;
     const text=Object.values(result.transcripts || {}).join(' ');
     if(!text.includes(d.evidence)) continue;
     add(`speaking.${part}`,{part:Number(part.slice(-1)),title:`Speaking Part ${part.slice(-1)} practice`,reason:`${d.reason || 'Develop this answer further.'} Evidence: “${d.evidence}”`,nextAction:d.nextAction});
    }
   }
   if(skill==='writing') {
    const taskEntries=Object.entries(result.taskCriteria || {});
    for(const [taskKey,criteria] of taskEntries) {
     const weak=Object.entries(criteria || {}).filter(([,v])=>typeof v?.band==='number').sort((a,b)=>a[1].band-b[1].band)[0];
     if(weak && weak[1].band<7) add(`writing.${weak[0]}`,{taskKind:taskKey.includes('1')?1:2,title:`Writing Task ${taskKey.includes('1')?1:2}: ${weak[0].replace(/([A-Z])/g,' $1').toLowerCase()}`,reason:weak[1].improvementFocus || weak[1].nextBandAdvice || 'Revise this criterion using a focused single-task review.'});
    }
   }
  }
 }
 return [...suggestions.values()].slice(0,6);
}
export function drillProgress(attempts = []) {
 const drills=attempts.filter(a=>a.status==='completed' && (a.type==='drill' || a.type==='writing_coach'));
 const groups={};
 for(const item of drills) {const key=item.focusKey || `${item.skill || 'writing'}.${item.taskKind || 'coach'}`; (groups[key] ||= []).push(item);}
 return Object.entries(groups).map(([key,items])=>({key,count:items.length,latest:items[0],previous:items[1] || null}));
}
