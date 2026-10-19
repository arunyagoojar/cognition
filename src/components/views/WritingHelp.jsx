import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { suggestVocabulary } from '../../utils/harper/vocabularyCoach.js';
import { topicWords, wordUsed } from '../../utils/harper/topicVocabulary.js';
import { phraseCategories, phrasesFor } from '../../utils/harper/phraseBank.js';

export const WritingHelp = memo(function WritingHelp({text, prompt, taskKind, open, onClose}) {
 const dialog=useRef(null);
 useEffect(()=>{
  const node=dialog.current;
  if(!open || !node)return;
  const previous=document.activeElement,overflow=document.body.style.overflow;
  node.showModal();document.body.style.overflow='hidden';
  return()=>{node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[open]);
 const [tab,setTab]=useState('vocabulary'), [rotation,setRotation]=useState(0);
 const [taskOverride,setTaskOverride]=useState('auto'), [category,setCategory]=useState('Introduction');
 const [copyStatus,setCopyStatus]=useState('');
 const phraseTask=taskOverride==='auto'?taskKind:Number(taskOverride);
 const categories=phraseCategories(phraseTask), activeCategory=categories.includes(category)?category:'Introduction';
 const words=useMemo(()=>topicWords(prompt,taskKind,rotation),[prompt,taskKind,rotation]);
 const suggestions=useMemo(()=>open?suggestVocabulary(text,6):[],[text,open]);
 const copy=async phrase=>{
  try {await navigator.clipboard.writeText(phrase);setCopyStatus(`Copied: ${phrase}`);}
  catch {setCopyStatus('Copy is unavailable. Select the phrase text and copy it manually.');}
 };
 return <dialog ref={dialog} className="writing-resource-dialog writing-help" aria-labelledby="live-vocabulary-title" aria-describedby="writing-resource-description" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
  const bounds=event.currentTarget.getBoundingClientRect();
  if(event.target===event.currentTarget && (event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom))onClose();
 }}>
  <header className="writing-resource-header"><div><span className="writing-resource-eyebrow">QUICK REFERENCE · TASK {taskKind}</span><h2 id="live-vocabulary-title">Words to Try</h2><p id="writing-resource-description">A little inspiration, then back to your writing.</p></div><button type="button" className="writing-resource-close" onClick={onClose} aria-label="Close Words to Try">Close <span aria-hidden="true">×</span></button></header>
  <div className="harper-sidebar-tabs" role="tablist" aria-label="Writing resources" onKeyDown={e=>{
   if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {e.preventDefault();const next=e.key==='Home'?'vocabulary':e.key==='End'?'phrases':tab==='vocabulary'?'phrases':'vocabulary';setTab(next);document.getElementById(`resource-tab-${next}`)?.focus();}
  }}>{[['vocabulary','Vocabulary'],['phrases','Phrase Bank']].map(([id,label])=><button key={id} id={`resource-tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`resource-panel-${id}`} tabIndex={tab===id?0:-1} className={`harper-tab-btn ${tab===id?'is-active':''}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
  <div className="writing-resource-scroll">
  <div id="resource-panel-vocabulary" role="tabpanel" aria-labelledby="resource-tab-vocabulary" hidden={tab!=='vocabulary'}>
   <div className="writing-resource-heading"><span className="live-caption">10 words · {words[0].topic}</span><button type="button" onClick={()=>setRotation(r=>r+1)}>Refresh words</button></div>
   <p className="insight-muted">Choose words that fit your meaning. Tap a word for an example.</p>
   <div className="live-vocabulary-list writing-word-grid">{words.map(item=><details key={item.word} className="writing-word"><summary><span>{item.word}</span>{wordUsed(text,item.word) && <span className="writing-used">Used ✓</span>}</summary><p>{item.meaning}</p><p><em>{item.example}</em></p></details>)}</div>
   {suggestions.length>0 && <details className="writing-draft-alternatives"><summary>Alternatives from your draft · {suggestions.length}</summary>{suggestions.map(item=><article key={item.word}><strong>{item.word} → {item.suggestion}</strong><p>{item.meaning}</p>{item.example && <p><em>{item.example}</em></p>}{item.alternatives && <p>{item.alternatives.join(' · ')}</p>}</article>)}</details>}
  </div>
  <div id="resource-panel-phrases" role="tabpanel" aria-labelledby="resource-tab-phrases" hidden={tab!=='phrases'}>
   <div className="writing-phrase-filters"><div className="writing-resource-field"><label htmlFor="phrase-task">Writing task</label><span className="writing-select-wrap"><select id="phrase-task" value={taskOverride} onChange={e=>{setTaskOverride(e.target.value);setCopyStatus('');}}><option value="auto">Auto · Task {taskKind}</option><option value="1">Task 1</option><option value="2">Task 2</option></select><span className="writing-select-chevron" aria-hidden="true" /></span></div>
   <div className="writing-resource-field"><label htmlFor="phrase-category">Category</label><span className="writing-select-wrap"><select id="phrase-category" value={activeCategory} onChange={e=>{setCategory(e.target.value);setCopyStatus('');}}>{categories.map(c=><option key={c}>{c}</option>)}</select><span className="writing-select-chevron" aria-hidden="true" /></span></div></div>
   {phraseTask===1 && <p className="insight-muted">Task 1: describe the visual and summarise its main features. Conclusion phrases are for your overview.</p>}
   <div className="live-vocabulary-list">{phrasesFor(phraseTask,activeCategory).map(item=><details className="writing-phrase" key={item.id}><summary>{item.phrase}</summary><p>{item.meaning}</p><p><em>{item.example}</em></p><button type="button" onClick={()=>copy(item.phrase)}>Copy phrase</button></details>)}</div>
   <p className="writing-copy-status" role="status">{copyStatus}</p><p className="insight-muted">Choose a phrase that matches your idea. Replace “…” with your own words.</p>
  </div>
  </div>
 </dialog>;
});

export function MistakeExplanation({issue, explain}) {
 const [open,setOpen]=useState(false),[description,setDescription]=useState(''),[loading,setLoading]=useState(false);
 async function toggle() {
  setOpen(v=>!v);
  if(!description && issue.rule && !open) {
   setLoading(true);
   try {setDescription(await explain(issue.rule));} catch {setDescription('Rule details are unavailable; the detection message above explains the flagged pattern.');}
   finally {setLoading(false);}
  }
 }
 return <article className="harper-issue-card"><span className="harper-issue-badge">{issue.severity || 'warning'} · {issue.category || 'Local check'}</span><p><strong>“{issue.snippet}”</strong> — {issue.message}</p><button type="button" aria-expanded={open} onClick={toggle}>Explain My Mistake</button>{open && <div className="writing-rule-explanation">{loading?<p role="status">Loading rule details…</p>:<><p>{description || issue.message}</p>{issue.suggestions?.length>0 && <p>Suggested correction: {issue.suggestions.map(s=>s.replace || '(remove)').join(' / ')}</p>}<p className="insight-muted">Check this suggestion in context. A warning may be a style choice.</p></>}</div>}</article>;
}
