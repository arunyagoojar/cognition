import { IELTS_SYNONYMS } from './repetitionService.js';
// Context cues, not automatic substitutions. Precision matters more than rarity.
const WORDS = [
 ['actively','proactively','taking action before a problem develops; use only if that is your meaning','Schools can proactively identify gaps in learning.'],
 ['dynamically','adaptively','changing in response to new conditions','The system adjusts adaptively as demand changes.'],
 ['difficult','challenging','requiring effort or skill','Maintaining concentration can be challenging.'],
 ['focus','concentrate','direct attention towards a task; check the sentence structure','Students need time to concentrate on their work.'],
 ['important','significant','important enough to affect the argument','A significant advantage is easier access to education.'],
 ['good','beneficial','producing a useful effect','Reliable public transport can be beneficial for commuters.'],
 ['bad','detrimental','causing harm; stronger than simply disappointing','Air pollution can be detrimental to public health.'],
 ['many','numerous','a large number of countable things','Numerous households rely on public transport.'],
 ['big','substantial','large in amount or degree','The policy requires substantial investment.'],
 ['show','illustrate','make a relationship or pattern clear','The figures illustrate a change in spending.'],
 ['increase','rise','an upward movement; check noun/verb grammar','A gradual rise was followed by a stable period.'],
 ['decrease','decline','a downward change; not necessarily a sudden fall','Demand experienced a gradual decline.'],
 ['change','shift','a movement from one situation or preference to another','There was a shift towards renewable energy.'],
 ['different','distinct','clearly separate or recognisably different','The chart shows two distinct patterns.'],
 ['help','support','assist a person, argument, or process','These examples support the central argument.'],
 ['problem','challenge','a difficulty to address; not always a direct synonym','Housing affordability remains a major challenge.'],
 ['people','residents','people living in a particular place; use only if that is your meaning','Local residents would benefit from safer streets.'],
 ['think','argue','present a reasoned position','I would argue that prevention deserves more funding.'],
 ['because','since','introduce a reason; avoid ambiguity with time','Since demand is rising, capacity needs to expand.'],
 ['result','outcome','the consequence of a process or decision','The long-term outcome depends on implementation.'],
];
export function suggestVocabulary(text, limit = 5) {
 const tokens = String(text).toLowerCase().match(/\b[a-z]+\b/g) || [];
 const counts = new Map(); for (const word of tokens) counts.set(word, (counts.get(word) || 0) + 1);
 const curated=WORDS.filter(([word,suggestion])=>counts.has(word) && !counts.has(suggestion)).map(([word,suggestion,meaning,example])=>({word,suggestion,meaning,example,count:counts.get(word)}));
 const seen=new Set(curated.map(s=>s.word));
 const dictionary=Object.entries(IELTS_SYNONYMS).filter(([word])=>!seen.has(word) && (counts.has(word) || (word.includes(' ') && String(text).toLowerCase().includes(word)))).map(([word,options])=>({word,suggestion:options.find(s=>!counts.has(s)),alternatives:options.slice(0,3),meaning:'An alternative from your writing vocabulary bank. Check that its meaning fits this sentence.',count:counts.get(word) || 1})).filter(s=>s.suggestion);
 return [...curated,...dictionary].sort((a,b)=>b.count-a.count).slice(0,limit);
}
