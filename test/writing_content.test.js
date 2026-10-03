/**
 * Production Writing contract tests.
 * Validates the runtime writing bundle: exact prompts (no model essays, sample
 * answers, stray headings or fused questions), Task 1 + Task 2 from the same
 * source page, visuals resolvable to R2 keys present in the media manifest,
 * HTML tables with real captions, frozen ids, and quarantined packages absent.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTION_WRITING, PRODUCTION_META } from '../src/data/production/productionContent.js';
import { resolveMediaUrl } from '../src/utils/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));

// Media lives in Cloudflare R2 — visual contract is manifest membership of the
// key the app actually requests (resolved through src/utils/media.js).
const manifest = readJson('content-db', 'media_manifest.json');
const manifestKeys = new Set(manifest.media.map(f => f.r2Key));
const idMap = readJson('content-db', 'writing', 'id-map.json').ids;
const dbIndex = readJson('content-db', 'writing', 'index.json');
const quarantined = dbIndex.tests.filter(t => t.status !== 'verified');
const quarantineDir = path.join(ROOT, 'content-db', 'writing', 'quarantine');

let failures = 0;
function check(cond, label) {
  if (!cond) { failures++; console.error('  ✗ FAIL:', label); }
}

const MAX_WORDS = { task1: 100, task2: 120 };          // genuine prompts: T1 ≤ 67, T2 ≤ 70 words
const EXPECTED_LIMIT = { task1: 150, task2: 250 };
// "Give reasons for your answer" is legitimate prompt text; an upper-case
// "ANSWER" (e.g. "TASK 2 BAND 7.5 ANSWER") is a model-essay heading.
const LEAK_CASED = /\bANSWER\b/;
const LEAK = /\bband\s*(score\s*)?\d(\.\d)?\b|\bsample\b|\bmodel\s+(answer|essay)\b|\bsuggested answer\b|\bcandidate response\b|\bexaminer\b/i;
const leaks = s => LEAK_CASED.test(s) || LEAK.test(s);
const SITE_SHELL = /IELTS MASTER|recent posts|leave a reply|Cambridge IELTS Tests \d+ to \d+|share this|https?:\/\//i;
const ORPHAN_HEADING = /\b(task|test)\s*[12]\s*:?\s*$/i;
const FUSED = /[.?!]\s+\d{1,3}\.\s+[A-Z]/;
const words = s => s.trim().split(/\s+/).length;

console.log('== Production Writing ==');
check(PRODUCTION_WRITING.length >= 125, `corpus size (${PRODUCTION_WRITING.length})`);
check(PRODUCTION_META.writingTests === PRODUCTION_WRITING.length, 'meta writingTests matches bundle');

const seenIds = new Set();
const seenTestIds = new Set();
const seenImages = new Set();
let imgChecks = 0, tableChecks = 0, captionChecks = 0;
for (const w of PRODUCTION_WRITING) {
  check(!seenIds.has(w.id), `unique id ${w.id}`); seenIds.add(w.id);
  check(!seenTestIds.has(w.testId), `unique testId ${w.testId}`); seenTestIds.add(w.testId);
  check(/^writing\.test-\d{4}\.[0-9a-f]{8}$/.test(w.id), `id grammar ${w.id}`);
  check(idMap[w.slug] === w.id, `id frozen to id-map (${w.slug}: ${w.id} vs ${idMap[w.slug]})`);
  check(w.status === 'verified' && w.kind === 'complete_test', `only verified complete packages ship (${w.slug})`);

  // Task 1 + Task 2 from the same source package / page
  check(w.task1 && w.task2, `both tasks present (${w.slug})`);
  if (!w.task1 || !w.task2) continue;
  check(w.task1.id === `${w.id}.task1` && w.task2.id === `${w.id}.task2`, `task ids derive from package id (${w.slug})`);
  check(w.task1.provenance?.page && w.task1.provenance.page === w.task2.provenance?.page,
    `task1 and task2 from the same source page (${w.slug})`);
  check(w.task1.provenance?.sha256 && w.task1.provenance.sha256 === w.task2.provenance?.sha256,
    `task1 and task2 share the page hash (${w.slug})`);
  check(w.task1.provenance.page.startsWith(w.slug), `provenance page belongs to slug (${w.slug})`);

  for (const k of ['task1', 'task2']) {
    const p = w[k].prompt;
    check(typeof p === 'string' && p.length >= 40, `${k} prompt present (${w.slug})`);
    check(typeof w[k].promptHtml === 'string' && w[k].promptHtml.length > 40, `${k} promptHtml (${w.slug})`);
    check(!leaks(p), `${k} no ANSWER/band/sample/model leakage (${w.slug}: ${(p.match(LEAK_CASED) || p.match(LEAK) || [''])[0]})`);
    check(!leaks(w[k].promptHtml.replace(/<[^>]+>/g, ' ')), `${k} promptHtml no leakage (${w.slug})`);
    check(!SITE_SHELL.test(p), `${k} no site contamination (${w.slug})`);
    check(!ORPHAN_HEADING.test(p), `${k} no orphan task heading at prompt end (${w.slug})`);
    check(words(p) <= MAX_WORDS[k], `${k} prompt length sane (${words(p)} words, ${w.slug})`);
    check(!FUSED.test(p), `${k} single prompt, no fused numbered prompt (${w.slug})`);
    check(!/write a letter|\bdear (sir|madam)/i.test(p), `${k} is Academic, not a GT letter (${w.slug})`);
    check(w[k].wordLimitMin === null || w[k].wordLimitMin === EXPECTED_LIMIT[k],
      `${k} word limit ${w[k].wordLimitMin} (${w.slug})`);
  }
  check(!/<table|<img/i.test(w.task2.promptHtml), `task2 has no visual (${w.slug})`);
  check(!w.task1.promptHtml.includes('wp-content//'), `no double-slash in ${w.slug}`);

  // Task 1 visual: exactly one of image / HTML table
  const { image, table } = w.task1;
  check(Boolean(image) !== Boolean(table), `task1 has exactly one of image or table (${w.slug})`);
  if (image) {
    imgChecks++;
    const url = resolveMediaUrl(image.file);
    const key = url.replace(/^https?:\/\/[^/]+\//, '').split('/').map(decodeURIComponent).join('/');
    check(key.startsWith('cognition/images/writing/'), `task1 image resolves to a writing R2 key (${key}, ${w.slug})`);
    check(manifestKeys.has(key), `task1 visual R2 key in media manifest ${key} (${w.slug})`);
    check(!seenImages.has(key), `task1 image not shared with another test (${key})`); seenImages.add(key);
    check(typeof w.task1.visualType === 'string' && w.task1.visualType !== 'image', `visualType semantic (${w.slug})`);
    check(!w.task1.promptHtml.includes('<table'), `image task has no table (${w.slug})`);
  } else if (table) {
    tableChecks++;
    check(table.rows.length >= 2, `table rows (${w.slug})`);
    check(table.rows.every(r => r.length === table.rows[0].length), `table row widths consistent (${w.slug})`);
    check(w.task1.promptHtml.includes('<table'), `table renderer contract (${w.slug})`);
    // every HTML-table prompt ends with its word-limit sentence; trailing text = a fused caption
    check(/\bwords\.$/.test(w.task1.prompt.trim()), `table caption not fused into task1 prompt (${w.slug})`);
    if (table.caption) {
      captionChecks++;
      check(!w.task1.prompt.trim().endsWith(table.caption), `caption not appended to prompt (${w.slug})`);
      check(w.task1.promptHtml.includes(`<table class="writing-table"><caption>`),
        `caption rendered as a real <caption> (${w.slug})`);
    }
  }
}

// Table captions known from the source (moved out of the prompt into <caption>)
const EXPECTED_CAPTIONS = {
  'ielts-writing-test-10': 'underground railway systems',
  'ielts-writing-test-43': 'cinema viewing figures for films by country in millions',
  'ielts-writing-test-54': 'from 30-50 years old',
  'ielts-writing-test-71': 'participation in cultural activities, by age',
  'ielts-writing-test-76': 'sales: Week of October 7-13',
  'ielts-writing-test-85': 'hours of leisure time per year in someland',
};
for (const [slug, caption] of Object.entries(EXPECTED_CAPTIONS)) {
  const w = PRODUCTION_WRITING.find(x => x.slug === slug);
  check(w && w.task1.table?.caption === caption, `table caption for ${slug}`);
}
const t71 = PRODUCTION_WRITING.find(x => x.slug === 'ielts-writing-test-71');
check(t71 && t71.task1.promptHtml.includes('<p class="writing-table-note">* Dancing'), 'test 71 footnote rendered after table');

// Model-essay regressions: these prompts stop exactly at the word-limit sentence
for (const n of [129, 130, 131, 132]) {
  const w = PRODUCTION_WRITING.find(x => x.slug === `ielts-writing-test-${n}`);
  check(w && /Write at least 250 words\.$/.test(w.task2.prompt), `test ${n} task2 stops at the word-limit sentence`);
}

// Quarantined packages: recorded with reasons in content-db, absent from the bundle
const EXPECTED_QUARANTINE = {
  'ielts-writing-test-44': 'TASK1_VISUAL_INCOMPLETE',
  'ielts-writing-test-95': 'TASK1_VISUAL_INCOMPLETE',
  'ielts-writing-test-126': 'TASK1_VISUAL_INCOMPLETE',
  'ielts-writing-test-93': 'MULTIPLE_PROMPTS_FUSED',
};
const shippedSlugs = new Set(PRODUCTION_WRITING.map(w => w.slug));
for (const [slug, code] of Object.entries(EXPECTED_QUARANTINE)) {
  check(!shippedSlugs.has(slug), `quarantined ${slug} absent from runtime bundle`);
  const qf = path.join(quarantineDir, `${slug}.json`);
  check(fs.existsSync(qf), `quarantine record exists for ${slug}`);
  if (fs.existsSync(qf)) {
    const q = JSON.parse(fs.readFileSync(qf, 'utf8'));
    check(q.units.some(u => u.reasonCode === code), `${slug} quarantined with ${code}`);
  }
}
for (const t of quarantined) {
  check(!shippedSlugs.has(t.slug), `non-verified ${t.slug} (${t.status}) absent from runtime bundle`);
}
// exact accounting: every content-db record is either shipped or quarantined/duplicate
check(dbIndex.tests.length === PRODUCTION_WRITING.length + quarantined.length,
  `db records (${dbIndex.tests.length}) = shipped (${PRODUCTION_WRITING.length}) + withheld (${quarantined.length})`);
check(Object.keys(idMap).length === dbIndex.tests.length, 'every db record has a frozen id');

console.log(`  tests: ${PRODUCTION_WRITING.length}, image visuals: ${imgChecks}, html tables: ${tableChecks} (captions: ${captionChecks}), quarantined: ${quarantined.length}`);

if (failures > 0) { console.error(`\n✗ ${failures} writing contract failures`); process.exit(1); }
console.log('All Production Writing Contract Tests Passed!');
