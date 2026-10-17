export function speakingTestContext(test) {
 const cue=test?.parts?.find(p=>p.partNumber===2)?.cueCard;
 return {title:test?.title || 'IELTS Speaking Practice',cueCard:cue?`${cue.topic}\n${(cue.bulletPrompts || []).join('\n')}\n${cue.finalInstruction || ''}`:undefined,questions:Object.fromEntries((test?.parts || []).flatMap(p=>(p.questions || []).map((question,i)=>[`${p.partNumber-1}_${i}`,String(question)])))};
}
