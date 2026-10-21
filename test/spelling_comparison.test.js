import assert from 'node:assert/strict';
import {compareSpelling,describeSpellingChanges} from '../src/utils/spelling/comparison.js';

for(const [correct,answer] of [['questionnaire','questionare'],['because','becaus'],['accommodation','accomodation'],['friend','freind'],['receive','recieve'],['cat','cart'],['cat','kat'],['cat','at'],['cat','cats'],['a',''],['','a'],['café','cafe'],['word','WORD']]) {
 const letters=compareSpelling(correct,answer);
 assert.equal(letters.map(p=>p.expected).join(''),correct);
 assert.equal(letters.map(p=>p.actual).join(''),answer);
 assert(letters.filter(p=>p.kind==='match').every(p=>p.expected.toLowerCase()===p.actual.toLowerCase()));
}
const questionnaire=compareSpelling('questionnaire','questionare');
assert.deepEqual(questionnaire.filter(p=>p.kind==='missing').map(p=>p.expected),['n','i']);
assert.equal(questionnaire.filter(p=>p.kind!=='match' && p.kind!=='missing').length,0,'missing letters do not mark the suffix as wrong');
assert(describeSpellingChanges(questionnaire).includes('missing “n”'));
assert.equal(describeSpellingChanges(compareSpelling('friend','freind')),'Swap “ei” to “ie”.');
assert.equal(describeSpellingChanges(compareSpelling('cat','cart')),'Remove the extra “r”.');
assert.equal(describeSpellingChanges(compareSpelling('cat','kat')),'Use “c” instead of “k”.');
assert.equal(describeSpellingChanges(compareSpelling('word','WORD')),'');
console.log('Spelling alignment: missing, extra, changed, swapped, repeated, empty and case-insensitive letters passed.');
