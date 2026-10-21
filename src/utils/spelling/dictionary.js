import { WORD_NOTES } from '../../data/spelling/words.js';
const shards=new Map();
export async function dictionaryEntry(word) {
 const letter=word[0]?.toLowerCase();
 if(!/^[a-z]$/.test(letter))return null;
 if(WORD_NOTES[word])return WORD_NOTES[word];
 if(!shards.has(letter))shards.set(letter,fetch(`/spelling/${letter}.json`).then(r=>{if(!r.ok)throw new Error('Dictionary unavailable');return r.json();}).catch(error=>{shards.delete(letter);throw error;}));
 const row=(await shards.get(letter))[word];
 return row?{word,meaning:row[0],example:row[1] || `Write “${word}” once, then cover it and spell it from memory.`,chunks:word.match(/.{1,3}/g),hint:`Build the word in small groups: ${word.match(/.{1,3}/g).join(' · ')}. Cover it and try again.`,origin:'WordNet does not include etymology. No verified Greek root is available for this entry.',source:'WordNet 3.0'}:null;
}
export function editDistance(a,b) {
 if(Math.abs(a.length-b.length)>2)return 3;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++) {const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}
 return row[b.length];
}
