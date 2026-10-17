// Provider tokenizers differ. UTF-8 bytes form a deliberately conservative
// upper bound for single-task coaching; full-rubric calls retain a padded estimate.
export function planRequestBudget(provider, system, prompt, {coaching=false,mediaTokens=0} = {}) {
 const bytes=value=>new TextEncoder().encode(String(value || '')).length;
 const textTokens=coaching ? bytes(system)+bytes(prompt)+128 : Math.ceil((bytes(system)+bytes(prompt))/2.8)+128;
 const inputTokens=textTokens+mediaTokens;
 const totalBudget=provider==='groq'?7600:30000;
 const outputCap=coaching?2000:provider==='groq'?6000:8192;
 const outputTokens=Math.min(outputCap,totalBudget-inputTokens);
 if(outputTokens<(coaching?1200:2000)) return {ok:false,inputTokens,message:'This response and question exceed the selected provider’s review budget. Shorten the response or select a provider with a larger budget in Settings. Your text has not been truncated.'};
 return {ok:true,inputTokens,outputTokens,totalBudget};
}
