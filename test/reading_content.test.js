/**
 * Production Reading contract tests (contract v2).
 * The runtime bundle may only contain complete, fully validated 40-question
 * tests; every question carries one answer control, a complete option set
 * where it needs one, and an official answer that the control can produce.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTION_READING } from '../src/data/production/productionContent.js';
import { resolveMediaUrl } from '../src/utils/media.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'media_manifest.json'), 'utf8'));
const manifestKeys = new Set(manifest.media.map(f => f.r2Key));
const dbIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'reading', 'index.json'), 'utf8'));
const frozen = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-db', 'reading', 'id-map.json'), 'utf8')).ids;

let failures = 0;
function check(cond, label) {
  if (!cond) { failures++; if (failures < 60) console.error('  ✗ FAIL:', label); }
}

const INPUT = { tfng: 'tfng', ynng: 'ynng', single_choice: 'single_select', pool_select: 'pool_select', multi_choice: 'multi_select', text: 'text' };
const FIXED = { tfng: ['TRUE', 'FALSE', 'NOT GIVEN'], ynng: ['YES', 'NO', 'NOT GIVEN'] };
const ARTIFACT = /Show Answers|Cambridge IELTS Tests?\s+\d|\[IMG|<[a-z/][^>]*>|&[a-z]+;|␦|�|(?:[.…·_]\s?){4,}|…{2,}|_{3,}/i;
const PASSAGE_ARTIFACT = /Show Answers|Cambridge IELTS Tests?\s+\d|\[IMG|<[a-z/][^>]*>|\(\s*\d{1,2}\s*\)\s*(?:[.…_]\s?){2,}|(?:[.…]\s?){5,}|…{3,}/i;
const segText = (segs) => (segs || []).filter(s => typeof s === 'string').join('');
const segBlanks = (segs) => (segs || []).filter(s => typeof s !== 'string').map(s => s.blank);
const r2Key = (src) => resolveMediaUrl(src).replace(/^https?:\/\/[^/]+\//, '');

console.log('== Production Reading (contract v2) ==');
check(PRODUCTION_READING.length >= 100, `corpus size ≥100 full tests (${PRODUCTION_READING.length})`);

const prodSlugs = new Set(dbIndex.tests_index.filter(t => t.status === 'production' && t.fullMockEligible).map(t => t.slug));
const blockedSlugs = new Set(dbIndex.tests_index.filter(t => t.status !== 'production' || !t.fullMockEligible).map(t => t.slug));

let qTotal = 0, aTotal = 0, imgTotal = 0;
const seenIds = new Set();
const typeCount = {};
for (const r of PRODUCTION_READING) {
  check(!seenIds.has(r.id), `unique id ${r.id}`); seenIds.add(r.id);
  check(/^reading\.test-\d{4}\.[0-9a-f]{8}$/.test(r.id), `id grammar ${r.id}`);
  if (frozen[r.slug]) check(frozen[r.slug] === r.id, `frozen id kept for ${r.slug}`);
  check(prodSlugs.has(r.slug) && !blockedSlugs.has(r.slug), `quarantine isolation: ${r.slug} is a production full test in content-db`);
  check(r.fullMockEligible === true && r.questionCount === 40, `full test (${r.slug})`);
  check(r.passages.length === 3, `3 passages (${r.slug})`);

  const nums = [];
  for (const p of r.passages) {
    check(Boolean(p.title) && p.title.length < 140, `passage title (${r.slug} P${p.passageNumber})`);
    check(p.paragraphs.filter(x => x.type === 'text').length >= 2, `passage prose (${r.slug} P${p.passageNumber})`);
    for (const x of p.paragraphs) {
      if (x.text) check(!PASSAGE_ARTIFACT.test(x.text), `passage artifact (${r.slug} P${p.passageNumber}): ${x.text.slice(0, 60)}`);
      if (x.type === 'image') { imgTotal++; check(manifestKeys.has(r2Key(x.src)), `passage image in R2 (${r.slug} ${x.src})`); }
    }
    check(p.questions.length === p.questionGroups.reduce((s, g) => s + g.questions.length, 0), `flat list = groups (${r.slug} P${p.passageNumber})`);
    for (const g of p.questionGroups) {
      typeCount[g.groupType] = (typeCount[g.groupType] || 0) + g.questions.length;
      check(g.groupType === 'tfng' || g.groupType === 'ynng' || Boolean(g.instructions), `group instruction (${r.slug} ${g.groupId})`);
      check(!ARTIFACT.test(g.instructions || ''), `instruction artifact (${r.slug} ${g.groupId})`);
      const pool = g.optionPool?.options || [];
      const poolIds = pool.map(o => o.id);
      if (['pool_select', 'multi_choice'].includes(g.answerControl)) {
        check(pool.length >= 2 && new Set(poolIds).size === poolIds.length, `option pool (${r.slug} ${g.groupId})`);
        for (const o of pool) check(o.label && !ARTIFACT.test(o.label), `option text (${r.slug} ${g.groupId} ${o.id})`);
      } else {
        check(pool.length === 0, `no orphan options (${r.slug} ${g.groupId})`);
      }
      if (g.answerControl === 'multi_choice') {
        check(g.selectCount === g.questions.length, `multi select count (${r.slug} ${g.groupId})`);
        const vals = g.questions.map(q => q.answer);
        check(new Set(vals).size === vals.length, `multi answers distinct (${r.slug} ${g.groupId})`);
        check(g.questions.every(q => q.unorderedGroup === g.groupId), `multi slots unordered (${r.slug} ${g.groupId})`);
      }
      const stimBlanks = [];
      for (const b of g.stimulus?.blocks || []) {
        if (b.type === 'text') { stimBlanks.push(...segBlanks(b.segments)); check(!ARTIFACT.test(segText(b.segments)), `stimulus artifact (${r.slug} ${g.groupId})`); }
        if (b.type === 'table') for (const row of b.rows) for (const c of row) stimBlanks.push(...segBlanks(c));
        if (b.type === 'image') { imgTotal++; check(manifestKeys.has(r2Key(b.src)), `stimulus image in R2 (${r.slug} ${g.groupId})`); }
      }
      check(new Set(stimBlanks).size === stimBlanks.length, `stimulus blanks unique (${r.slug} ${g.groupId})`);
      for (const q of g.questions) {
        qTotal++;
        nums.push(q.questionNumber);
        check(q.id === `q${q.questionNumber}`, `q id grammar (${r.slug} ${q.id})`);
        check(q.inputType === INPUT[g.answerControl], `inputType matches control (${r.slug} ${q.id})`);
        check(q.answer !== null && q.answer !== undefined && String(q.answer).trim() !== '', `answer present (${r.slug} ${q.id})`);
        if (q.answer) aTotal++;
        check(!ARTIFACT.test(segText(q.prompt)), `prompt artifact (${r.slug} ${q.id})`);
        const blanks = segBlanks(q.prompt);
        check(blanks.every(b => b === q.questionNumber) && blanks.length <= 1, `prompt blank belongs to its question (${r.slug} ${q.id})`);
        const locatable = segText(q.prompt).trim() || stimBlanks.includes(q.questionNumber) || q.labelInFigure || g.answerControl === 'multi_choice';
        check(Boolean(locatable), `question is locatable (${r.slug} ${q.id})`);
        if (FIXED[g.answerControl]) check(FIXED[g.answerControl].includes(q.answer), `judgement answer valid (${r.slug} ${q.id} ${q.answer})`);
        if (g.answerControl === 'single_choice') {
          const ids = (q.options || []).map(o => o.id);
          check(ids.length >= 3 && ids.join('') === 'ABCDEFGH'.slice(0, ids.length), `MCQ options A.. (${r.slug} ${q.id})`);
          check(ids.includes(q.answer), `MCQ answer among options (${r.slug} ${q.id})`);
        }
        if (['pool_select', 'multi_choice'].includes(g.answerControl)) check(poolIds.includes(q.answer), `answer in pool (${r.slug} ${q.id} ${q.answer})`);
        if (g.answerControl === 'text') {
          check(Boolean(q.context) && /[A-Za-z]{3}/.test(q.context.replace(/____/g, '')), `AI check context (${r.slug} ${q.id})`);
          check(Boolean(q.instruction), `AI check instruction (${r.slug} ${q.id})`);
          check(Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0, `accepted answers (${r.slug} ${q.id})`);
          check(!/^([A-Za-z]|[ivx]{1,4}|true|false|not given|yes|no)$/i.test(String(q.answer).trim()), `typed answer is not an option code (${r.slug} ${q.id})`);
        }
      }
    }
  }
  check(nums.join(',') === Array.from({ length: 40 }, (_, i) => i + 1).join(','), `questions 1–40 in order (${r.slug})`);
}
console.log(`  tests: ${PRODUCTION_READING.length}, questions: ${qTotal}, answers: ${aTotal}, images: ${imgTotal}`);
console.log('  by type:', JSON.stringify(typeCount));

if (failures > 0) { console.error(`\n✗ ${failures} reading contract failures`); process.exit(1); }
console.log('All Production Reading Contract Tests Passed!');
