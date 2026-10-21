import React from 'react';
import {compareSpelling,describeSpellingChanges} from '../../utils/spelling/comparison.js';

export default function SpellingComparison({word,answer}) {
 const letters=compareSpelling(word,answer);
 return <div className="bee-comparison">
  <div className="bee-comparison-grid">
   <div className="bee-comparison-side">
    <p className="bee-comparison-label">Correct spelling</p>
    <h2 aria-label={word}><span aria-hidden="true">{letters.map((part,i)=>part.expected && <span key={i} className={`bee-letter ${part.kind==='match' || !answer?'is-match':'needs-attention'}`}>{part.expected}</span>)}</span></h2>
   </div>
   <div className="bee-comparison-side">
    <p className="bee-comparison-label">You wrote</p>
    {answer?<div className="bee-compared-word" aria-label={`Your answer: ${answer}`}><span aria-hidden="true">{letters.map((part,i)=><span key={i} className={`bee-letter is-${part.kind}`}>{part.actual || <span className="bee-missing-slot">·</span>}</span>)}</span></div>:<p className="bee-no-answer">No answer submitted.</p>}
   </div>
  </div>
  {answer && <>
   <p className="bee-comparison-key"><span>Green: matching letters</span><span>Underlined: letters to fix</span>{letters.some(part=>part.kind==='missing') && <span>Outlined slot: missing letter</span>}</p>
   <p className="bee-comparison-help">{describeSpellingChanges(letters) || 'The spelling was correct, but the time had run out.'}</p>
  </>}
 </div>;
}
