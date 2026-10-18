import { typeLabel } from './insights.js';
import { resolveRecommendations } from '../data/recommendations.js';
import { isBandEligible } from './practiceScope.js';
import { recoverSpeakingDiagnostics } from './speakingDiagnostics.js';

export const SKILL_NAMES = { reading:'Reading', listening:'Listening', writing:'Writing', speaking:'Speaking' };
export const sectionLabel = (skill, part) => `${skill === 'reading' ? 'Passage' : skill === 'writing' ? 'Task' : 'Part'} ${part}`;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const average = values => values.length ? values.reduce((sum,v)=>sum+v,0)/values.length : null;
const resultFor = (a, skill) => a[skill] || a.skills?.[skill] || (a.type === skill ? a : null);
const fullAttempts = attempts => attempts.filter(a => a.status === 'completed' && isBandEligible(a));
const completeResult = result => result && !['partial','failed','not_attempted','in_progress'].includes(result.status)
  && result.bandEligible !== false && result.practiceMode !== 'drill' && !result.lowCoverage
  && result.coverage?.complete !== false && result.coverage?.isComplete !== false;

function sourceMetadata(index, skill, testId) {
  const pool = index?.[skill] || {};
  return pool[String(testId)] || Object.values(pool).find(r => r.aliases?.includes(testId));
}

// Never infer a section from an overall band. Old question-level records can use
// the answer-free source index, but old aggregate-only records stay unclassified.
export function objectiveBreakdown(attempt, skill, index) {
  const result = resultFor(attempt, skill);
  if (!result?.itemResults) return null;
  const testId = result.testId || attempt.testId;
  const metadata = sourceMetadata(index, skill, testId);
  const sections = new Map(), types = new Map(), typeSections = new Map();
  for (const [id,item] of Object.entries(result.itemResults)) {
    if (!item || (!item.finalResult && typeof item.deterministicCorrect !== 'boolean')) continue;
    const source = metadata?.questions?.[id];
    const part = Number(item.part ?? item.passageNumber ?? item.sectionNumber ?? source?.[0]);
    const questionType = source?.[1] || item.questionType;
    const uncertain = item.finalResult === 'UNCERTAIN' || item.unresolved === true;
    const correct = !uncertain && (item.finalResult === 'CORRECT' || (!item.finalResult && item.deterministicCorrect === true));
    const add = (map,key,label) => {
      if (!map.has(key)) map.set(key,{key,label,correct:0,total:0,uncertain:0,types:new Set(),questionIds:[]});
      const group=map.get(key);group.total++;group.correct+=Number(correct);group.uncertain+=Number(uncertain);group.questionIds.push(id);
      if (questionType) group.types.add(questionType);
    };
    if (Number.isInteger(part) && part>0 && part<=4) {
      add(sections,part,sectionLabel(skill,part));
      if (questionType) {
        const key=`${questionType}:${part}`;
        add(typeSections,key,sectionLabel(skill,part));
        Object.assign(typeSections.get(key),{part,questionType});
      }
    }
    if (questionType) add(types,questionType,typeLabel(questionType));
  }
  const finish = map => [...map.values()].map(g=>({...g,types:[...g.types],accuracy:g.total>g.uncertain ? g.correct/g.total:null,maxAccuracy:(g.correct+g.uncertain)/g.total}));
  const groupedTypes=finish(typeSections);
  return {testId,attemptId:attempt.id,sections:finish(sections),types:finish(types).map(group=>({...group,sections:groupedTypes.filter(section=>section.questionType===group.key)})),result};
}

export function buildPracticeInsights(attempts = [], index) {
  const full=fullAttempts(attempts).slice(0,40);
  const bySkill={}, recommendations=[];
  for (const skill of Object.keys(SKILL_NAMES)) {
    const history=full.filter(a=>completeResult(resultFor(a,skill)));
    const latest=history[0], result=latest && resultFor(latest,skill);
    const model={skill,latest,result,sections:[],types:[],notes:[],hasCompletedTest:history.length>0,hasDetailedResults:false};
    bySkill[skill]=model;
    const add=(key,details)=>recommendations.push({key,skill,testId:result?.testId || latest?.testId,sourceAttemptId:latest?.id,resources:resolveRecommendations({key,skill}),...details});
    if (skill==='reading' || skill==='listening') {
      const breakdowns=history.map(a=>objectiveBreakdown(a,skill,index)).filter(b=>b && (b.sections.length || b.types.length)).slice(0,5);
      model.sections=breakdowns[0]?.sections || [];model.types=breakdowns[0]?.types || [];model.diagnosticTestId=breakdowns[0]?.testId;model.diagnosticAttemptId=breakdowns[0]?.attemptId;
      model.hasDetailedResults=breakdowns.some(b=>b.sections.some(g=>g.total-g.uncertain>=3));
      for(const group of model.sections) group.history=breakdowns.map(b=>b.sections.find(g=>g.key===group.key)?.accuracy).filter(finite).reverse();
      const best=Math.max(0,...model.sections.map(s=>s.accuracy || 0));
      for(const group of model.sections) {
        if(!finite(group.accuracy) || group.total-group.uncertain<3) continue;
        const gap=best-group.maxAccuracy;
        if(group.maxAccuracy>=0.85 || (group.maxAccuracy>=0.7 && gap<0.15)) continue;
        const older=group.history.slice(0,-1), dip=older.length?Math.max(0,average(older)-group.accuracy):0;
        add(`${skill}.part${group.key}`,{testId:model.diagnosticTestId,sourceAttemptId:model.diagnosticAttemptId,part:group.key,kind:'section',title:`${SKILL_NAMES[skill]} · ${group.label}`,accuracy:Math.round(group.accuracy*100),correct:group.correct,total:group.total,history:group.history,questionTypes:group.types.map(typeLabel),reason:`${group.correct}/${group.total} correct in your latest test`,priority:(1-group.accuracy)*70+gap*20+dip*10,evidenceCount:group.total,trend:dip>=0.1?'Recent dip':older.length?'Tracked across tests':'First result'});
      }
      // A question type is a separate focus, never a generic "Practice this" link.
      for(const group of model.types) {
        if(!finite(group.accuracy) || group.maxAccuracy>=0.65 || group.total-group.uncertain<3) continue;
        const weakest=group.sections.filter(section=>finite(section.accuracy) && section.maxAccuracy<0.65 && section.total-section.uncertain>=3 && model.sections.find(part=>part.key===section.part)?.maxAccuracy<0.85).sort((a,b)=>a.accuracy-b.accuracy || b.total-a.total || a.part-b.part)[0];
        if(!weakest) continue;
        add(`${skill}.${group.key}`,{testId:model.diagnosticTestId,sourceAttemptId:model.diagnosticAttemptId,part:weakest.part,questionType:group.key,kind:'question-type',title:typeLabel(group.key),accuracy:Math.round(weakest.accuracy*100),correct:weakest.correct,total:weakest.total,questionTypes:[typeLabel(group.key)],reason:`${weakest.correct}/${weakest.total} correct · ${sectionLabel(skill,weakest.part)}`,priority:(1-weakest.accuracy)*65, evidenceCount:weakest.total});
      }
    } else if(skill==='writing') {
      for(const part of [1,2]) {
        const observations=history.map(a=>{
          const r=resultFor(a,skill), criteria=r.taskCriteria?.[`task${part}`];
          const values=Object.values(criteria || {}).map(c=>c?.band).filter(finite);
          const band=finite(r[`task${part}Band`]) ? r[`task${part}Band`] : values.length===4 ? average(values):null;
          return {band,criteria,a};
        }).filter(x=>finite(x.band)).slice(0,5);
        const current=observations[0];
        model.sections.push({key:part,label:sectionLabel(skill,part),band:current?.band ?? null,history:observations.map(x=>x.band).reverse(),samples:observations.length,testId:current && (resultFor(current.a,skill).testId || current.a.testId),sourceAttemptId:current?.a.id,criteria:current?.criteria});
      }
      const best=Math.max(0,...model.sections.map(s=>s.band || 0));
      model.hasDetailedResults=model.sections.some(s=>finite(s.band));
      for(const group of model.sections) {
        if(!finite(group.band)) continue;
        const older=group.history.slice(0,-1), dip=older.length?Math.max(0,average(older)-group.band):0;
        if(group.band>=7.5 || (group.band>=7 && best-group.band<0.5 && dip<0.5)) continue;
        add(`writing.task${group.key}`,{testId:group.testId,sourceAttemptId:group.sourceAttemptId,taskKind:group.key,kind:'section',title:`Writing · Task ${group.key}`,band:group.band,history:group.history,reason:`Task estimate ${group.band.toFixed(1)} · ${group.samples} full-test result${group.samples!==1?'s':''}`,priority:(9-group.band)/9*65+(best-group.band)*5+dip*5,trend:dip>=0.5?'Recent dip':group.samples>1?'Tracked across tests':'First result'});
      }
    } else {
      const diagnostics = new Map(history.map(a => [a, recoverSpeakingDiagnostics(resultFor(a,skill))]));
      for(const part of [1,2,3]) {
        const observations=[];
        for(const a of history) {
          const d=diagnostics.get(a)?.[`part${part}`];
          if(!d) continue;
          observations.push({d,a});
          if(observations.length===5) break;
        }
        const current=observations[0], flagged=observations.filter(o=>o.d.needsPractice).length;
        model.sections.push({key:part,label:sectionLabel(skill,part),needsPractice:current?.d.needsPractice,flagged,samples:observations.length,history:observations.map(o=>o.d.needsPractice?0:1).reverse(),testId:current && (resultFor(current.a,skill).testId || current.a.testId),sourceAttemptId:current?.a.id,observation:current?.d});
        if(!current?.d.needsPractice) continue;
        const r=resultFor(current.a,skill);
        add(`speaking.part${part}`,{testId:r.testId || current.a.testId,sourceAttemptId:current.a.id,part,kind:'section',title:`Speaking · Part ${part}`,reason:current.d.reason || 'Develop this part further',nextAction:current.d.nextAction,evidence:current.d.evidence,evidenceSource:current.d.source,flagged,samples:observations.length,priority:45+flagged/observations.length*20+(current.d.criterionKeys?.length || 0),trend:observations.length>1?`${flagged}/${observations.length} reviews flagged`:'First observation'});
      }
      model.hasDetailedResults=model.sections.some(s=>s.samples>0);
    }
  }
  // Aggregate-only history remains useful for the performance score, but cannot
  // identify a particular task to practise. The UI can offer a diagnostic test.
  const missingDetailedSkills=Object.keys(SKILL_NAMES).filter(skill=>!bySkill[skill].hasDetailedResults);
  const legacySkills=missingDetailedSkills.filter(skill=>bySkill[skill].hasCompletedTest);
  return {bySkill,missingDetailedSkills,legacySkills,recommendations:recommendations.sort((a,b)=>b.priority-a.priority || a.key.localeCompare(b.key)).slice(0,8)};
}

export function deriveFocusedRecommendations(attempts = [], index) { return buildPracticeInsights(attempts,index).recommendations; }
export function drillProgress(attempts = []) {
 const groups={};
 for(const item of attempts.filter(a=>a.status==='completed' && ['drill','writing_coach'].includes(a.type))) {const key=item.focusKey || `${item.skill || 'writing'}.${item.taskKind || 'coach'}`;(groups[key] ||= []).push(item);}
 return Object.entries(groups).map(([key,items])=>({key,count:items.length,latest:items[0],previous:items[1] || null}));
}
