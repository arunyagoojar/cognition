import { deriveFocusedRecommendations, drillProgress } from '../../utils/focusedPractice.js';
export default function FocusedRecommendations({ attempts, onStartDrill, onOpenLesson, onOpenTips }) {
 const items=deriveFocusedRecommendations(attempts), progress=drillProgress(attempts);
 return <section className="coach-panel" aria-label="Recommended focused practice">
  <h2>Your next focused practice</h2><p>Recommendations use the questions and feedback in your saved tests. A focused drill builds evidence about that area; it does not raise your full-test band.</p>
  {!items.length && <p>Complete a full test to receive specific recommendations. Existing attempts without detailed question or part feedback may not contain enough evidence.</p>}
  <div className="coach-criteria">{items.map(item=><article key={item.key}><h3>{item.title}</h3><p>{item.reason}</p>{item.nextAction && <p><strong>Try:</strong> {item.nextAction}</p>}
   <div className="coach-actions">
    {item.resources?.tip && <button type="button" onClick={()=>onOpenTips?.(item.resources.tip.skill,item.resources.tip.categoryId)}>Read the strategy</button>}
    {item.resources?.lesson && <button type="button" onClick={()=>onOpenLesson?.(item.resources.lesson.id)}>Watch a related lesson</button>}
    <button type="button" className="btn-coral-pill-physical" onClick={()=>onStartDrill?.(item)}>Practise this focus</button>
   </div>
  </article>)}</div>
  {progress.length>0 && <><h3>Focused practice progress</h3><ul>{progress.map(p=><li key={p.key}>{p.key.replaceAll('.',' · ')} — {p.count} session{p.count!==1?'s':''}{typeof p.latest.accuracy==='number' ? ` · latest ${p.latest.accuracy}%${typeof p.previous?.accuracy==='number' ? `, previous ${p.previous.accuracy}%` : ''}` : typeof p.latest.review?.criteria?.[p.key.split('.').at(-1)]?.band === 'number' ? ` · latest coaching estimate ${p.latest.review.criteria[p.key.split('.').at(-1)].band}${typeof p.previous?.review?.criteria?.[p.key.split('.').at(-1)]?.band === 'number' ? `, previous ${p.previous.review.criteria[p.key.split('.').at(-1)].band}` : ''}` : ' · coaching recorded'}</li>)}</ul></>}
 </section>;
}
