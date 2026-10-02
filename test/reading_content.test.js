/**
 * Production Reading contract tests (Phase 6).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTION_READING } from '../src/data/production/productionContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(cond, label) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', label); }
}

console.log('== Production Reading ==');
check(PRODUCTION_READING.length >= 200, `corpus size (${PRODUCTION_READING.length})`);
let qTotal = 0, aTotal = 0, assetTotal = 0;
const seenIds = new Set();
for (const r of PRODUCTION_READING) {
  check(!seenIds.has(r.id), `unique id ${r.id}`); seenIds.add(r.id);
  check(/^reading\.test-\d{4}\.[0-9a-f]{8}$/.test(r.id), `id grammar ${r.id}`);
  check(r.passages.length >= 1 && r.passages.length <= 3, `passages 1-3 (${r.slug})`);
  const nums = [];
  for (const p of r.passages) {
    check(p.htmlContent.length > 50, `passage content (${r.slug} P${p.passageNumber})`);
    check(!p.htmlContent.includes('IELTS MASTER'), `no site branding (${r.slug})`);
    check(!p.htmlContent.includes('/Users/arunyagoojar'), `no external paths (${r.slug})`);
    for (const a of p.assets) {
      assetTotal++;
      const fp = path.join(ROOT, 'public', a.projectPath.replace(/^\//, ''));
      check(fs.existsSync(fp), `asset exists ${a.projectPath} (${r.slug})`);
    }
    for (const g of p.questionGroups) {
      check(Boolean(g.instructions), `group instruction (${r.slug} ${g.groupId})`);
      for (const q of g.questions) {
        qTotal++;
        check(/^q\d+$/.test(q.id), `q id grammar (${r.slug} ${q.id})`);
        check(q.questionText.length > 3 || q.prompt.length > 3, `q content (${r.slug} ${q.id})`);
        if (q.answer !== null && q.answer !== undefined && q.answer !== '') aTotal++;
      }
    }
  }
}
console.log(`  tests: ${PRODUCTION_READING.length}, questions: ${qTotal}, answers: ${aTotal}, assets: ${assetTotal}`);

if (failures > 0) { console.error(`\n✗ ${failures} reading contract failures`); process.exit(1); }
console.log('All Production Reading Contract Tests Passed!');
