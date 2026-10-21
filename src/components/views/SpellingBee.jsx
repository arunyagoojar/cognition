import React,{useEffect,useRef,useState} from 'react';
import Icon from '../common/Icon.jsx';
import {readDraft,writeDraft,getDraftScope} from '../../utils/drafts.js';
import {createSessionWords,gradeWord,sessionSummary,summarizeActivity,spellingScoreOutOf9,WORD_TIME_MS} from '../../utils/spelling/engine.js';
import {readSpellingActivity,saveSpellingActivity,SPELLING_EVENT} from '../../utils/spelling/store.js';
import {dictionaryEntry} from '../../utils/spelling/dictionary.js';
import {pronounceWord} from '../../utils/spelling/speech.js';
import './spellingBee.css';
import SpellingComparison from './SpellingComparison.jsx';

function SpeakerIcon(){return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>;}
function DictionarySource({label,name,url}) {
 return name?<p className="bee-footnote">{label}: <a href={url} target="_blank" rel="noreferrer">{name}</a>.</p>:null;
}
function WordReview({entry,result,loading,onRetry}) {
 return <div className="bee-explanation">
  <div className="bee-word-title"><span className="insight-eyebrow">{result.timedOut?'TIME’S UP':'LET’S REMEMBER THIS ONE'}</span><SpellingComparison word={result.word} answer={result.answer}/></div>
  {entry?<>
   <h3 className="bee-division-title">Dictionary word division</h3>
   {entry.syllables.length?<div className="bee-chunks" aria-label="Dictionary word division">{entry.syllables.map((part,i)=><span key={i}>{part}</span>)}</div>:<p className="insight-muted">No word division is supplied by the bundled dictionaries for this word.</p>}
   <DictionarySource label="Division source" name={entry.divisionSource} url={entry.divisionSourceUrl}/>
   <div className="bee-note-grid">
    <div><h3>Meaning</h3><p>{entry.meaning}</p><p className="bee-footnote">{entry.meaningSource}</p></div>
    <div><h3>Example</h3><p>{entry.example || 'No example sentence is supplied for this entry.'}</p></div>
    <div className="bee-origin"><h3>Roots & origin</h3><p>{entry.etymology || 'No etymology is supplied by the bundled dictionaries for this word.'}</p>
     {entry.roots.map(root=><p key={root.term}><strong>{root.term}</strong> — {root.meaning}</p>)}
     <DictionarySource label="Origin source" name={entry.etymologySource} url={entry.etymologySourceUrl}/>
    </div>
   </div>
   <p className="bee-footnote">Word divisions follow the credited dictionary’s printed hyphenation; roots describe the word’s origin. Historical entries may use older spellings and abbreviations. Gr. = Greek · L. = Latin · F. = French · OE. = Old English.</p>
  </>:loading?<p role="status">Loading word notes…</p>:<div><p>Dictionary notes could not load.</p><button type="button" className="insight-secondary" onClick={onRetry}>Retry word notes</button></div>}
 </div>;
}
function ResultList({title,results,empty}) {
 const timing=result=>Number.isFinite(result.responseTimeMs)?`${(result.responseTimeMs/1000).toFixed(1)}s`:'timing unavailable';
 return <section className="insight-panel bee-result-list"><h2>{title} <span>{results.length}</span></h2>{results.length?<ul>{results.map(result=><li key={result.word}><strong>{result.word}</strong><span>{result.correct?`Correct · ${timing(result)}`:(result.timedOut?'Time ran out':result.answer || 'No answer')}</span></li>)}</ul>:<p className="insight-muted">{empty}</p>}</section>;
}

export default function SpellingBee({onBack}) {
 const [records,setRecords]=useState(readSpellingActivity);
 const [session,setSession]=useState(()=>readDraft('spelling-bee'));
 const [answer,setAnswer]=useState(''),[remaining,setRemaining]=useState(10),[entry,setEntry]=useState(null),[audioError,setAudioError]=useState(''),[saveError,setSaveError]=useState('');
 const [notesLoading,setNotesLoading]=useState(false),[notesRetry,setNotesRetry]=useState(0);
 const [voices,setVoices]=useState([]);
 const sessionRef=useRef(session),input=useRef(null),cancelSpeech=useRef(null),locked=useRef(false);
 sessionRef.current=session;
 const voice=voices.find(v=>v.localService && /^en[-_]GB/i.test(v.lang)) || voices.find(v=>v.localService && /^en/i.test(v.lang));
 const current=session?.words?.[session.results.length];
 const phase=session?.stage;
 const reviewTarget=phase==='review'?session.words[session.results.length-1]?.word:null;
 const commit=next=>{sessionRef.current=next;setSession(next);if(!writeDraft('spelling-bee',next))setSaveError('Device storage is full or blocked. Keep this page open to finish your session.');};
 useEffect(()=>{
  const update=()=>setRecords(readSpellingActivity());window.addEventListener(SPELLING_EVENT,update);window.addEventListener('storage',update);
  const speech=window.speechSynthesis;
  const load=()=>setVoices(speech?.getVoices() || []);load();speech?.addEventListener('voiceschanged',load);
  return()=>{window.removeEventListener(SPELLING_EVENT,update);window.removeEventListener('storage',update);speech?.removeEventListener('voiceschanged',load);cancelSpeech.current?.();};
 },[]);
 useEffect(()=>{
  if(phase==='speaking')commit({...sessionRef.current,stage:'ready'});
  // Only repair an interrupted utterance when the component mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  if(!reviewTarget)return;
  let active=true;setEntry(null);setNotesLoading(true);dictionaryEntry(reviewTarget).then(value=>{if(active)setEntry(value);}).catch(()=>{}).finally(()=>{if(active)setNotesLoading(false);});
  return()=>{active=false;};
 },[reviewTarget,notesRetry]);
 const advance=()=>{
  const value=sessionRef.current;
  cancelSpeech.current?.();
  setAnswer('');setAudioError('');setEntry(null);locked.current=false;
  if(value.results.length===30){commit({...value,stage:'summary',deadline:null});return;}
  commit({...value,stage:'ready',deadline:null});setRemaining(10);
 };
 const submit=(timedOut=false)=>{
  const value=sessionRef.current;
  if(locked.current || value?.stage!=='answering' || !timedOut && !answer.trim())return;
  locked.current=true;
  const responseTimeMs=Math.min(WORD_TIME_MS,Math.max(0,WORD_TIME_MS-(value.deadline-Date.now())));
  const result=gradeWord(value.words[value.results.length].word,answer,{responseTimeMs,timedOut});
  const next={...value,results:[...value.results,result],stage:result.correct?'correct':'review',deadline:null};
  // The current review uses the last result; the next word is never exposed.
  if(next.results.length===30) {
   try {saveSpellingActivity({id:next.id,kind:'session',source:'spelling-bee',policyVersion:next.results.every(row=>Number.isInteger(row.responseTimeMs))?2:undefined,completedAt:new Date().toISOString(),results:next.results});}
   catch {setSaveError('Your score could not be saved. Free some device storage, then use Retry save on the summary.');}
  }
  commit(next);
 };
 const submitRef=useRef(submit);submitRef.current=submit;
 useEffect(()=>{
  if(phase!=='answering')return;
  input.current?.focus();
  const tick=()=>{const left=Math.max(0,sessionRef.current.deadline-Date.now());setRemaining(Math.ceil(left/1000));if(!left)submitRef.current(true);};
  tick();const timer=setInterval(tick,100);return()=>clearInterval(timer);
 },[phase,session?.results.length]);
 useEffect(()=>{if(phase!=='correct')return;const timer=setTimeout(advance,850);return()=>clearTimeout(timer);},[phase,session?.results.length]);
 useEffect(()=>{
  if(!sessionRef.current || phase==='summary')return;
  const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[phase]);
 const play=()=>{
  const value=sessionRef.current;
  if(!voice || !value || !['ready','answering','review'].includes(value.stage))return;
  const first=value.stage==='ready';
  const word=value.stage==='review'?value.results.at(-1).word:value.words[value.results.length].word;
  cancelSpeech.current?.();setAudioError('');
  if(first)commit({...value,stage:'speaking'});
  cancelSpeech.current=pronounceWord({word,voice,repetitions:first?2:1,
   onComplete:()=>{
    const latest=sessionRef.current;
    if(first && latest?.stage==='speaking'){locked.current=false;commit({...latest,stage:'answering',deadline:Date.now()+WORD_TIME_MS});}
   },
   onError:()=>{
    setAudioError('Audio could not start automatically. Tap the speaker to hear your word twice.');
    const latest=sessionRef.current;
    if(first && latest?.stage==='speaking')commit({...latest,stage:'ready'});
   },
  });
 };
 const playRef=useRef(play);playRef.current=play;
 useEffect(()=>{
  if(phase!=='ready' || !voice?.name || audioError)return;
  // A cancellable task prevents duplicate playback during StrictMode setup.
  const trigger=setTimeout(()=>playRef.current(),0);
  return()=>clearTimeout(trigger);
 },[phase,current?.word,voice?.name,audioError]);
 const start=()=>{const words=createSessionWords(records);if(words.length!==30){setSaveError('You know the available words. Your next review becomes available after five other completed sessions, or when new practice mistakes are added.');return;}setAnswer('');setSaveError('');locked.current=false;commit({id:`bee_${crypto.randomUUID()}`,policyVersion:2,words,results:[],stage:'ready',deadline:null});};
 const {bank,sessions,retiredWords}=summarizeActivity(records);
 const active=Object.values(bank).filter(word=>word.status==='learning');
 const checking=Object.values(bank).filter(word=>word.status==='checking');
 const header=<><div className="bee-nav"><button className="harper-back-btn" onClick={onBack}><Icon name="arrowLeft"/>Dashboard</button><span className="pill-badge pill-black">SPELLING BEE</span></div>{!getDraftScope() && <p className="insight-muted bee-guest-note" role="status">Guest mode · Your spelling scores and word bank are saved on this device.</p>}</>;
 if(!session)return <main className="content-container bee-page">{header}<div className="bee-hero"><span className="insight-eyebrow">LISTEN. SPELL. REMEMBER.</span><h1>Small words.<br/>Lasting confidence.</h1><p>A little spelling practice goes a long way. Listen to 30 words, try each spelling, and learn from the ones that catch you out.</p><button className="btn-coral-pill-physical" disabled={!voice} onClick={start}>{sessions.length?'Start a practice session':'Take your first spelling test'} <span aria-hidden="true">→</span></button>{!voice && <p role="status">An installed English voice is needed. Enable an English system voice in your device’s speech settings, then reload.</p>}</div>
 {saveError && <p role="alert">{saveError}</p>}<div className="bee-facts"><div><strong>30 words</strong><span>{sessions.length?'Your word bank + fresh words':'10 easy · 10 medium · 10 difficult'}</span></div><div><strong>10 seconds</strong><span>Per answer, after two pronunciations</span></div><div><strong>Take your time</strong><span>No timer when reviewing a mistake</span></div></div>
 <div className="bee-progress-grid"><section className="insight-panel bee-score-card"><span className="insight-eyebrow">YOUR SPELLING SCORE</span><h2 className="bee-large-score">{sessions.length?`${spellingScoreOutOf9(sessions.at(-1)).toFixed(1)}/9`:'—'}</h2><p className="insight-muted">{sessions.length?`${sessions.at(-1).results.filter(r=>r.correct).length}/30 correct · ${sessions.length} ${sessions.length===1?'session':'sessions'} completed`:'Your first test sets your starting point.'} · Separate from your IELTS band.</p>{sessions.length>0 && <button className="insight-secondary" onClick={()=>commit({...sessions.at(-1),words:[],stage:'summary'})}>View last summary →</button>}</section><section className="insight-panel"><span className="insight-eyebrow">YOUR PERSONAL WORD BANK</span>
 <h2>{active.length} to practise · {checking.length} known</h2>
 <p className="insight-muted">A correct answer within 5 seconds moves a word out of regular practice. We recheck it after five other completed sessions. Three quick, correct rechecks remove it from this word bank. A mistake or a slower correct answer brings it back to practice.</p>
 <details><summary>Words to practise</summary><ul className="bee-bank">{active.map(word=><li key={word.word}><strong>{word.word}</strong><span>{word.mistakes?`${word.mistakes} ${word.mistakes===1?'mistake':'mistakes'}`:'Building speed'}</span></li>)}</ul>{!active.length && <p className="insight-muted">No words need regular practice right now.</p>}</details>
 <details><summary>Occasional checks</summary><ul className="bee-bank">{checking.map(word=><li key={word.word}><strong>{word.word}</strong><span>{word.rechecks}/3 checks · {sessions.length>=word.reviewAfterSession?'Ready for a check':`after ${word.reviewAfterSession-sessions.length} more completed sessions`}</span></li>)}</ul>{!checking.length && <p className="insight-muted">Words you spell correctly within 5 seconds will appear here.</p>}</details>
 {retiredWords.length>0 && <p className="insight-muted">{retiredWords.length} learned {retiredWords.length===1?'word removed':'words removed'} from this bank. Past test scores are kept.</p>}
 </section></div><p className="bee-footnote">Free local spelling checks with Harper. Definitions: <a href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">Princeton WordNet 3.0</a> · <a href="/spelling/LICENSE-WordNet.txt" target="_blank" rel="noreferrer">License</a>. Syllables and origins: <a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer">English Wiktionary</a> and <a href="https://www.gutenberg.org/ebooks/29765" target="_blank" rel="noreferrer">Webster’s dictionary</a> · <a href="/spelling/structure/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Attribution</a>. No external dictionary or AI API is used.</p></main>;
 if(phase==='summary') {
  const record=records.find(r=>r.id===session.id) || session;
  const summary=sessionSummary(record,records.filter(r=>r.id!==session.id && r.completedAt<=(record.completedAt || '9999')));
  return <main className="content-container bee-page">{header}<div className="bee-summary-hero"><span className="pill-badge pill-black">SESSION COMPLETE</span><h1>Your spelling snapshot.</h1><div className="bee-summary-score"><strong>{spellingScoreOutOf9(record).toFixed(1)}<small>/9</small></strong><p>{summary.correct}/30 correct · {30-summary.correct} spelling {30-summary.correct===1?'mistake':'mistakes'} · {Math.round(summary.correct/30*100)}% accuracy<br/><span>Accuracy × 9 · Spelling score only · your IELTS band stays the same.</span></p></div><p className="bee-footnote">{summary.known.length} words moved to occasional checks · {summary.retired.length} learned words removed from the bank.</p><button className="btn-coral-pill-physical" onClick={start}>Practise another 30 →</button></div>{saveError && <p role="alert">{saveError} <button className="insight-secondary" onClick={()=>{try{saveSpellingActivity({...session,kind:'session',source:'spelling-bee',completedAt:new Date().toISOString()});setSaveError('');}catch{/* keep retry available */}}}>Retry save</button></p>}<div className="bee-summary-grid"><ResultList title="Needs a little practice" results={summary.missed} empty="No mistakes this time. Great consistency."/><ResultList title="Quick & correct" results={summary.quick} empty="Quick, correct answers will appear here."/><ResultList title="Correct · keep practising" results={summary.steady} empty="All correct answers were within 5 seconds."/><ResultList title="Getting stronger" results={summary.improving} empty="As you correct earlier mistakes, those words will appear here."/><ResultList title="Removed from your word bank" results={summary.retired} empty="Three quick, correct checks, each after five other sessions, removes a learned word."/></div><button className="insight-secondary" onClick={()=>commit(null)}>Back to Spelling Bee</button></main>;
 }
 const reviewing=phase==='review',result=session.results.at(-1);
 const reviewWord=(reviewing || phase==='correct')?session.words[session.results.length-1]:current;
 return <main className="content-container bee-page">{header}<div className="bee-session-heading"><div><span className="insight-eyebrow">{sessions.length?'PERSONAL PRACTICE':'YOUR FIRST SPELLING TEST'}</span><h1>One word at a time.</h1></div><span className="bee-counter">Word {Math.min(30,session.results.length+(reviewing || phase==='correct'?0:1))} / 30</span></div><progress className="bee-progress" value={session.results.length} max="30" aria-label="Session progress"/>
 <section className={`insight-panel bee-test ${phase==='correct'?'bee-is-correct':''}`}><div className="bee-test-top"><span className="pill-badge pill-black">{reviewWord?.difficulty || 'PERSONAL WORD'}</span><span className={`bee-timer ${remaining<=3 && phase==='answering'?'bee-timer-low':''}`} role="timer" aria-label={phase==='answering'?`${remaining} seconds remaining`:'Timer paused'}><Icon name="clock"/>{phase==='answering'?`${remaining}s`:reviewing?'No time limit':'10s per word'}</span></div>
 {phase==='correct'?<div className="bee-correct" role="status"><Icon name="check" size={40}/><h2>{result.word}</h2><p>Correct. On to the next word…</p></div>:<><div className="bee-listen"><button className="bee-speaker" data-ui-sound="off" disabled={!voice || phase==='speaking'} onClick={play} aria-label={reviewing?'Replay word':'Listen to word'}><SpeakerIcon/></button><span>{phase==='speaking'?'Listen to the word twice…':phase==='ready'?'Your word will play twice':reviewing?'Hear it again':'Listen again'}</span></div>{audioError && <p className="bee-audio-error" role="alert">{audioError}</p>}
 {reviewing?<><WordReview entry={entry} result={result} loading={notesLoading} onRetry={()=>setNotesRetry(value=>value+1)}/><div className="bee-review-actions"><p className="insight-muted">Take your time. The next word starts when you’re ready.</p><button autoFocus className="btn-coral-pill-physical" onClick={advance}>{session.results.length===30?'See my summary':'Next word'} →</button></div></>:<form onSubmit={e=>{e.preventDefault();submit();}}><label className="bee-input-label" htmlFor="bee-answer">{phase==='ready'?'Listen twice. Then type what you hear.':'Type your spelling here.'}</label><input ref={input} id="bee-answer" className="bee-answer" aria-label="Your spelling" aria-describedby="bee-input-help" placeholder={phase==='answering'?'Type the word here…':'Listen to your word…'} value={answer} onChange={e=>setAnswer(e.target.value)} disabled={phase!=='answering'} autoComplete="off" enterKeyHint="done" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={60}/><div className="bee-answer-actions"><p className="insight-muted" id="bee-input-help">Press Enter or Submit spelling. Correct answers within 5 seconds move to occasional checks.</p><button type="submit" className="btn-coral-pill-physical" disabled={phase!=='answering' || !answer.trim()}>Submit spelling →</button></div></form>}</>}
 </section>{saveError && <p role="alert">{saveError}</p>}</main>;
}
