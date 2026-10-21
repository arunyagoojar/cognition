// Align letters before highlighting. Index-by-index comparison incorrectly marks
// the entire suffix after a missing letter. Ties prefer retaining matching letters.
export function compareSpelling(correct, answer) {
 const expected=Array.from(correct.normalize('NFKC'));
 const actual=Array.from(answer.trim().normalize('NFKC'));
 const same=(a,b)=>a?.toLocaleLowerCase('en')===b?.toLocaleLowerCase('en');
 const costs=Array.from({length:expected.length+1},()=>Array(actual.length+1).fill(0));
 for(let i=0;i<=expected.length;i++)costs[i][0]=i;
 for(let j=0;j<=actual.length;j++)costs[0][j]=j;
 for(let i=1;i<=expected.length;i++)for(let j=1;j<=actual.length;j++) {
  costs[i][j]=Math.min(costs[i-1][j]+1,costs[i][j-1]+1,costs[i-1][j-1]+(same(expected[i-1],actual[j-1])?0:1));
  if(i>1 && j>1 && same(expected[i-1],actual[j-2]) && same(expected[i-2],actual[j-1]))costs[i][j]=Math.min(costs[i][j],costs[i-2][j-2]+1);
 }
 const reversed=[];let i=expected.length,j=actual.length;
 while(i || j) {
  if(i && j && same(expected[i-1],actual[j-1]) && costs[i][j]===costs[i-1][j-1]) {
   reversed.push({expected:expected[--i],actual:actual[--j],kind:'match'});
  } else if(i>1 && j>1 && same(expected[i-1],actual[j-2]) && same(expected[i-2],actual[j-1]) && costs[i][j]===costs[i-2][j-2]+1) {
   reversed.push({expected:expected[i-1],actual:actual[j-1],kind:'swapped'},{expected:expected[i-2],actual:actual[j-2],kind:'swapped'});i-=2;j-=2;
  } else if(i && costs[i][j]===costs[i-1][j]+1) {
   reversed.push({expected:expected[--i],actual:'',kind:'missing'});
  } else if(j && costs[i][j]===costs[i][j-1]+1) {
   reversed.push({expected:'',actual:actual[--j],kind:'extra'});
  } else {
   reversed.push({expected:expected[--i],actual:actual[--j],kind:'changed'});
  }
 }
 return reversed.reverse();
}

export function describeSpellingChanges(letters) {
 const notes=[];
 for(let i=0;i<letters.length;i++) {
  const part=letters[i];
  if(part.kind==='match')continue;
  if(part.kind==='swapped' && letters[i+1]?.kind==='swapped') {
   const next=letters[++i];notes.push(`Swap “${part.actual}${next.actual}” to “${part.expected}${next.expected}”.`);
  } else if(part.kind==='missing')notes.push(`Add the missing “${part.expected}” at position ${i+1-letters.slice(0,i).filter(row=>row.kind==='extra').length}.`);
  else if(part.kind==='extra')notes.push(`Remove the extra “${part.actual}”.`);
  else notes.push(`Use “${part.expected}” instead of “${part.actual}”.`);
 }
 return notes.join(' ');
}
