export const REPEAT_COLORS=['#fff0bd','#e6dcff','#d3f1ea','#ffdfe8','#dceaff','#f4e1cb'];
export function repeatColor(word, group) {if(group) {const index=group.findIndex(w=>(w.word || w)===word);if(index>=0)return REPEAT_COLORS[index%REPEAT_COLORS.length];}let hash=0;for(const c of word) hash=(hash*31+c.charCodeAt(0))>>>0;return REPEAT_COLORS[hash%REPEAT_COLORS.length];}
export function editorSegments(text, issues = [], repetitiveWords = []) {
 const marks=[];
 for(const word of repetitiveWords) for(const occurrence of word.occurrences) marks.push({...occurrence,color:repeatColor(word.word,repetitiveWords),word:word.word});
 const boundaries=new Set([0,text.length]);
 for(const range of [...issues,...marks]) {if(range.start>=0 && range.end<=text.length) {boundaries.add(range.start);boundaries.add(range.end);}}
 const points=[...boundaries].sort((a,b)=>a-b);
 return points.slice(0,-1).map((start,i)=>{const end=points[i+1],issue=issues.find(r=>r.start<end && r.end>start),repeat=marks.find(r=>r.start<end && r.end>start);return {start,end,text:text.slice(start,end),issue,repeat};});
}
