import { WORD_NOTES } from '../../data/spelling/words.js';
const shards=new Map();
async function loadShard(directory,letter) {
 const key=`${directory}:${letter}`;
 if(!shards.has(key))shards.set(key,fetch(`/spelling/${directory}${letter}.json`).then(r=>{if(!r.ok)throw new Error('Dictionary unavailable');return r.json();}).catch(error=>{shards.delete(key);throw error;}));
 return shards.get(key);
}
export async function dictionaryEntry(word) {
 const letter=word[0]?.toLowerCase();
 if(!/^[a-z]$/.test(letter))return null;
 const [definitions,structure]=await Promise.all([loadShard('',letter),loadShard('structure/',letter)]);
 const row=definitions[word],seed=WORD_NOTES[word],notes=structure[word];
 if(!row && !seed)return null;
 return {
  word,meaning:row?.[0] || seed.meaning,example:seed?.example || row?.[1] || '',
  meaningSource:row?'Princeton WordNet 3.0':'Cognition teaching notes',
  syllables:notes?.syllables || [],etymology:notes?.etymology || '',roots:notes?.roots || [],
  divisionSource:notes?.divisionSource || notes?.source,
  divisionSourceUrl:notes?.divisionSourceUrl || notes?.sourceUrl,
  etymologySource:notes?.etymologySource || notes?.source,
  etymologySourceUrl:notes?.etymologySourceUrl || notes?.sourceUrl,
 };
}
export function editDistance(a,b) {
 if(Math.abs(a.length-b.length)>2)return 3;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++) {const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length];
}
