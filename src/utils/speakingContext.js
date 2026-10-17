// Recording identities belong to the original IELTS part, even when a drill
// contains only one part and its position in the visible array is zero.
export function speakingQuestionKey(part, questionIndex, fallbackPartIndex = 0) {
 const number=Number(part?.partNumber || fallbackPartIndex + 1);
 return `${number-1}_${questionIndex}`;
}

export function speakingPartComplete(part, recordings, fallbackPartIndex = 0) {
 const questions=part?.questions || [];
 const count=Number(part?.partNumber)===2 ? 1 : questions.length;
 return count>0 && Array.from({length:count},(_,i)=>speakingQuestionKey(part,i,fallbackPartIndex)).every(key=>Boolean(recordings[key]));
}

export function speakingTestContext(test) {
 const cue=test?.parts?.find(p=>p.partNumber===2)?.cueCard;
 return {title:test?.title || 'IELTS Speaking Practice',cueCard:cue?`${cue.topic}\n${(cue.bulletPrompts || []).join('\n')}\n${cue.finalInstruction || ''}`:undefined,questions:Object.fromEntries((test?.parts || []).flatMap((p,pi)=>(p.questions || []).map((question,i)=>[speakingQuestionKey(p,i,pi),String(question)])))};
}
