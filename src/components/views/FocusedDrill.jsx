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
import WritingCoach from './WritingCoach.jsx';
const STRATEGIES={
 matching_headings:'Read the paragraph for its central purpose, then summarise it in a few words before checking the headings. Match the whole idea, not a repeated keyword. Cross out choices only after checking their meaning.',
 matching_information:'Look for the specific detail requested. Scan for names or paraphrases, then verify the statement against the paragraph; a matching word alone is not enough.',
 tfng:'Separate contradiction from missing evidence. Use FALSE only when the passage contradicts the statement; use NOT GIVEN when it does not establish the claim.',
};
export default function FocusedDrill({ request, onBack, onOpenLesson, onOpenTips }) {
 const [focus] = useState(()=>request || readDraft('active-drill'));
 const [test,setTest]=useState(null), [error,setError]=useState(''), [answers,setAnswers]=useState({}), [result,setResult]=useState(null), [text,setText]=useState('');
 const attemptId=useRef(createAttemptId('drill'));
 useEffect(()=>{
  if(!focus) return;
  let alive=true;writeDraft('active-drill',focus);
  loadSkillContent(focus.skill).then(()=>{
   const id=focus.testId || chooseFreshTest(`${focus.skill}-drill`,CONTENT_CATALOG[focus.skill]);
   const get={reading:getProductionReadingTest,listening:getProductionListeningTest,speaking:getProductionSpeakingPackage,writing:getProductionWritingTest}[focus.skill];
   const source=get?.(id,true);
   if(!source) throw new Error('This source test is unavailable. Return to Performance and choose another recommendation.');
   const selected=selectFocusedContent(source,focus);
   if(alive) setTest(selected);
  }).catch(e=>{if(alive)setError(e.message);});
  return ()=>{alive=false;};
 },[focus]);
 const save = data => {
   const attempt={id:attemptId.current,type:'drill',skill:focus.skill,focusKey:focus.key,testId:test?.testId,practiceMode:'drill',bandEligible:false,status:data.speaking && !['COMPLETED','PARTIAL'].includes(data.speaking.evaluationState) ? 'partial' : 'completed',sourceAttemptId:focus.sourceAttemptId,completedAt:new Date().toISOString(),...data};
   recordAttempt(attempt);void syncAttempt(attempt);setResult(data);
 };
 if(!focus) return <div className="content-container"><p>Choose a recommendation from Performance to start focused practice.</p><button onClick={onBack}>Back to Performance</button></div>;
 if(error) return <div className="content-container"><p role="alert">{error}</p><button onClick={onBack}>Back to Performance</button></div>;
 if(!test) return <div className="content-container" role="status">Loading the source questions…</div>;
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
  <h1>{focus.title || 'Focused practice'}</h1><p><strong>Focused practice · excluded from overall band</strong></p>
  <section className="coach-panel"><h2>Use this strategy</h2><p>{STRATEGIES[focus.questionType] || focus.nextAction || focus.reason}</p>
   {focus.resources?.lesson && <button onClick={()=>onOpenLesson?.(focus.resources.lesson.id)}>Related lesson</button>}
   {focus.resources?.tip && <button onClick={()=>onOpenTips?.(focus.resources.tip.skill,focus.resources.tip.categoryId)}>More tips</button>}
  </section>
  {focus.skill==='speaking' ? <SpeakingModule initialTest={test} practiceMode="drill" onBack={onBack} onSave={data=>save({speaking:data})} onComplete={onBack} /> : focus.skill==='writing' ? <>
   <h2>Task {taskKind}</h2><p>{task?.prompt || task?.instructions}</p>{task?.image?.file && <img className="drill-task-image" src={task.image.file} alt="Writing task visual" />}
   <textarea className="coach-draft" aria-label="Writing response" rows={12} value={text} onChange={e=>setText(e.target.value)} />
   <WritingCoach focusKey={focus.key} sourceAttemptId={focus.sourceAttemptId} text={text} task={task} taskKind={taskKind} testId={test.testId} />
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
