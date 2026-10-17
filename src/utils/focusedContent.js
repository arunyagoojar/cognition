// Preserve the source passage/audio/group context while selecting one focus.
export function selectFocusedContent(source,focus) {
 if(focus.skill==='reading') {
  const passages=(source.passages || []).filter(p=>!focus.part || Number(p.passageNumber)===Number(focus.part)).map(p=>({...p,questionGroups:(p.questionGroups || []).filter(g=>!focus.questionType || g.questions.some(q=>(q.questionType || q.type)===focus.questionType))})).filter(p=>p.questionGroups.length);
  if(!passages.length)throw new Error('No source passage matches this focus.');
  return {...source,passages:passages.slice(0,1)};
 }
 if(focus.skill==='listening') {
  const sections=(source.parts || source.sections || []).filter(p=>(!focus.part || Number(p.part || p.partNumber)===Number(focus.part))).map(p=>{
   const questionGroups=(p.questionGroups || []).filter(g=>!focus.questionType || g.questions.some(q=>(q.questionType || q.type)===focus.questionType));
   const questions=questionGroups.length?questionGroups.flatMap(g=>g.questions):(p.questions || []).filter(q=>!focus.questionType || (q.questionType || q.type)===focus.questionType);
   return {...p,questionGroups,questions};
  }).filter(p=>p.questions.length).slice(0,1);
  if(!sections.length)throw new Error('No source listening part matches this focus.');
  // Both names are used by existing renderers. Neither may expose the other parts.
  return {...source,parts:sections,sections};
 }
 if(focus.skill==='speaking') {
  const part=Number(focus.part || 2);
  const parts=(source.parts || []).filter(p=>Number(p.partNumber)===part);
  if(!parts.length)throw new Error('No source speaking part matches this focus.');
  return {...source,parts,title:`Speaking Part ${part} focused practice`};
 }
 return source;
}
