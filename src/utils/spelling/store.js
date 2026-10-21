import {getDraftScope} from '../drafts.js';
import {summarizeActivity} from './engine.js';
const key=(owner=getDraftScope())=>`cognition_spelling_v1:${owner || 'guest'}`;
export const SPELLING_EVENT='cognition:spelling-updated';
export function readSpellingActivity(owner=getDraftScope()) {
 try {const rows=JSON.parse(localStorage.getItem(key(owner)) || '[]');return Array.isArray(rows)?rows:[];}catch{return [];}
}
export function mergeSpellingActivity(records,owner=getDraftScope()) {
 const rows=[...new Map([...readSpellingActivity(owner),...records].map(r=>[r.id,r])).values()];
 localStorage.setItem(key(owner),JSON.stringify(rows));
 if(typeof window!=='undefined')window.dispatchEvent(new Event(SPELLING_EVENT));
 return rows;
}
export function saveSpellingActivity(record,owner=getDraftScope()) {
 mergeSpellingActivity([record],owner);
 // Account is checked again after this lazy import so an account switch cannot
 // enqueue a record under another person's identity.
 if(owner) void import('../api.js').then(({syncSpellingActivity})=>{if(owner===getDraftScope())return syncSpellingActivity(record);}).catch(()=>{});
 return record;
}
export const getSpellingProgress=()=>summarizeActivity(readSpellingActivity());
