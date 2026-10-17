import { calculateOverallBand } from './bandCalculator.js';
// Use precisely the same latest-four-skills calculation as the current score.
export function buildProgressSeries(skillHistory = {}, selected = 'overall') {
  if(selected!=='overall') return [...(skillHistory[selected] || [])].sort((a,b)=>(a.completedAt || '').localeCompare(b.completedAt || '')).map(p=>({at:p.completedAt,band:p.band,skill:selected}));
  const events=Object.entries(skillHistory).flatMap(([skill,points])=>points.map(p=>({...p,skill,at:p.completedAt || ''}))).sort((a,b)=>a.at.localeCompare(b.at));
  const standing={listening:null,reading:null,writing:null,speaking:null}, series=[];
  for(let i=0;i<events.length;i++) {
    const event=events[i];standing[event.skill]=event.band;
    if(events[i+1]?.at===event.at) continue;
    const band=calculateOverallBand(standing.listening,standing.reading,standing.writing,standing.speaking);
    if(band!==null) series.push({at:event.at,band,skills:{...standing},skill:event.skill});
  }
  return series;
}
