import { useEffect, useRef, useState } from 'react';
import usePracticeInsights from '../../hooks/usePracticeInsights.js';
import { SKILL_NAMES } from '../../utils/focusedPractice.js';
import Icon from '../common/Icon.jsx';
import './FocusedRecommendations.css';

export function MiniTrend({ values = [], max = 9, label = 'Recent results' }) {
  if(values.length<2) return <span className="insight-baseline">First result</span>;
  const points=values.map((v,i)=>`${4+i*72/Math.max(1,values.length-1)},${30-v/max*26}`).join(' ');
  return <svg className="mini-trend" viewBox="0 0 80 34" role="img" aria-label={`${label}: ${values.map(v=>max===1?`${Math.round(v*100)}%`:v.toFixed(1)).join(', ')}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>{values.map((v,i)=><circle key={i} cx={4+i*72/Math.max(1,values.length-1)} cy={30-v/max*26} r="2.5" fill="currentColor"/>)}</svg>;
}

const ICONS = { reading:'book', listening:'headphones', writing:'pen', speaking:'mic' };
const partName = item => item.questionType ? `${SKILL_NAMES[item.skill]} ${item.skill==='reading'?'Passage':'Part'} ${item.part} · ${item.title}` : `${SKILL_NAMES[item.skill]} ${item.skill==='writing'?'Task':item.skill==='reading'?'Passage':'Part'} ${item.taskKind || item.part}`;
const shortReason = item => item.skill==='speaking'
  ? item.reason || 'This part needs more development in your latest feedback.'
  : 'You scored relatively low here in your last test.';

export default function FocusedRecommendations({ insights: supplied, onStartDrill, onOpenLesson, onOpenTips, onStartSkill }) {
  const live = usePracticeInsights(), insights = supplied || live;
  const items = insights.recommendations.filter(item=>item.kind!=='skill');
  const missing = insights.missingDetailedSkills || [];
  const rail = useRef(null);
  const itemKeys = `${items.map(item=>item.key).join('|')}|unlock:${missing.join('|')}`;
  const cardCount = items.length + Number(missing.length > 0);
  const [edges,setEdges] = useState({left:false,right:false});
  const updateEdges = () => {
    const node=rail.current;
    if(node)setEdges({left:node.scrollLeft>2,right:node.scrollLeft+node.clientWidth<node.scrollWidth-2});
  };
  useEffect(()=>{
    const node=rail.current;
    if(!node)return;
    node.scrollLeft=0;
    const measure=()=>{const current=rail.current;if(current)setEdges({left:current.scrollLeft>2,right:current.scrollLeft+current.clientWidth<current.scrollWidth-2});};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(node);
    return ()=>observer.disconnect();
  },[itemKeys]);
  const scroll = direction => {
    const node=rail.current, first=node?.firstElementChild;
    if(!first)return;
    const step=first.getBoundingClientRect().width+16;
    const index=Math.round(node.scrollLeft/step)+direction;
    node.scrollTo({left:Math.max(0,index*step),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  return <section className="next-practice" aria-labelledby="next-practice-title">
    <div className="insight-section-heading">
      <h2 id="next-practice-title">Practise this next</h2>
      {cardCount>1 && <div className="rail-controls"><button type="button" aria-label="Previous recommendations" disabled={!edges.left} onClick={()=>scroll(-1)}><Icon name="arrowLeft"/></button><button type="button" aria-label="Next recommendations" disabled={!edges.right} onClick={()=>scroll(1)}><Icon name="arrowRight"/></button></div>}
    </div>
    {cardCount>0 && <div className={`practice-rail-viewport${edges.left?' has-previous':''}${edges.right?' has-next':''}`}>
      <ol ref={rail} onScroll={updateEdges} className="practice-thumbnail-rail" aria-label="Recommended parts, highest priority first">
        {items.map((item,index)=><li key={item.key} className={`practice-thumbnail skill-${item.skill}`}>
          <div className="practice-thumbnail-heading"><span className="practice-thumbnail-icon" aria-hidden="true"><Icon name={ICONS[item.skill]} size={18}/></span><h3>{partName(item)}</h3>
            <div className="practice-thumbnail-score">{item.accuracy!==undefined?<><strong>{item.accuracy}%</strong><span>{item.correct}/{item.total} correct</span></>:typeof item.band==='number'?<><strong>{item.band.toFixed(1)}</strong><span>{item.skill==='speaking'?'part estimate':'task estimate'}</span></>:<><strong>{item.flagged}/{item.samples}</strong><span>reviews flagged</span></>}</div>
          </div>
          <p>{shortReason(item)}</p>
          <div className="practice-thumbnail-actions"><button type="button" className="practice-thumbnail-start" aria-label={`Practise ${partName(item)}`} onClick={()=>onStartDrill?.(item)}>Practise <Icon name="arrowRight" size={16}/></button>
            <div className="practice-thumbnail-resources">{item.resources?.tip && <button type="button" onClick={()=>onOpenTips?.(item.resources.tip.skill,item.resources.tip.categoryId,item.resources.tip.tipId)}>Strategy</button>}{item.resources?.lesson && <button type="button" onClick={()=>onOpenLesson?.(item.resources.lesson.id)}>Lesson</button>}</div>
          </div>
          <span className="practice-priority" aria-label={`Priority ${index+1}`}>{String(index+1).padStart(2,'0')}</span>
        </li>)}
        {missing.length>0 && <li className="practice-thumbnail practice-thumbnail-unlock">
          <div className="practice-thumbnail-heading"><span className="practice-thumbnail-icon" aria-hidden="true"><Icon name="sparkles" size={18}/></span><h3>{items.length?'Add recommendations for your other skills':'Unlock recommendations'}</h3></div>
          <p>Complete one full practice test in each skill.</p>
          <div className="practice-unlock-skills">{missing.map(skill=><button key={skill} type="button" onClick={()=>onStartSkill?.(skill)}>{SKILL_NAMES[skill]}</button>)}</div>
        </li>}
      </ol>
    </div>}
    {!cardCount && <div className="practice-unlock"><Icon name="check" size={23}/><div><h3>No weak part identified in your recent tests</h3><p>Your results are balanced. Your next full test will update this view.</p></div></div>}
  </section>;
}
