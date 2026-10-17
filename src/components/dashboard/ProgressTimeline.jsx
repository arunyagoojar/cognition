import { useState } from 'react';
import { buildProgressSeries } from '../../utils/progressTimeline.js';
export default function ProgressTimeline({skillHistory = {}}) {
  const [selected,setSelected]=useState('overall'), [active,setActive]=useState(null);
  const series=buildProgressSeries(skillHistory,selected);
  const point=series[active] || series.at(-1);
  const width=640,height=200,pad=24;
  const x=i=>series.length===1?width/2:pad+i*(width-pad*2)/Math.max(1,series.length-1);
  const y=band=>height-pad-band/9*(height-pad*2);
  const line=series.map((p,i)=>`${i?'L':'M'}${x(i)},${y(p.band)}`).join(' ');
  return <section className="insight-panel progress-chart" aria-labelledby="progress-title">
    <div className="insight-section-heading"><h2 id="progress-title">Your progress</h2><span className="chart-current">{point?`Band ${point.band.toFixed(1)}`:'—'}</span></div>
    <div className="insight-segments" aria-label="Chart skill">{['overall','listening','reading','writing','speaking'].map(skill=><button key={skill} type="button" aria-pressed={selected===skill} onClick={()=>{setSelected(skill);setActive(null);}}>{skill[0].toUpperCase()+skill.slice(1)}</button>)}</div>
    {series.length ? <><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${selected} band history. Focus a point for its result.`}>
      {[0,3,6,9].map(b=><g key={b}><line x1={pad} x2={width-pad} y1={y(b)} y2={y(b)} stroke="currentColor" opacity=".2" strokeDasharray="3 5"/><text x="4" y={y(b)+4} fontSize="11" fill="currentColor">{b}</text></g>)}
      <path d={line} fill="none" stroke="var(--c-coral)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
      {series.map((p,i)=><g key={`${p.at}-${i}`} role="button" tabIndex="0" aria-label={`Result ${i+1}: band ${p.band.toFixed(1)}${p.at?`, ${new Date(p.at).toLocaleDateString()}`:''}`} onMouseEnter={()=>setActive(i)} onFocus={()=>setActive(i)} onClick={()=>setActive(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault();setActive(i);}}}><circle cx={x(i)} cy={y(p.band)} r="12" fill="transparent"/><circle cx={x(i)} cy={y(p.band)} r={active===i?6:4} fill="var(--bg-card)" stroke="var(--c-coral)" strokeWidth="2.5"/></g>)}
    </svg><div className="chart-caption" aria-live="polite"><span>{point?.at?new Date(point.at).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Latest result'} · {series.length} {selected==='overall'?'complete skill profiles':'results'}</span><span>{point?.skills?Object.entries(point.skills).map(([s,b])=>`${s[0].toUpperCase()} ${b.toFixed(1)}`).join(' · '):'Full tests only'}</span></div></> : <div className="chart-empty">{selected==='overall'?'Complete all four skills to begin your overall timeline.':`Your full ${selected} tests will appear here.`}</div>}
  </section>;
}
