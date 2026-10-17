import { resolveRecommendations } from '../../data/recommendations.js';
import { useState } from 'react';
import Icon from '../common/Icon.jsx';
import FocusedRecommendations, { MiniTrend } from '../dashboard/FocusedRecommendations.jsx';
import ProgressTimeline from '../dashboard/ProgressTimeline.jsx';
import usePracticeInsights from '../../hooks/usePracticeInsights.js';
import { derivePerformanceSummary } from '../../utils/performanceStore.js';
import { calculateOverallBand } from '../../utils/bandCalculator.js';
import { SKILL_NAMES, drillProgress } from '../../utils/focusedPractice.js';
const SKILLS=['listening','reading','writing','speaking'];
const ICONS={listening:'headphones',reading:'book',writing:'pen',speaking:'mic'};
const CRITERIA={taskAchievement:'Task fulfilment',taskResponse:'Task response',coherenceAndCohesion:'Organisation & cohesion',lexicalResource:'Vocabulary',grammaticalRangeAndAccuracy:'Grammar',fluencyAndCoherence:'Fluency & coherence'};
const numericBand=v=>typeof v==='number' && Number.isFinite(v)?v:null;

function AccuracyBar({group}) {
  return <div className="accuracy-track" role="img" aria-label={`${group.correct} correct, ${group.total-group.correct-group.uncertain} incorrect, ${group.uncertain} uncertain, out of ${group.total}`}><span className="accuracy-correct" style={{width:`${group.correct/group.total*100}%`}}/><span className="accuracy-uncertain" style={{width:`${group.uncertain/group.total*100}%`}}/></div>;
}

export default function PerformancePage({scores = {},targetBand,onStartSkill,onStartDrill,onOpenLesson,onOpenTips,onReviewResult}) {
  const insights=usePracticeInsights(), {attempts,bySkill,recommendations}=insights;
  const summary=derivePerformanceSummary({attempts});
  const bands=Object.fromEntries(SKILLS.map(skill=>[skill,numericBand(summary.latestScores[skill]?.band ?? scores[skill]?.band)]));
  const overall=calculateOverallBand(...SKILLS.map(skill=>bands[skill]));
  const target=Number(targetBand)||7;
  const [selected,setSelected]=useState('reading');
  const model=bySkill[selected], result=model.result || scores[selected];
  const previous=derivePerformanceSummary({attempts:attempts.filter(a=>a.id!==summary.recentAttempts[0]?.id)}).overallBand;
  const delta=overall!==null && previous!==null?overall-previous:null;
  const select=skill=>{setSelected(skill);document.getElementById('skill-detail')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});};
  const startSection=section=>{
    const match=recommendations.find(r=>r.skill===selected && r.kind==='section' && (r.part || r.taskKind)===section.key);
    onStartDrill?.(match || {key:`${selected}.${selected==='writing'?'task':'part'}${section.key}`,skill:selected,part:section.key,taskKind:section.key,testId:section.testId || model.diagnosticTestId || model.result?.testId || model.latest?.testId,sourceAttemptId:section.sourceAttemptId || model.diagnosticAttemptId,title:`${SKILL_NAMES[selected]} · ${section.label}`});
  };
  const startQuestionType=group=>{
    const section=(group.sections || []).filter(s=>typeof s.accuracy==='number').sort((a,b)=>a.accuracy-b.accuracy)[0];
    if(!section)return;
    const key=`${selected}.${group.key}`;
    onStartDrill?.({key,skill:selected,part:section.part,questionType:group.key,testId:model.diagnosticTestId,sourceAttemptId:model.diagnosticAttemptId,title:`${SKILL_NAMES[selected]} · ${section.label} · ${group.label}`,resources:resolveRecommendations({key,skill:selected})});
  };
  const progress=drillProgress(attempts);
  const criteria=Object.entries(result?.criteria || {}).filter(([key])=>CRITERIA[key]);
  return <main className="performance-studio">
    <div className="insight-page-title"><div><span className="insight-eyebrow">YOUR LEARNING PICTURE</span><h1>Your performance</h1></div><span className="insight-count">{summary.completedCount} full tests</span></div>
    <section className="performance-hero insight-panel" aria-label="Overall score and skill breakdown">
      <div className="overall-visual"><div className="score-orbit" style={{'--score-angle':`${(overall || 0)/9*360}deg`}}><div><span className="insight-eyebrow">OVERALL ESTIMATE</span><strong>{overall!==null?overall.toFixed(1):'—'}</strong><span>Target {target.toFixed(1)}</span></div></div><span className="score-trend">{delta===null?'Latest complete skill profile':delta===0?'Unchanged since your last result':`${delta>0?'↑ +':'↓ '}${delta.toFixed(1)} since your last result`}</span></div>
      <div className="hero-skill-breakdown"><h2>Four skills. One picture.</h2>{SKILLS.map(skill=><button type="button" key={skill} className={`hero-skill-row skill-${skill}`} onClick={()=>select(skill)}><span className="skill-icon"><Icon name={ICONS[skill]}/></span><span>{SKILL_NAMES[skill]}</span><span className="skill-band-track"><span style={{width:`${(bands[skill] || 0)/9*100}%`}}/></span><strong>{bands[skill]!==null?bands[skill].toFixed(1):'—'}</strong><span aria-hidden="true">↗</span></button>)}
        <details className="score-method"><summary>How this score works</summary><p>Latest complete test in each skill → average of all four → nearest half band. Drills and Harper coaching stay separate. Writing Task 2 carries twice the weight of Task 1. Speaking is provisional without pronunciation assessment.</p>{overall!==null && <p className="score-formula">({SKILLS.map(s=>bands[s].toFixed(1)).join(' + ')}) ÷ 4 → <strong>{overall.toFixed(1)}</strong></p>}</details>
      </div>
    </section>
    <FocusedRecommendations insights={insights} onStartDrill={onStartDrill} onOpenLesson={onOpenLesson} onOpenTips={onOpenTips} onStartSkill={onStartSkill}/>
    <section className="insight-panel skill-explorer" id="skill-detail" aria-labelledby="skill-detail-title">
      <div className="insight-section-heading"><div><span className="insight-eyebrow">LOOK CLOSER</span><h2 id="skill-detail-title">Where you stand</h2></div>{model.latest && <button type="button" className="insight-secondary" onClick={()=>onReviewResult?.(selected,{...model.result,attemptId:model.latest.id,testId:model.result?.testId || model.latest.testId})}>Review test <span aria-hidden="true">↗</span></button>}</div>
      <div className="skill-explorer-tabs" aria-label="Explore a skill">{SKILLS.map(skill=><button type="button" className={`skill-${skill}`} key={skill} aria-pressed={selected===skill} onClick={()=>setSelected(skill)}><Icon name={ICONS[skill]}/>{SKILL_NAMES[skill]} <strong>{bands[skill]!==null?bands[skill].toFixed(1):'—'}</strong></button>)}</div>
      <div className={`skill-explorer-body skill-${selected}`} key={selected}>
        <div className="insight-section-heading"><h3>{selected==='reading'?'Passage performance':selected==='listening'?'Part performance':selected==='writing'?'Task performance':'Part observations'}</h3><span className="insight-muted">{selected==='speaking'?'Coaching evidence · no part bands':'Latest detailed result'}</span></div>
        <div className="section-performance-grid">{(model.sections.length?model.sections:Array.from({length:selected==='writing'?2:selected==='listening'?4:3},(_,i)=>({key:i+1,label:`${selected==='reading'?'Passage':selected==='writing'?'Task':'Part'} ${i+1}`}))).map(section=>{
          const known=selected==='reading'||selected==='listening'?section.total>0:selected==='writing'?section.band!==null && section.band!==undefined:section.samples>0;
          const weak=selected==='speaking'?section.needsPractice:section.accuracy!==undefined?section.accuracy<0.7:section.band<7;
          return <article className={`section-performance ${known&&weak?'needs-focus':''}`} key={section.key}><div className="section-performance-label"><h4>{section.label}</h4><span className="section-status">{!known?'No detail':weak?'Focus here':'Building well'}</span></div>
            <div className="section-performance-value"><strong>{!known?'—':section.total?`${Math.round((section.accuracy || 0)*100)}%`:selected==='writing'?section.band.toFixed(1):section.needsPractice?'Develop':'Secure'}</strong><MiniTrend values={section.history} max={selected==='writing'?9:1}/></div>
            {section.total>0 && <><AccuracyBar group={section}/><span className="insight-muted">{section.correct}/{section.total} correct{section.uncertain?` · ${section.uncertain} uncertain`:''}</span></>}
            {selected==='speaking' && known && <span className="insight-muted">{section.flagged}/{section.samples} reviews flagged</span>}
            {selected==='writing' && known && <span className="insight-muted">Task estimate · {section.samples} results</span>}
            {known && <button type="button" className="insight-text-button" onClick={()=>startSection(section)}>Practise {section.label.toLowerCase()} <span aria-hidden="true">→</span></button>}
          </article>;
        })}</div>
        {(selected==='reading'||selected==='listening') && <><div className="insight-section-heading"><h3>Question types</h3><span className="accuracy-legend"><i/>Correct <i/>Uncertain</span></div>{model.types.length?<div className="question-type-results">{model.types.slice().sort((a,b)=>(a.accuracy ?? 1)-(b.accuracy ?? 1)).map(group=><div className="question-type-row" key={group.key}><span>{group.label}</span><AccuracyBar group={group}/><strong>{group.correct}/{group.total}</strong><button type="button" className="insight-text-button" onClick={()=>startQuestionType(group)} disabled={!group.sections?.some(s=>typeof s.accuracy==='number')} aria-label={`Practise ${group.label}`}>Practise <span aria-hidden="true">→</span></button></div>)}</div>:<div className="detail-empty"><Icon name="book" size={22}/><p>These saved results contain a band, but no question breakdown.</p><button type="button" className="insight-secondary" onClick={()=>onStartSkill?.(selected)}>Take a {selected} test</button></div>}</>}
        {(selected==='writing'||selected==='speaking') && model.sections.every(s=>!s.samples) && <div className="detail-empty"><p>A new full test adds {selected==='writing'?'task comparisons':'part observations'}.</p><button type="button" className="insight-secondary" onClick={()=>onStartSkill?.(selected)}>Take a {selected} test</button></div>}
        {(selected==='writing'||selected==='speaking') && <details className="coaching-notes"><summary>Coaching notes <span>{criteria.length} criteria</span></summary><div className="criteria-feedback-grid">{criteria.map(([key,value])=><article key={key}><h4>{CRITERIA[key]} <strong>{numericBand(value?.band)!==null?value.band.toFixed(1):'—'}</strong></h4><p>{value.improvementFocus || value.nextBandAdvice || value.personalizedAssessment || value.evidence || 'Detailed feedback is available in the test review.'}</p></article>)}</div>{!criteria.length && <p>Complete a new {selected} assessment to receive criterion feedback.</p>}{result?.areasForImprovement && <p>{result.areasForImprovement}</p>}</details>}
      </div>
    </section>
    <ProgressTimeline skillHistory={summary.skillHistory}/>
    {progress.length>0 && <details className="insight-panel focused-history"><summary>Focused practice history <span>{progress.reduce((n,p)=>n+p.count,0)} sessions · separate from overall</span></summary><div className="focused-history-grid">{progress.map(p=><div key={p.key}><strong>{p.key.replaceAll('.',' · ')}</strong><span>{p.count} sessions</span>{typeof p.latest.accuracy==='number' && <b>{p.latest.accuracy}% latest</b>}</div>)}</div></details>}
  </main>;
}
