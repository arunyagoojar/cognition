// The 7,600 Groq allowance leaves headroom below the supported free-tier
// 8,000-token/minute quota. It is a request allowance, not a model context limit.
// No planner truncates candidate answers to make a request fit.
export function planRequestBudget(provider, system, prompt, {coaching=false,mediaTokens=0,textTokenCount=null} = {}) {
 const bytes=value=>new TextEncoder().encode(String(value || '')).length;
 const measured=Number.isFinite(textTokenCount) && textTokenCount>=0;
 const textTokens=(measured ? Math.ceil(textTokenCount) : coaching ? bytes(system)+bytes(prompt) : Math.ceil((bytes(system)+bytes(prompt))/2.8))+128;
 const inputTokens=textTokens+mediaTokens;
 const totalBudget=provider==='groq'?7600:30000;
 const outputCap=coaching?2000:provider==='groq'?6000:8192;
 const outputTokens=Math.min(outputCap,totalBudget-inputTokens);
 if(outputTokens<(coaching?1200:2000)) return {ok:false,inputTokens,message:'This response and question exceed the selected provider’s review budget. Shorten the response or select a provider with a larger budget in Settings. Your text has not been truncated.'};
 return {ok:true,inputTokens,outputTokens,totalBudget};
}

let harmonyTokenizer;

/** Count GPT-OSS text locally, using its tokenizer rather than a byte heuristic.
 * Load the vocabulary only when a full Groq review needs it, keeping it out of
 * startup downloads. Gemini and other families retain the conservative planner.
 * 128 tokens remain reserved for provider framing/JSON mode/reasoning settings;
 * the provider remains authoritative about its live quota and chat template.
 */
export async function prepareRequestBudget(provider, system, prompt, options = {}) {
 if(provider!=='groq' || options.coaching || !/^openai\/gpt-oss-(?:120b|20b)$/.test(options.model || '')) {
  return planRequestBudget(provider,system,prompt,options);
 }
 try {
  let countTokens=options.countTextTokens;
  if(!countTokens) {
   harmonyTokenizer ||= import('gpt-tokenizer/encoding/o200k_harmony');
   ({countTokens}=await harmonyTokenizer);
  }
  // Treat any literal special-token-looking text as ordinary user content.
  const encodingOptions={disallowedSpecial:new Set()};
  const textTokenCount=countTokens(String(system || ''),encodingOptions)+countTokens(String(prompt || ''),encodingOptions);
  return {...planRequestBudget(provider,system,prompt,{...options,textTokenCount}),tokenCountSource:'o200k_harmony'};
 } catch {
  harmonyTokenizer=null;
  // A failed vocabulary download must never remove the request limit.
  return {...planRequestBudget(provider,system,prompt,options),tokenCountSource:'byte_estimate'};
 }
}
