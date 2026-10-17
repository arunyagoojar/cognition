// Context cues, not automatic substitutions. Precision matters more than rarity.
const WORDS = [
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
 return WORDS.filter(([word, suggestion]) => counts.has(word) && !counts.has(suggestion)).sort((a,b) => counts.get(b[0])-counts.get(a[0])).slice(0,limit).map(([word,suggestion,meaning,example])=>({word,suggestion,meaning,example,count:counts.get(word)}));
}
