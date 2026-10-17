import { useRef, useState } from 'react';
import { submitWritingCoaching } from '../../utils/harper/writingSubmission.js';
import { suggestVocabulary } from '../../utils/harper/vocabularyCoach.js';
import { repeatColor } from '../../utils/harper/editorHighlights.js';
const labels={taskAchievement:'Task fulfilment',taskResponse:'Task response',coherenceAndCohesion:'Organisation & cohesion',lexicalResource:'Vocabulary',grammaticalRangeAndAccuracy:'Grammar'};


export function VocabularySuggestions({text}) {
 const suggestions=suggestVocabulary(text,6);
 return <section className="live-vocabulary" aria-labelledby="live-vocabulary-title"><div className="insight-section-heading"><h3 id="live-vocabulary-title">Words to try</h3><span className="live-caption">Updates as you write</span></div>
 {suggestions.length ? <div className="live-vocabulary-list">{suggestions.map(item=><article key={item.word} style={{'--word-tint':repeatColor(item.word,suggestions)}}><div><span>{item.word}</span><span aria-hidden="true">→</span><strong>{item.suggestion}</strong></div><details><summary>Meaning & use</summary><p>{item.meaning}</p>{item.example && <p><em>{item.example}</em></p>}{item.alternatives && <p>{item.alternatives.join(' · ')}</p>}</details></article>)}</div>:<p className="insight-muted">Vocabulary ideas appear here as your draft develops.</p>}
 </section>;
}

export function WritingReview({review,busy,error,localDiagnostics,onRetry}) {
 return <section className="writing-review" aria-label="Writing assessment" aria-busy={busy}>
 {busy && <div className="review-loading" role="status"><span className="review-spinner"/><div><h3>Reviewing your response</h3><p>Checking task fulfilment, organisation, cohesion, vocabulary, grammar, and conciseness.</p></div></div>}
 {error && <div className="review-error" role="alert"><h3>AI assessment unavailable</h3><p>{error}</p><p>Your draft and local checks are saved.</p>{onRetry && <button type="button" className="insight-secondary" onClick={onRetry}>Retry assessment</button>}</div>}
 {review && <><div className="review-question-focus"><span className="insight-eyebrow">ASSESSED QUESTION</span><p>“{review.questionFocus}”</p></div><div className="insight-section-heading"><h2>Your writing profile</h2><span className="insight-muted">Task estimate · separate from overall</span></div><div className="writing-review-criteria">{Object.entries(review.criteria).map(([key,item])=><article key={key}><div className="review-criterion-heading"><h3>{labels[key] || key}</h3><strong>{typeof item.band==='number'?item.band:'—'}</strong></div><div className="criterion-band-track"><span style={{width:`${(item.band || 0)/9*100}%`}}/></div><p>{item.feedback}</p><details><summary>Evidence & next step</summary>{item.evidence && <blockquote>“{item.evidence}”</blockquote>}<p>{item.nextAction}</p></details></article>)}</div>
 <section className="review-next-actions"><h3>Your next revision</h3><ol>{review.nextActions.map((action,i)=><li key={i}><span aria-hidden="true">{i+1}</span>{action}</li>)}</ol></section>
 {review.conciseness && <details className="coaching-notes"><summary>Conciseness</summary><p>{review.conciseness.feedback}</p>{review.conciseness.evidence && <blockquote>“{review.conciseness.evidence}”</blockquote>}</details>}
 <details className="coaching-notes"><summary>Assessment summary & limitations</summary><p>{review.summary}</p>{review.limitations && <p>{review.limitations}</p>}<p>AI practice feedback can contain mistakes. Local checks flag patterns; they do not establish complete grammatical accuracy.</p>{localDiagnostics && <p>Harper found {localDiagnostics.issueCount} issues across {localDiagnostics.totalSentences} sentences.</p>}</details></>}
 </section>;
}

export default function WritingCoach(props) {
 const [review,setReview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const run=async()=>{if(lock.current || !props.text.trim())return;lock.current=true;setBusy(true);setError('');try {const result=await submitWritingCoaching(props);if(result.status==='completed')setReview(result.evaluation);else setError(result.message || 'Connect your AI provider in Settings and retry.');}catch {setError('Could not complete the assessment. Please retry.');}finally{lock.current=false;setBusy(false);}};
 return <section className="coach-panel">{!review && !busy && <><p className="insight-muted">Submit for task, cohesion, vocabulary, and grammar feedback.</p><button type="button" className="btn-coral-pill-physical" onClick={run} disabled={!props.text.trim()}>Finish & Summary <span aria-hidden="true">→</span></button></>}{review?.text!==props.text && review && <p>Draft changed. <button onClick={run} disabled={busy}>Update summary</button></p>}<WritingReview review={review} busy={busy} error={error} onRetry={run}/></section>;
}
