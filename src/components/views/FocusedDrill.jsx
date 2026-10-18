import { selectFocusedContent } from '../../utils/focusedContent.js';
import HtmlContentRenderer from '../common/HtmlContentRenderer.jsx';
import { MultiChoice } from '../reading/ReadingQuestionGroup.jsx';
import { alignUnorderedAnswers } from '../../utils/evaluation/evaluationEngine.js';
import { useEffect, useRef, useState } from 'react';
import { CONTENT_CATALOG, loadSkillContent } from '../../data/production/registry.js';
import { getProductionReadingTest, getProductionListeningTest, getProductionSpeakingPackage, getProductionWritingTest } from '../../data/production/adapters.js';
import { chooseFreshTest } from '../../utils/practiceSelection.js';
import { readDraft, writeDraft } from '../../utils/drafts.js';
import { evaluateDeterministic } from '../../utils/bandCalculator.js';
import { recordAttempt, createAttemptId } from '../../utils/performanceStore.js';
import { syncAttempt } from '../../utils/api.js';
import ReadingPassage from '../reading/ReadingPassage.jsx';
import ReadingQuestionGroup from '../reading/ReadingQuestionGroup.jsx';
import QuestionRenderer from '../common/QuestionRenderer.jsx';
import SpeakingModule from '../modules/SpeakingModule.jsx';
import WritingCoach, { WritingReview } from './WritingCoach.jsx';
import { PageLoader } from '../common/Loader.jsx';
export default function FocusedDrill({ request, onBack, onOpenLesson, onOpenTips }) {
 const [focus] = useState(()=>request || readDraft('active-drill'));
 const [saved]=useState(()=>{const data=readDraft('drill-session');return data?.focusKey===focus?.key?data:null;});
 const [test,setTest]=useState(null), [error,setError]=useState(''), [answers,setAnswers]=useState(()=>saved?.answers || {}), [result,setResult]=useState(()=>saved?.result || null), [text,setText]=useState(()=>saved?.text || '');
 const attemptId=useRef(saved?.attemptId || createAttemptId('drill'));
 useEffect(()=>{if(test)writeDraft('drill-session',{focusKey:focus?.key,testId:test.testId,answers,result,text,attemptId:attemptId.current});},[test,focus,answers,result,text]);
 useEffect(()=>{
  if(!focus) return;
  let alive=true;writeDraft('active-drill',focus);
  loadSkillContent(focus.skill).then(()=>{
   const id=saved?.testId || focus.testId || chooseFreshTest(`${focus.skill}-drill`,CONTENT_CATALOG[focus.skill]);
   const get={reading:getProductionReadingTest,listening:getProductionListeningTest,speaking:getProductionSpeakingPackage,writing:getProductionWritingTest}[focus.skill];
   const source=get?.(id,true);
   if(!source) throw new Error('This source test is unavailable. Return to Performance and choose another recommendation.');
   const selected=selectFocusedContent(source,focus);
   if(alive) setTest(selected);
  }).catch(e=>{if(alive)setError(e.message);});
  return ()=>{alive=false;};
 },[focus,saved]);
 const save = data => {
   const attempt={id:attemptId.current,type:'drill',skill:focus.skill,focusKey:focus.key,testId:test?.testId,practiceMode:'drill',bandEligible:false,status:data.speaking && !data.speaking.focusedPracticeComplete ? 'partial' : 'completed',sourceAttemptId:focus.sourceAttemptId,completedAt:new Date().toISOString(),...data};
   recordAttempt(attempt);void syncAttempt(attempt);setResult(data);
 };
 if(!focus) return <div className="content-container"><p>Choose a recommendation from Performance to start focused practice.</p><button onClick={onBack}>Back to Performance</button></div>;
 if(error) return <div className="content-container"><p role="alert">{error}</p><button onClick={onBack}>Back to Performance</button></div>;
 if(!test) return <PageLoader label="Loading source questions" />;
 const groups=focus.skill==='reading' ? test.passages.flatMap(p=>p.questionGroups) : [];
 const questions=focus.skill==='reading' ? groups.flatMap(g=>g.questions) : (test.sections || []).flatMap(p=>p.questions);
 const submit=()=>{
   const aligned=alignUnorderedAnswers(questions,answers);
   const itemResults=Object.fromEntries(questions.map(q=>{const d=evaluateDeterministic(aligned[q.id],q.acceptedAnswers?.length?q.acceptedAnswers:q.answer,{wordLimit:q.wordLimit});return[q.id,{questionType:q.questionType,part:focus.part || null,candidateAnswer:answers[q.id] || '',finalResult:d.result==='MATCH'?'CORRECT':d.result==='UNCERTAIN'?'UNCERTAIN':'INCORRECT'}];}));
   const correct=Object.values(itemResults).filter(r=>r.finalResult==='CORRECT').length;
   save({itemResults,answers,accuracy:questions.length?Math.round(correct/questions.length*100):0,total:questions.length,correct});
 };
 const taskKind=focus.taskKind || 2;
 const task=test[taskKind===1?'task1':'task2'];
 return <div className="content-container">
  <button type="button" onClick={onBack}>Back to Performance</button>
  <header className="focused-practice-heading"><div><span className="insight-eyebrow">FOCUSED PRACTICE</span><h1>{focus.title || 'Focused practice'}</h1><p>Only this {focus.skill==='writing'?'task':'part'} · tracked separately from your full-test band</p></div><div className="insight-links">
   {focus.resources?.tip && <button type="button" onClick={()=>onOpenTips?.(focus.resources.tip.skill,focus.resources.tip.categoryId,focus.resources.tip.tipId)}>Strategy</button>}
   {focus.resources?.lesson && <button type="button" onClick={()=>onOpenLesson?.(focus.resources.lesson.id)}>Lesson</button>}
  </div></header>
  {focus.skill==='speaking' ? <SpeakingModule initialTest={test} practiceMode="drill" onBack={onBack} onSave={data=>save({speaking:data})} onComplete={onBack} /> : focus.skill==='writing' ? <>
   {result?.writingReview ? <section className="focused-writing-summary"><WritingReview review={result.writingReview}/><div className="insight-links"><button type="button" className="insight-secondary" onClick={()=>setResult(null)}>Revise this task</button><button type="button" className="practice-thumbnail-start" onClick={onBack}>Finish practice</button></div></section> : <>
    <section className="harper-pinned-prompt-card"><h2>Task {taskKind}</h2>{task?.promptHtml?<div dangerouslySetInnerHTML={{__html:task.promptHtml}}/>:<p>{task?.prompt || task?.instructions}</p>}{task?.image?.file && <img className="drill-task-image" src={task.image.file} alt="Writing task visual"/>}
      {task?.table?.rows && <div className="harper-prompt-table-wrap"><table className="harper-prompt-table"><tbody>{task.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=>i===0?<th key={j}>{cell}</th>:<td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}
    </section>
    <div className="focused-writing-editor"><label htmlFor="focused-writing-response">Your Task {taskKind} response</label><span>{text.trim()?text.trim().split(/\s+/).length:0} / {taskKind===1?150:250} words</span><textarea id="focused-writing-response" className="coach-draft" rows={12} value={text} onChange={e=>setText(e.target.value)}/></div>
    <WritingCoach focusKey={focus.key} sourceAttemptId={focus.sourceAttemptId} text={text} task={task} taskKind={taskKind} testId={test.testId} onReviewComplete={writingReview=>setResult({writingReview})}/>
   </>}
  </> : <>
   {focus.skill==='reading' && test.passages.map(p=><ReadingPassage key={p.passageNumber} passage={p}/>)}
   {focus.skill==='listening' && test.sections.map((s,i)=><audio key={i} controls src={s.audioFile || test.audio?.appPath}>Audio playback is unavailable.</audio>)}
   {groups.map(g=><ReadingQuestionGroup key={g.groupId} group={g} answers={answers} onAnswer={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>)}
   {focus.skill==='listening' && test.sections.map(part=><div key={part.id}>{part.questionGroups?.length?part.questionGroups.map(g=>{
     const inlineIds=new Set([...(g.htmlContent || '').matchAll(/data-qid="(q\d+)"/g)].map(m=>m[1]));
     return <section key={g.groupId} className="coach-panel"><h3>Questions {g.questions[0]?.questionNumber}–{g.questions.at(-1)?.questionNumber}</h3><p>{g.instructions}</p>{g.visualHtml && <div className="exam-visual" dangerouslySetInnerHTML={{__html:g.visualHtml}}/>}<HtmlContentRenderer htmlContent={g.htmlContent} answers={answers} setAnswers={setAnswers}/>{g.selection?<MultiChoice group={{questions:g.questions,startQ:g.questions[0]?.questionNumber,endQ:g.questions.at(-1)?.questionNumber,selectCount:g.selection.selectCount,optionPool:{options:g.selection.options}}} prompt={g.selection.prompt} answers={answers} onAnswer={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>:g.questions.filter(q=>!inlineIds.has(q.id)).map(q=><QuestionRenderer key={q.id} question={q} value={answers[q.id]} onChange={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>)}</section>;
   }):part.questions.map(q=><QuestionRenderer key={q.id} question={q} value={answers[q.id]} onChange={(id,value)=>setAnswers(a=>({...a,[id]:value}))}/>)}</div>)}
   {!result && <button type="button" className="btn-coral-pill-physical" onClick={submit}>Check this drill</button>}
   {result && <section className="coach-panel" aria-live="polite"><h2>{result.correct}/{result.total} confirmed correct</h2><p>{result.accuracy}% on this question group. This is not a full-test band; uncertain variants need review.</p><ol>{questions.map(q=><li key={q.id}>{q.questionText || `Question ${q.questionNumber}`} — {result.itemResults[q.id].finalResult}. Key: {String(q.answer ?? q.acceptedAnswers?.join(' / ') ?? '')}</li>)}</ol><button onClick={onBack}>Return to your recommendations</button></section>}
  </>}
 </div>;
}
