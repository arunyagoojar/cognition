import { useState, useRef, useEffect, useMemo, useDeferredValue, memo, useCallback } from 'react';
import { CONTENT_CATALOG } from '../../data/production/registry.js';
import { chooseFreshTest } from '../../utils/practiceSelection.js';
import { readDraft, writeDraft } from '../../utils/drafts.js';
import { getProductionWritingTest } from '../../data/production/adapters.js';
import { createHarperSession, applyHarperFix } from '../../utils/harper/harperService.js';
import { analyzeRepetition, SYNONYM_NOTES, replaceRepeatedWord } from '../../utils/harper/repetitionService.js';
import { editorSegments, repeatColor } from '../../utils/harper/editorHighlights.js';
import { WritingReview } from './WritingCoach.jsx';
import { submitWritingCoaching } from '../../utils/harper/writingSubmission.js';
import { createAttemptId } from '../../utils/performanceStore.js';
import { WritingHelp, MistakeExplanation } from './WritingHelp.jsx';
import './writingPractice.css';
import Icon from '../common/Icon.jsx';
import ScrollToTop from '../common/ScrollToTop.jsx';
const countWords=text=>text.trim().split(/\s+/).filter(Boolean).length;
const emptyLint={issues:[],errorFreeSentences:0,totalSentences:0};

const WritingQuestion=memo(function WritingQuestion({activeTask,taskKind,target}) {
 return <section className="harper-pinned-prompt-card"><div className="harper-prompt-header-row"><span className="harper-prompt-badge">YOUR QUESTION · {target} WORDS</span></div><div className="harper-prompt-body"><div className="harper-prompt-text">{activeTask.promptHtml?<div dangerouslySetInnerHTML={{__html:activeTask.promptHtml}}/>:activeTask.prompt || activeTask.instructions}</div>{taskKind===1 && activeTask.image?.file && <a href={activeTask.image.file} target="_blank" rel="noreferrer" className="harper-prompt-image-wrap"><img className="harper-prompt-image" src={activeTask.image.file} alt="Task 1 chart. Open to enlarge."/></a>}{taskKind===1 && activeTask.table?.rows && <div className="harper-prompt-table-wrap"><table className="harper-prompt-table"><tbody>{activeTask.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>i===0?<th key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}</div></section>;
});

export default function HarperWritingPractice({onBack}) {
 const [saved]=useState(()=>readDraft('harper'));
 const [stage,setStage]=useState(()=>saved?.stage==='summary' && (saved?.review || saved?.summary) ? 'summary':saved?.essayText?'practice':'choice');
 const [taskKind,setTaskKind]=useState(()=>saved?.taskKind || 2),[currentTask,setCurrentTask]=useState(()=>saved?.currentTask || null),[essayText,setEssayText]=useState(()=>saved?.essayText || '');
 const [layout,setLayout]=useState(()=>{try{return ['default','question','help'].includes(sessionStorage.getItem('writing-help-layout'))?sessionStorage.getItem('writing-help-layout'):'default';}catch{return 'default';}}),[tab,setTab]=useState(null);
 const [resourcesOpen,setResourcesOpen]=useState(false),[repeatSelection,setRepeatSelection]=useState(null),[synonymUndo,setSynonymUndo]=useState(null);
 const [ignoredWords,setIgnoredWords]=useState(()=>saved?.ignoredWords || []);
 const deferredText=useDeferredValue(essayText);
 const closeResources=useCallback(()=>setResourcesOpen(false),[]);
 const checker=useRef(null),draft=useRef(null);
 const [lint,setLint]=useState(emptyLint),[analyzedText,setAnalyzedText]=useState(''),[checking,setChecking]=useState(false),[lintError,setLintError]=useState('');
 const [summary,setSummary]=useState(()=>saved?.summary || null),[review,setReview]=useState(()=>saved?.review || null),[busy,setBusy]=useState(false),[reviewError,setReviewError]=useState('');
 const editor=useRef(null),mirror=useRef(null),revision=useRef(0),mounted=useRef(true),locked=useRef(false),submission=useRef(saved?.submission || null);
 const activeTask=currentTask?.[taskKind===1?'task1':'task2'] || {};
 const target=taskKind===1?150:250,wordCount=countWords(essayText);
 const repetition=useMemo(()=>analyzeRepetition(deferredText,ignoredWords),[deferredText,ignoredWords]);
 const currentIssues=useMemo(()=>analyzedText===essayText?lint.issues:[],[analyzedText,essayText,lint]);
 const feedbackTab=tab || (currentIssues.length?'grammar':repetition.repetitiveWords.length?'repetition':'grammar');
 const segments=useMemo(()=>editorSegments(essayText,currentIssues,deferredText===essayText?repetition.repetitiveWords:[]),[essayText,currentIssues,repetition,deferredText]);
 useEffect(()=>{
  mounted.current=true;const session=createHarperSession();checker.current=session;
  const flush=()=>{if(draft.current)writeDraft('harper',draft.current);};
  window.addEventListener('pagehide',flush);
  const close=()=>{mounted.current=false;revision.current++;void session.dispose();flush();window.removeEventListener('pagehide',flush);};
  return close;
 },[]);
 useEffect(()=>{try{sessionStorage.setItem('writing-help-layout',layout);}catch{/* Storage may be disabled. */}},[layout]);
 useEffect(()=>{
  draft.current=currentTask?{stage,taskKind,currentTask,essayText,summary,review,ignoredWords,submission:submission.current}:null;
  const timer=setTimeout(()=>{if(draft.current)writeDraft('harper',draft.current);},600);
  return()=>clearTimeout(timer);
 },[stage,taskKind,currentTask,essayText,summary,review,ignoredWords]);
 useEffect(()=>{if(stage==='practice')void checker.current.getLinter().catch(()=>{});},[stage]);
 useEffect(()=>{
  if(stage!=='practice') return;
  const version=++revision.current;
  const timer=setTimeout(async()=>{
    if(!essayText.trim()){setLint(emptyLint);setAnalyzedText(essayText);setChecking(false);setLintError('');return;}
    setChecking(true);setLintError('');
    try {const result=await checker.current.lint(essayText);if(mounted.current && version===revision.current){setLint(result);setAnalyzedText(essayText);}}
    catch {if(mounted.current && version===revision.current)setLintError('Local grammar checks are unavailable. Your draft is saved.');}
    finally {if(mounted.current && version===revision.current)setChecking(false);}
  },650);
  const cancel=()=>{clearTimeout(timer);revision.current++;};
  return cancel;
 },[essayText,stage]);
 useEffect(()=>{
  const node=editor.current,background=mirror.current;
  if(stage!=='practice' || !node || !background || typeof ResizeObserver==='undefined')return;
  const resize=()=>{background.style.width=`${node.clientWidth}px`;background.style.height=`${node.clientHeight}px`;background.scrollTop=node.scrollTop;};
  const observer=new ResizeObserver(resize);observer.observe(node);resize();
  return()=>observer.disconnect();
 },[stage]);
 const loadTask=kind=>{
  const id=chooseFreshTest(`harper-task-${kind}`,CONTENT_CATALOG.writing);
  setTab(null);setRepeatSelection(null);setSynonymUndo(null);setIgnoredWords([]);setTaskKind(kind);setCurrentTask(getProductionWritingTest(id));setEssayText('');setReview(null);setSummary(null);setLint(emptyLint);setAnalyzedText('');setStage('practice');submission.current=null;
 };
 const changeText=value=>{revision.current++;setEssayText(value);setRepeatSelection(null);setSynonymUndo(null);};
 const selectRepeatedWord=event=>{
  if(deferredText!==essayText)return;
  const {selectionStart:start,selectionEnd:end}=event.currentTarget;
  for(const word of repetition.repetitiveWords) {
   const occurrence=word.occurrences.find(range=>start>=range.start && end<=range.end);
   if(occurrence){setRepeatSelection({word:word.word,...occurrence});setTab('repetition');return;}
  }
 };
 const chooseSynonym=(word,alternative)=>{
  if(deferredText!==essayText)return;
  const occurrence=repeatSelection?.word===word.word?repeatSelection:word.occurrences[0];
  const replacement=replaceRepeatedWord(essayText,word.word,occurrence,alternative);
  if(!replacement)return;
  const before=essayText;changeText(replacement.text);setSynonymUndo({before,after:replacement.text,word:word.word,alternative});
  requestAnimationFrame(()=>{editor.current?.focus();editor.current?.setSelectionRange(replacement.start,replacement.end);});
 };
 const locate=range=>{editor.current?.focus();editor.current?.setSelectionRange(range.start,range.end);};
 const fix=(issue,replacement)=>{
  if(analyzedText!==essayText || essayText.slice(issue.start,issue.end)!==issue.snippet)return;
  changeText(applyHarperFix(essayText,issue,replacement));
  editor.current?.focus();
 };
 const finish=async()=>{
  if(locked.current || !essayText.trim())return;
  locked.current=true;setBusy(true);setReviewError('');setReview(null);setStage('summary');revision.current++;
  const text=essayText,kind=taskKind,task=activeTask;
  const finalRepetition=analyzeRepetition(text,ignoredWords);
  if(submission.current?.text!==text || submission.current?.testId!==currentTask?.testId)submission.current={id:createAttemptId('writing_coach'),text,testId:currentTask?.testId};
  try {
   let local;
   try {const h=await checker.current.lint(text);local={wordCount:countWords(text),targetWords:target,issueCount:h.issues.length,totalSentences:h.totalSentences,errorFreeSentences:h.errorFreeSentences,errorCount:h.errorCount,warningCount:h.warningCount,issues:h.issues,repeatedWords:finalRepetition.repetitiveWords.map(w=>({word:w.word,count:w.count}))};if(mounted.current){setLint(h);setAnalyzedText(text);}}
   catch {local={wordCount:countWords(text),targetWords:target,unavailable:true,repeatedWords:finalRepetition.repetitiveWords.map(w=>({word:w.word,count:w.count}))};}
   if(!mounted.current)return;
   setSummary(local);
   const result=await submitWritingCoaching({text,task,taskKind:kind,testId:currentTask?.testId,localDiagnostics:local,id:submission.current.id});
   if(!mounted.current)return;
   if(result.status==='completed')setReview(result.evaluation);
   else setReviewError(result.message || 'Connect your AI provider in Settings, then retry the assessment.');
  }catch {if(mounted.current)setReviewError('The assessment could not finish. Check your connection or AI settings, then retry.');}
  finally {locked.current=false;if(mounted.current){setBusy(false);setChecking(false);}}
 };

 if(stage==='choice')return <div className="content-container harper-choice-hero"><ScrollToTop/><div className="harper-header-nav"><button className="harper-back-btn" onClick={onBack}><Icon name="arrowLeft"/>Dashboard</button><span className="pill-badge pill-black">WRITING HELP</span></div><div className="harper-choice-title-block"><h1 className="harper-main-heading">Write. Notice. Improve.</h1><p className="harper-main-sub">Live grammar and vocabulary support. A complete AI assessment when you finish.</p></div><div className="harper-task-grid">{[1,2].map(kind=><article className={`harper-task-card is-task${kind}`} key={kind}><div className="harper-task-card-header"><span className="harper-task-tag">TASK {kind}</span><span className="harper-task-time">{kind===1?'20 min · 150 words':'40 min · 250 words'}</span></div><h2 className="harper-task-card-title">{kind===1?'Academic report':'Discursive essay'}</h2><p className="harper-task-card-desc">{kind===1?'Describe the key features, comparisons, and trends in a visual.':'Develop a clear position with relevant ideas and supporting examples.'}</p><button className="btn-coral-pill-physical" onClick={()=>loadTask(kind)}>Practise Task {kind} <span aria-hidden="true">→</span></button></article>)}</div><p className="harper-choice-footer-note">Grammar checks run locally as you write. Finish & Summary sends your response and question to your configured AI provider. Coaching stays separate from your overall band.</p></div>;

 if(stage==='summary')return <div className="content-container harper-summary-screen"><ScrollToTop/><div className="harper-header-nav"><button className="harper-back-btn" disabled={busy} onClick={()=>setStage('practice')}><Icon name="arrowLeft"/>Revise draft</button><button className="harper-exit-btn" onClick={onBack}>Dashboard</button></div><div className="insight-page-title"><div><span className="insight-eyebrow">WRITING HELP</span><h1>Task {taskKind} writing summary</h1></div><span className="pill-badge pill-black">COACHING</span></div>
  <div className="harper-summary-metrics"><div><strong>{wordCount}</strong><span>words / {target} minimum</span><progress value={Math.min(wordCount,target)} max={target} aria-label="Word count progress"/></div><div><strong>{summary?.unavailable?'—':summary?.issueCount ?? '…'}</strong><span>local issues flagged</span></div><div><strong>{summary?.unavailable?'—':`${summary?.errorFreeSentences ?? 0}/${summary?.totalSentences ?? 0}`}</strong><span>sentences without flags</span></div><div><strong>{repetition.repetitiveWords.length}</strong><span>repeated content words</span></div></div>
  {summary?.issues?.length>0 && <section className="writing-mistakes" aria-label="Explain my mistakes"><h2>Explain My Mistake</h2><p>{summary.errorCount ?? 0} errors · {summary.warningCount ?? 0} warnings</p>{summary.issues.map((issue,i)=><MistakeExplanation key={issue.id || i} issue={issue} explain={rule=>checker.current.explain(rule)}/>)}</section>}
  <WritingReview review={review} busy={busy} error={reviewError} localDiagnostics={summary} onRetry={finish}/>
  {!busy && <div className="harper-summary-actions"><button className="harper-action-btn is-secondary" onClick={()=>setStage('practice')}>Revise draft</button><button className="harper-action-btn is-primary" onClick={()=>{setStage('choice');setEssayText('');setCurrentTask(null);writeDraft('harper',{});}}>Practise another task</button></div>}
 </div>;

 return <div className="harper-workspace-layout"><ScrollToTop/>
  <header className="harper-nav-header"><div className="harper-nav-left"><button className="harper-nav-back" onClick={onBack}><Icon name="arrowLeft"/>Dashboard</button><div className="harper-nav-title-group"><span className="harper-nav-badge">WRITING HELP · TASK {taskKind}</span><h1 className="harper-nav-title">{taskKind===1?'Academic report':'Discursive essay'}</h1></div></div><div className="writing-layout-controls" role="group" aria-label="Workspace layout">{[['default','All panels'],['question','Expand question'],['help','Hide question']].map(([value,label])=><button key={value} type="button" aria-pressed={layout===value} onClick={()=>setLayout(value)}>{label}</button>)}</div><div className="harper-nav-right"><button type="button" className="writing-resource-trigger" aria-haspopup="dialog" onClick={()=>setResourcesOpen(true)}>Suggestions</button><button className="harper-prompt-random-btn" onClick={()=>{if(!essayText || window.confirm('Start a new prompt? This replaces your current draft.'))loadTask(taskKind);}}>New prompt</button><button className="harper-finish-btn" disabled={!wordCount || busy} onClick={finish}>Finish & Summary <span aria-hidden="true">→</span></button></div></header>

  <div className={`harper-split-panes writing-panels layout-${layout}`}>
  <div className="harper-pinned-prompt-container writing-question-panel" inert={layout==='help'} aria-hidden={layout==='help'}><WritingQuestion activeTask={activeTask} taskKind={taskKind} target={target}/></div>
  <section className="harper-pane-editor"><div className="harper-editor-toolbar"><div className="harper-word-count-chip"><span>Words</span><strong>{wordCount} / {target}</strong>{wordCount>=target && <Icon name="check"/>}</div><div className="writing-editor-actions"><span className="insight-muted">{lintError?'Checks unavailable':checking || (essayText && analyzedText!==essayText)?'Checking…':'Saved draft'}</span></div></div>
    <div className="harper-editor-legend" id="editor-markings"><span className="grammar-legend">Wavy: grammar · dotted: spelling</span><span className="repeat-legend">Tint + line: repetition</span></div>
    <div className="harper-highlight-editor"><div className="harper-editor-mirror" ref={mirror} aria-hidden="true">{segments.map(s=><mark key={s.start} className={[s.issue?'has-grammar-issue':'',s.issue?.type==='spelling'?'has-spelling-issue':'',s.repeat?'has-repeat-issue':''].join(' ')} style={{backgroundColor:s.repeat?.color || 'transparent'}}>{s.text}</mark>)}{'\n'}</div><textarea ref={editor} className="harper-textarea-canvas" aria-label={`Writing Task ${taskKind} response`} aria-describedby="editor-markings submission-note" value={essayText} onSelect={selectRepeatedWord} onClick={selectRepeatedWord} onChange={e=>changeText(e.target.value)} onScroll={e=>{if(mirror.current){mirror.current.scrollTop=e.target.scrollTop;mirror.current.scrollLeft=e.target.scrollLeft;}}} placeholder="Start your response here…" spellCheck={false}/></div>
    <p className="editor-submission-note" id="submission-note">Finish & Summary includes AI assessment of your response and question.</p>
  </section>
  <aside className="harper-pane-sidebar" aria-label="Live writing support" inert={layout==='question'} aria-hidden={layout==='question'}><div className="writing-feedback-frame"><header className="writing-feedback-header"><h2>Writing feedback</h2><p>Small changes. Clearer writing.</p></header><div className="writing-feedback-summary">
    <div className="harper-live-stats"><div><strong>{essayText && analyzedText===essayText?currentIssues.length:'—'}</strong><span>issues flagged</span></div><div><strong>{essayText && analyzedText===essayText?`${lint.errorFreeSentences}/${lint.totalSentences}`:'—'}</strong><span>sentences without flags</span></div></div>
    <p className="writing-severity-counts">{analyzedText===essayText?`${lint.errorCount || 0} errors · ${lint.warningCount || 0} warnings`:'Counts update after checking'}</p></div><div className="harper-sidebar-tabs" aria-label="Live feedback"><button type="button" aria-pressed={feedbackTab==='grammar'} className={`harper-tab-btn ${feedbackTab==='grammar'?'is-active':''}`} onClick={()=>setTab('grammar')}>Grammar · {analyzedText===essayText?currentIssues.length:'…'}</button><button type="button" aria-pressed={feedbackTab==='repetition'} className={`harper-tab-btn ${feedbackTab==='repetition'?'is-active':''}`} onClick={()=>setTab('repetition')}>Repetition · {repetition.repetitiveWords.length}</button></div>
    <div className="harper-tab-content">{synonymUndo && essayText===synonymUndo.after && <div className="writing-synonym-undo" role="status"><span>Replaced “{synonymUndo.word}” with “{synonymUndo.alternative}”.</span><button type="button" onClick={()=>changeText(synonymUndo.before)}>Undo</button></div>}{lintError && <p role="alert">{lintError}</p>}{feedbackTab==='grammar'?(currentIssues.length?<div className="harper-issues-list">{currentIssues.map(issue=><article className="harper-issue-card" key={issue.id}><div className="harper-issue-top"><span className="harper-issue-badge">{issue.severity} · {issue.category}</span><button type="button" className="insight-text-button" onClick={()=>locate(issue)}>Find in draft ↗</button></div><p className="harper-issue-snippet">“{issue.snippet}”</p><p className="harper-issue-msg">{issue.message}</p><div className="harper-suggestions-row">{issue.suggestions.slice(0,3).map((s,i)=><button key={i} className="harper-apply-fix-btn" onClick={()=>fix(issue,s.replace)}>Use “{s.replace || 'remove'}”</button>)}</div></article>)}</div>:<div className="harper-empty-state"><Icon name="check" size={24}/><h3>{checking || (essayText && analyzedText!==essayText)?'Checking your draft…':'No local issues flagged'}</h3><p>{essayText?'Local checks identify patterns, not every possible grammar error.':'Start writing to see underlines and suggested fixes.'}</p></div>):<div className="harper-repetition-panel"><p className="insight-muted">Choose a synonym to replace one occurrence.</p>{repetition.repetitiveWords.map(word=><article key={word.word} className="harper-issue-card"><div className="harper-issue-top"><strong style={{background:repeatColor(word.word,repetition.repetitiveWords),color:'#151313'}}>{word.word} · {word.count} occurrences</strong><button onClick={()=>setIgnoredWords(words=>[...words,word.word])}>Ignore word</button></div>{word.synonyms.length?<div className="writing-synonyms" role="group" aria-label={`Synonyms for ${word.word}`}>{word.synonyms.map(alternative=><button type="button" key={alternative} onClick={()=>chooseSynonym(word,alternative)} disabled={deferredText!==essayText} title={SYNONYM_NOTES[alternative] || `Replace one occurrence of “${word.word}”`} aria-label={`Replace ${word.word} with ${alternative}`}>{alternative}</button>)}</div>:<p className="insight-muted">No reliable local synonyms for this word. Consider rephrasing the sentence.</p>}{word.synonyms.some(s=>SYNONYM_NOTES[s]) && <details className="writing-synonym-notes"><summary>Meaning & use</summary>{word.synonyms.filter(s=>SYNONYM_NOTES[s]).map(s=><p className="insight-muted" key={s}><strong>{s}:</strong> {SYNONYM_NOTES[s]}.</p>)}</details>}</article>)}{!repetition.repetitiveWords.length && <p className="insight-muted">Repeated content words will appear here.</p>}{ignoredWords.length>0 && <details><summary>Ignored words · {ignoredWords.length}</summary>{ignoredWords.map(word=><button key={word} onClick={()=>setIgnoredWords(words=>words.filter(w=>w!==word))}>Restore {word}</button>)}</details>}</div>}</div>
  </div></aside></div>
  <WritingHelp key={`${currentTask?.testId}-${taskKind}`} text={resourcesOpen?deferredText:''} prompt={activeTask.prompt || activeTask.instructions} taskKind={taskKind} open={resourcesOpen} onClose={closeResources}/>
 </div>;
}
