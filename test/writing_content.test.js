/**
 * Production Writing contract tests (Phase 5).
 * Validates the runtime writing bundle: exact prompts, visuals, tables,
 * provenance, renderer contracts, and source pairing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTION_WRITING } from '../src/data/production/productionContent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Media lives in Cloudflare R2 — visual contract is manifest membership.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'media_manifest.json'), 'utf8'));
const manifestKeys = new Set(manifest.media.map(f => f.r2Key));
let failures = 0;
function check(cond, label) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', label); }
}

console.log('== Production Writing ==');
check(PRODUCTION_WRITING.length >= 125, `corpus size (${PRODUCTION_WRITING.length})`);
const seenIds = new Set();
let imgChecks = 0, tableChecks = 0;
for (const w of PRODUCTION_WRITING) {
  check(!seenIds.has(w.id), `unique id ${w.id}`); seenIds.add(w.id);
  check(/^writing\.test-\d{4}\.[0-9a-f]{8}$/.test(w.id), `id grammar ${w.id}`);
  // Task 1: exact prompt + renderer contract
  check(w.task1 && w.task1.prompt.length >= 40, `task1 prompt present (${w.slug})`);
  check(typeof w.task1.promptHtml === 'string' && w.task1.promptHtml.length > 40, `task1 promptHtml (${w.slug})`);
  check(!w.task1.promptHtml.includes('wp-content//'), `no double-slash in ${w.slug}`);
  if (w.task1.image) {
    imgChecks++;
    const key = `cognition/images/writing/${w.task1.image.file.split('/').pop()}`;
    check(manifestKeys.has(key), `task1 visual in media manifest ${w.task1.image.file} (${w.slug})`);
    check(typeof w.task1.visualType === 'string' && w.task1.visualType !== 'image', `visualType semantic (${w.slug})`);
  } else if (w.task1.table) {
    tableChecks++;
    check(w.task1.table.rows.length >= 2, `table rows (${w.slug})`);
    check(w.task1.table.rows.every(r => r.length === w.task1.table.rows[0].length), `table row widths consistent (${w.slug})`);
    check(w.task1.promptHtml.includes('<table'), `table renderer contract (${w.slug})`);
  } else {
    check(false, `task1 has visual or table (${w.slug})`);
  }
  // Task 2: prompt only, no contamination
  check(w.task2 && w.task2.prompt.length >= 40, `task2 prompt present (${w.slug})`);
  check(!/sample answer|model answer|band [6-9]\s*(answer|essay)/i.test(w.task2.prompt), `task2 no sample-answer contamination (${w.slug})`);
  check(!/IELTS MASTER|recent posts|leave a reply/i.test(w.task2.prompt), `task2 no site contamination (${w.slug})`);
  check(w.task1.provenance?.sha256 && w.task2.provenance?.sha256, `provenance present (${w.slug})`);
}
console.log(`  tests: ${PRODUCTION_WRITING.length}, image visuals: ${imgChecks}, html tables: ${tableChecks}`);

if (failures > 0) { console.error(`\n✗ ${failures} writing contract failures`); process.exit(1); }
console.log('All Production Writing Contract Tests Passed!');
