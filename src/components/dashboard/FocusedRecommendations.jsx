import { useRef } from 'react';
import usePracticeInsights from '../../hooks/usePracticeInsights.js';
import { SKILL_NAMES } from '../../utils/focusedPractice.js';
import Icon from '../common/Icon.jsx';

export function MiniTrend({ values = [], max = 9, label = 'Recent results' }) {
  if(values.length<2) return <span className="insight-baseline">First result</span>;
  const points=values.map((v,i)=>`${4+i*72/Math.max(1,values.length-1)},${30-v/max*26}`).join(' ');
  return <svg className="mini-trend" viewBox="0 0 80 34" role="img" aria-label={`${label}: ${values.map(v=>max===1?`${Math.round(v*100)}%`:v.toFixed(1)).join(', ')}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>{values.map((v,i)=><circle key={i} cx={4+i*72/Math.max(1,values.length-1)} cy={30-v/max*26} r="2.5" fill="currentColor"/>)}</svg>;
}

export default function FocusedRecommendations({ insights: supplied, onStartDrill, onOpenLesson, onOpenTips, onStartSkill }) {
  const live=usePracticeInsights(), insights=supplied || live;
  const {recommendations:items, attempts}=insights;
  const rail=useRef(null);
  const scroll=direction=>rail.current?.scrollBy({left:direction*340,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  return <section className="next-practice" aria-labelledby="next-practice-title">
    <div className="insight-section-heading"><div><span className="insight-eyebrow">YOUR NEXT MOVE</span><h2 id="next-practice-title">Practise this next</h2></div>
      {items.length>1 && <div className="rail-controls"><button type="button" aria-label="Previous recommendations" onClick={()=>scroll(-1)}><Icon name="arrowLeft"/></button><button type="button" aria-label="Next recommendations" onClick={()=>scroll(1)}><Icon name="arrowRight"/></button></div>}
    </div>
    {items.length ? <ol ref={rail} className="recommendation-rail" aria-label="Practice priorities, highest first">{items.map((item,i)=><li key={item.key} className={`recommendation-card skill-${item.skill}`}>
      <div className="recommendation-topline"><span className="priority-label">{i===0?'Priority 1':`Next · ${i+1}`}</span><span className="insight-eyebrow">{SKILL_NAMES[item.skill]}</span></div>
      <h3>{item.title}</h3>
      <div className="recommendation-evidence"><strong>{item.accuracy!==undefined?`${item.accuracy}%`:item.band!==undefined?item.band.toFixed(1):`${item.flagged}/${item.samples}`}</strong><span>{item.accuracy!==undefined?`${item.correct}/${item.total} correct`:item.band!==undefined?(item.kind==='skill'?'skill estimate':'task estimate'):'reviews flagged'}</span><MiniTrend values={item.history} max={item.accuracy!==undefined?1:9}/></div>
      <div className="recommendation-tags">{(item.questionTypes || [item.trend || 'Part-specific feedback']).slice(0,3).map(t=><span key={t}>{t}</span>)}</div>
      <button type="button" className="btn-coral-pill-physical" onClick={()=>item.kind==='skill'?onStartSkill?.(item.skill):onStartDrill?.(item)}>Practise {item.kind==='skill'?SKILL_NAMES[item.skill]:item.questionType?'this type':item.skill==='reading'?`Passage ${item.part}`:item.skill==='writing'?`Task ${item.taskKind}`:`Part ${item.part}`} <span aria-hidden="true">→</span></button>
      {(item.resources?.tip || item.resources?.lesson || item.evidence || item.reason) && <details className="recommendation-details"><summary>Why this focus?</summary><p>{item.reason}</p>{item.nextAction && <p>{item.nextAction}</p>}{item.evidence && <blockquote>“{item.evidence}”</blockquote>}<div className="insight-links">{item.resources?.tip && <button onClick={()=>onOpenTips?.(item.resources.tip.skill,item.resources.tip.categoryId)}>Strategy</button>}{item.resources?.lesson && <button onClick={()=>onOpenLesson?.(item.resources.lesson.id)}>Lesson</button>}</div></details>}
    </li>)}</ol> : <div className="recommendation-empty"><Icon name="sparkles" size={24}/><div><h3>{attempts.length?'Unlock section-level practice':'Find your first focus'}</h3><p>{attempts.length?'No confirmed weak section yet. A new full test adds detailed results.':'Take a test to get a practice plan based on your results.'}</p></div><button type="button" className="insight-secondary" onClick={()=>onStartSkill?.('reading')}>Take a reading test <span aria-hidden="true">→</span></button></div>}
  </section>;
}
