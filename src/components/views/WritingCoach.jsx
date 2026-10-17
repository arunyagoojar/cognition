import { useRef, useState } from 'react';
import { reviewWritingPractice } from '../../utils/geminiEvaluator.js';
import { recordAttempt, createAttemptId } from '../../utils/performanceStore.js';
import { syncAttempt } from '../../utils/api.js';
import { suggestVocabulary } from '../../utils/harper/vocabularyCoach.js';
const labels = {taskAchievement:'Task achievement', taskResponse:'Task response', coherenceAndCohesion:'Coherence & cohesion', lexicalResource:'Vocabulary', grammaticalRangeAndAccuracy:'Grammar range & accuracy'};
export default function WritingCoach({ text, task, taskKind = 2, testId, focusKey, sourceAttemptId }) {
 const [review, setReview] = useState(null), [busy,setBusy] = useState(false), [error,setError] = useState('');
 const locked = useRef(false);
 const suggestions = suggestVocabulary(text);
 const run = async () => {
   if (locked.current || !text.trim()) return;
   locked.current = true; setBusy(true); setError('');
   const snapshot = text;
   try {
     const result = await reviewWritingPractice({text:snapshot, task, taskKind});
     if (result.status !== 'completed') { setError(result.message || 'Review unavailable. Your draft is saved; try again.'); return; }
     const item={...result.evaluation, text:snapshot}; setReview(item);
     const id=createAttemptId('writing_coach');
     const attempt={id,type:'writing_coach',status:'completed',practiceMode:'drill',bandEligible:false,testId,taskKind,task,focusKey,sourceAttemptId,originalText:snapshot,review:item,completedAt:new Date().toISOString()};
     recordAttempt(attempt); void syncAttempt(attempt);
   } catch { setError('Could not complete the review. Keep writing or try again.'); }
   finally { locked.current=false; setBusy(false); }
 };
 return <section className="coach-panel" aria-label="Writing coach">
  <h3>Words to consider as you write</h3>
  <p>Suggestions update with your draft. Choose words that preserve your meaning; no text changes automatically.</p>
  {suggestions.length ? <div className="vocabulary-grid">{suggestions.map(item=><details key={item.word}>
    <summary>“{item.word}” → {item.suggestion}{item.count>1 ? ` · used ${item.count} times` : ''}</summary>
    <p>{item.meaning}</p><p><em>{item.example}</em></p>
  </details>)}</div> : <p>Keep writing. Relevant vocabulary suggestions will appear here.</p>}
  <h3>Review the whole response with AI</h3>
  <p>Reviews task fulfilment, organisation, cohesion, vocabulary, and grammar. Sends this draft, the question, and any supported Task 1 visual to your configured AI provider when you request a review. Local Harper checks continue independently.</p>
  <button type="button" className="btn-coral-pill-physical" disabled={busy || !text.trim()} onClick={run}>{busy?'Reviewing your response…':'Review with AI'}</button>
  {error && <p role="alert">{error}</p>}
  {review && <div aria-live="polite">
    {review.text!==text && <p role="status">This review is for an earlier draft. Review again after your edits.</p>}
    <p><strong>Single-task coaching · excluded from your overall band</strong></p>
    {review.limitations && <p>{review.limitations}</p>}
    <h4>Your next three actions</h4><ol>{review.nextActions.map((action,i)=><li key={i}>{action}</li>)}</ol>
    <div className="coach-criteria">{Object.entries(review.criteria).map(([key,item])=><section key={key}><h4>{labels[key] || key}{typeof item.band==='number' ? ` · estimate ${item.band}` : ' · limited evidence'}</h4><p>{item.feedback}</p>{item.evidence && <blockquote>{item.evidence}</blockquote>}<p><strong>Try:</strong> {item.nextAction}</p></section>)}</div>
    <details><summary>Review summary & original draft</summary><p>{review.summary}</p><pre className="coach-original">{review.text}</pre></details>
  </div>}
 </section>;
}
