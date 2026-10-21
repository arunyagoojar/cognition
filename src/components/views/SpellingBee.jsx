import React,{useEffect,useRef,useState} from 'react';
import Icon from '../common/Icon.jsx';
import {readDraft,writeDraft,getDraftScope} from '../../utils/drafts.js';
import {createSessionWords,gradeWord,sessionSummary,summarizeActivity,WORD_TIME_MS} from '../../utils/spelling/engine.js';
import {readSpellingActivity,saveSpellingActivity,SPELLING_EVENT} from '../../utils/spelling/store.js';
import {dictionaryEntry} from '../../utils/spelling/dictionary.js';
import './spellingBee.css';

function SpeakerIcon(){return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>;}
function WordReview({entry,result,loading,onRetry}) {
 return <div className="bee-explanation"><div className="bee-word-title"><span className="insight-eyebrow">{result.timedOut?'TIME’S UP':'LET’S REMEMBER THIS ONE'}</span><h2>{result.word}</h2><p>{result.answer?<>You wrote <strong>{result.answer}</strong>.</>:'No answer submitted.'}</p></div>
 {entry?<><div className="bee-chunks" aria-label="Spelling chunks">{entry.chunks.map((part,i)=><span key={i}>{part}</span>)}</div><div className="bee-note-grid"><div><h3>Meaning</h3><p>{entry.meaning}</p></div><div><h3>Example / practice</h3><p>{entry.example}</p></div><div><h3>Remember it</h3><p>{entry.hint}</p></div><div><h3>Origin / Greek roots</h3><p>{entry.origin}</p></div></div><p className="bee-footnote">Spelling chunks help you remember letters; they are not phonetic syllables. {entry.source || 'Cognition teaching notes'}.</p></>:loading?<p role="status">Loading word notes…</p>:<div><p>Dictionary notes could not load. Remember these letter groups: {result.word.match(/.{1,3}/g).join(' · ')}.</p><button type="button" className="insight-secondary" onClick={onRetry}>Retry word notes</button></div>}
 </div>;
}
function ResultList({title,results,empty}) {return <section className="insight-panel bee-result-list"><h2>{title} <span>{results.length}</span></h2>{results.length?<ul>{results.map(r=><li key={r.word}><strong>{r.word}</strong><span>{r.correct?(r.confidence==='confident'?'Confident':'Correct · unsure'):(r.timedOut?'Time ran out':r.answer || 'No answer')}</span></li>)}</ul>:<p className="insight-muted">{empty}</p>}</section>;}

export default function SpellingBee({onBack}) {
 const [records,setRecords]=useState(readSpellingActivity);
 const [session,setSession]=useState(()=>readDraft('spelling-bee'));
 const [answer,setAnswer]=useState(''),[confidence,setConfidence]=useState('unsure'),[remaining,setRemaining]=useState(10),[entry,setEntry]=useState(null),[audioError,setAudioError]=useState(''),[saveError,setSaveError]=useState('');
 const [notesLoading,setNotesLoading]=useState(false),[notesRetry,setNotesRetry]=useState(0);
 const [voices,setVoices]=useState([]);
 const sessionRef=useRef(session),input=useRef(null),utterance=useRef(null),speechWatchdog=useRef(null),locked=useRef(false);
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
  return()=>{window.removeEventListener(SPELLING_EVENT,update);window.removeEventListener('storage',update);speech?.removeEventListener('voiceschanged',load);clearTimeout(speechWatchdog.current);speech?.cancel();};
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
  window.speechSynthesis?.cancel();clearTimeout(speechWatchdog.current);
  setAnswer('');setConfidence('unsure');setAudioError('');setEntry(null);locked.current=false;
  if(value.results.length===30){commit({...value,stage:'summary',deadline:null});return;}
  commit({...value,stage:'ready',deadline:null});setRemaining(10);
 };
 const submit=(timedOut=false)=>{
  const value=sessionRef.current;
  if(locked.current || value?.stage!=='answering')return;
  locked.current=true;
  const expired=timedOut || Date.now()>=value.deadline;
  const result=gradeWord(value.words[value.results.length].word,answer,confidence,expired);
  const next={...value,results:[...value.results,result],stage:result.correct?'correct':'review',deadline:null};
  // The current review uses the last result; the next word is never exposed.
  if(next.results.length===30) {
   try {saveSpellingActivity({id:next.id,kind:'session',source:'spelling-bee',completedAt:new Date().toISOString(),results:next.results});}
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
  const review=value.stage==='review';
  const word=review?value.results.at(-1).word:value.words[value.results.length].word;
  const first=value.stage==='ready';
  clearTimeout(speechWatchdog.current);window.speechSynthesis.cancel();setAudioError('');
  if(first)commit({...value,stage:'speaking'});
  const speech=new SpeechSynthesisUtterance(word);utterance.current=speech;speech.voice=voice;speech.lang=voice.lang;speech.rate=.85;
  let finished=false;
  const finish=error=>{
   if(finished || utterance.current!==speech)return;finished=true;clearTimeout(speechWatchdog.current);
   const latest=sessionRef.current;
   if(error){setAudioError('Audio could not play. Check your sound settings and try again.');if(first && latest?.stage==='speaking')commit({...latest,stage:'ready'});return;}
   if(first && latest?.stage==='speaking'){locked.current=false;commit({...latest,stage:'answering',deadline:Date.now()+WORD_TIME_MS});}
  };
  speech.onend=()=>finish(false);speech.onerror=()=>finish(true);
  speechWatchdog.current=setTimeout(()=>finish(true),10000);
  try {window.speechSynthesis.speak(speech);}catch{finish(true);}
 };
 const start=()=>{setAnswer('');setConfidence('unsure');setSaveError('');locked.current=false;commit({id:`bee_${crypto.randomUUID()}`,words:createSessionWords(records),results:[],stage:'ready',deadline:null});};
 const {bank,sessions}=summarizeActivity(records);
 const active=Object.values(bank).filter(w=>w.status!=='fixed' && w.mistakes),fixed=Object.values(bank).filter(w=>w.status==='fixed');
 const header=<><div className="bee-nav"><button className="harper-back-btn" onClick={onBack}><Icon name="arrowLeft"/>Dashboard</button><span className="pill-badge pill-black">SPELLING BEE</span></div>{!getDraftScope() && <p className="insight-muted bee-guest-note" role="status">Guest mode · Your spelling scores and word bank are saved on this device.</p>}</>;
 if(!session)return <main className="content-container bee-page">{header}<div className="bee-hero"><span className="insight-eyebrow">LISTEN. SPELL. REMEMBER.</span><h1>Small words.<br/>Lasting confidence.</h1><p>A little spelling practice goes a long way. Listen to 30 words, try each spelling, and learn from the ones that catch you out.</p><button className="btn-coral-pill-physical" disabled={!voice} onClick={start}>{sessions.length?'Start a practice session':'Take your first spelling test'} <span aria-hidden="true">→</span></button>{!voice && <p role="status">An installed English voice is needed. Enable an English system voice in your device’s speech settings, then reload.</p>}</div>
 <div className="bee-facts"><div><strong>30 words</strong><span>{sessions.length?'Your word bank + fresh words':'10 easy · 10 medium · 10 difficult'}</span></div><div><strong>10 seconds</strong><span>Per answer, after the word is spoken</span></div><div><strong>Take your time</strong><span>No timer when reviewing a mistake</span></div></div>
 <div className="bee-progress-grid"><section className="insight-panel"><span className="insight-eyebrow">YOUR SPELLING SCORE</span><h2 className="bee-large-score">{sessions.length?`${sessions.at(-1).results.filter(r=>r.correct).length}/30`:'—'}</h2><p className="insight-muted">{sessions.length?`${sessions.length} sessions completed · latest score`:'Your first test sets your starting point.'} · Separate from your IELTS band.</p>{sessions.length>0 && <button className="insight-secondary" onClick={()=>commit({...sessions.at(-1),words:[],stage:'summary'})}>View last summary →</button>}</section><section className="insight-panel"><span className="insight-eyebrow">YOUR PERSONAL WORD BANK</span><h2>{active.length} to practise · {fixed.length} fixed</h2><p className="insight-muted">Spelling mistakes from writing, reading and listening join your rotation. Five correct attempts in a row move a word to Successfully fixed.</p><details><summary>Words to practise</summary><ul className="bee-bank">{active.map(w=><li key={w.word}><strong>{w.word}</strong><span>{w.streak}/5 correct in a row · {w.mistakes} {w.mistakes===1?'mistake':'mistakes'}</span></li>)}</ul>{!active.length && <p className="insight-muted">Your words will appear here after practice.</p>}</details><details><summary>Successfully fixed</summary><ul className="bee-bank">{fixed.map(w=><li key={w.word}><strong>{w.word}</strong><span>{w.streak} correct in a row</span></li>)}</ul>{!fixed.length && <p className="insight-muted">Keep practising to move words here.</p>}</details></section></div><p className="bee-footnote">Free local spelling checks with Harper. Definitions: <a href="https://wordnet.princeton.edu/" target="_blank" rel="noreferrer">Princeton WordNet 3.0</a> · <a href="/spelling/LICENSE-WordNet.txt" target="_blank" rel="noreferrer">License</a>. No external dictionary or AI API is used.</p></main>;
 if(phase==='summary') {
  const record=records.find(r=>r.id===session.id) || session;
  const summary=sessionSummary(record,records.filter(r=>r.id!==session.id && r.completedAt<=(record.completedAt || '9999')));
  return <main className="content-container bee-page">{header}<div className="bee-summary-hero"><span className="pill-badge pill-black">SESSION COMPLETE</span><h1>Your spelling snapshot.</h1><div className="bee-summary-score"><strong>{summary.correct}<small>/30</small></strong><p>{30-summary.correct} spelling {30-summary.correct===1?'mistake':'mistakes'} · {Math.round(summary.correct/30*100)}% accuracy<br/><span>Spelling score only · your overall band stays the same.</span></p></div><button className="btn-coral-pill-physical" onClick={start}>Practise another 30 →</button></div>{saveError && <p role="alert">{saveError} <button className="insight-secondary" onClick={()=>{try{saveSpellingActivity({...session,kind:'session',source:'spelling-bee',completedAt:new Date().toISOString()});setSaveError('');}catch{/* keep retry available */}}}>Retry save</button></p>}<div className="bee-summary-grid"><ResultList title="Needs a little practice" results={summary.missed} empty="No mistakes this time. Great consistency."/><ResultList title="Feeling confident" results={summary.confident} empty="Choose Confident when you feel sure of your spelling."/><ResultList title="Correct, but unsure" results={summary.unsure} empty="No unsure correct answers this session."/><ResultList title="Getting stronger" results={summary.improving} empty="As you correct earlier mistakes, those words will appear here."/><ResultList title="Successfully fixed" results={summary.fixed} empty="Five correct attempts in a row moves a word here."/></div><button className="insight-secondary" onClick={()=>commit(null)}>Back to Spelling Bee</button></main>;
 }
 const reviewing=phase==='review',result=session.results.at(-1);
 const reviewWord=(reviewing || phase==='correct')?session.words[session.results.length-1]:current;
 return <main className="content-container bee-page">{header}<div className="bee-session-heading"><div><span className="insight-eyebrow">{sessions.length?'PERSONAL PRACTICE':'YOUR FIRST SPELLING TEST'}</span><h1>One word at a time.</h1></div><span className="bee-counter">Word {Math.min(30,session.results.length+(reviewing || phase==='correct'?0:1))} / 30</span></div><progress className="bee-progress" value={session.results.length} max="30" aria-label="Session progress"/>
 <section className={`insight-panel bee-test ${phase==='correct'?'bee-is-correct':''}`}><div className="bee-test-top"><span className="pill-badge pill-black">{reviewWord?.difficulty || 'PERSONAL WORD'}</span><span className={`bee-timer ${remaining<=3 && phase==='answering'?'bee-timer-low':''}`} role="timer" aria-label={phase==='answering'?`${remaining} seconds remaining`:'Timer paused'}><Icon name="clock"/>{phase==='answering'?`${remaining}s`:reviewing?'No time limit':'10s per word'}</span></div>
 {phase==='correct'?<div className="bee-correct" role="status"><Icon name="check" size={40}/><h2>{result.word}</h2><p>Correct. On to the next word…</p></div>:<><div className="bee-listen"><button className="bee-speaker" disabled={!voice || phase==='speaking'} onClick={play} aria-label={reviewing?'Replay word':'Listen to word'}><SpeakerIcon/></button><span>{phase==='speaking'?'Listen…':phase==='ready'?'Tap to hear your word':reviewing?'Hear it again':'Listen again'}</span></div>{audioError && <p className="bee-audio-error" role="alert">{audioError}</p>}
 {reviewing?<><WordReview entry={entry} result={result} loading={notesLoading} onRetry={()=>setNotesRetry(value=>value+1)}/><div className="bee-review-actions"><p className="insight-muted">Take your time. The next word starts when you’re ready.</p><button autoFocus className="btn-coral-pill-physical" onClick={advance}>{session.results.length===30?'See my summary':'Next word'} →</button></div></>:<form onSubmit={e=>{e.preventDefault();submit();}}><label className="bee-input-label" htmlFor="bee-answer">{phase==='ready'?'Listen first. Then type what you hear.':'Type the word you heard.'}</label><input ref={input} id="bee-answer" className="bee-answer" aria-label="Your spelling" value={answer} onChange={e=>setAnswer(e.target.value)} disabled={phase!=='answering'} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={60}/><div className="bee-answer-actions"><fieldset disabled={phase!=='answering'}><legend>How do you feel?</legend>{['unsure','confident'].map(value=><button type="button" key={value} aria-pressed={confidence===value} onClick={()=>setConfidence(value)}>{value==='unsure'?'Unsure':'Confident'}</button>)}</fieldset><button type="submit" className="btn-coral-pill-physical" disabled={phase!=='answering' || !answer.trim()}>Check spelling →</button></div><p className="bee-footnote">Choose Unsure or Confident before submitting. Replaying keeps the same 10-second limit.</p></form>}</>}
 </section>{saveError && <p role="alert">{saveError}</p>}</main>;
}
