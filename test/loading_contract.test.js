import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as source from '../src/data/production/productionContent.js';
import { CONTENT_CATALOG, loadSkillContent } from '../src/data/production/registry.js';
for (const skill of ['listening','reading','writing','speaking']) {
 const bank=await loadSkillContent(skill);
 assert.deepEqual(bank,source[`PRODUCTION_${skill.toUpperCase()}`],`${skill} content and answer keys must not change during chunking`);
 assert.equal(CONTENT_CATALOG[skill].length,bank.length);
 assert(!JSON.stringify(CONTENT_CATALOG[skill]).includes('acceptedAnswers'));
 console.log(`✓ ${skill}: ${bank.length} source records preserved; catalog carries no answer payload`);
}
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
assert(!app.includes("from './data/production/productionContent.js'"));
assert(app.includes('loadSkillContent'));
console.log('Loading contracts passed.');
