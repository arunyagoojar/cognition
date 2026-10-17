import { getDraftScope } from '../drafts.js';
import { reviewWritingPractice } from '../geminiEvaluator.js';
import { recordAttempt, createAttemptId } from '../performanceStore.js';
import { syncAttempt } from '../api.js';
export async function submitWritingCoaching({text,task,taskKind,testId,focusKey,sourceAttemptId,localDiagnostics,id=createAttemptId('writing_coach')}) {
 const owner=getDraftScope();
 const response=await reviewWritingPractice({text,task,taskKind,localDiagnostics});
 if(owner!==getDraftScope())return {status:'failed',message:'The active account changed. Reopen the saved draft in its original account.'};
 if(response.status!=='completed') return response;
 const review={...response.evaluation,text};
 const attempt={id,type:'writing_coach',status:'completed',practiceMode:'drill',bandEligible:false,testId,taskKind,focusKey:focusKey || `writing.task${taskKind}`,sourceAttemptId,originalText:text,review,localDiagnostics,completedAt:new Date().toISOString()};
 recordAttempt(attempt);void syncAttempt(attempt);
 return {...response,evaluation:review};
}
