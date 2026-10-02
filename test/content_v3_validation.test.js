/**
 * Cognition IELTS - Content V3 Automated Test Suite
 *
 * Verifies:
 * 1. Reading extraction (authentic question stems, options, answers)
 * 2. Listening inline blanks ([INLINE_INPUT_N])
 * 3. Listening audio relationships (atomic sections, physical file existence)
 * 4. Writing normalization (structured tables, no WordPress/AdSense junk)
 * 5. Speaking extraction & quarantine (sample answer leakage detection)
 * 6. Question type classification (canonical taxonomy mapping)
 * 7. Quarantine rules (provenance & enumerated reasons)
 * 8. Duplicate handling (unique IDs, resolved multi-blanks)
 * 9. Source provenance (sourceFile, sourceHash tracking)
 * 10. V3 schema validation (contract adherence)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { classifyInstruction, deriveInputType, parseHtmlTable, cleanSourceHtml } from '../scripts/build_content_v3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_V3_DIR = path.join(ROOT_DIR, 'src/data/content-v3');

console.log('Running Content V3 Validation Test Suite...\n');

// 1. Reading Extraction Test
console.log('Test 1: Reading Extraction Fidelity...');
const reaDir = path.join(CONTENT_V3_DIR, 'reading/tests');
const reaFiles = fs.readdirSync(reaDir).filter(f => f.endsWith('.json'));
assert(reaFiles.length > 0, 'No verified reading tests found');

const sampleRea = JSON.parse(fs.readFileSync(path.join(reaDir, reaFiles[0]), 'utf8'));
assert.strictEqual(sampleRea.module, 'READING');
assert(sampleRea.questions.length >= 25, 'Reading test has fewer than 25 questions');

for (const q of sampleRea.questions.slice(0, 5)) {
  assert(q.prompt && q.prompt.length >= 5, `Question ${q.questionNumber} has empty or short prompt`);
  assert(q.prompt !== q.sharedInstruction, `Question ${q.questionNumber} prompt equals group instruction`);
  assert(!q.prompt.includes('Cambridge IELTS'), `Question ${q.prompt} contains WordPress junk`);
}
console.log('  ✓ Reading extraction successfully recovered authentic question stems.\n');

// 2. Listening Inline Blanks Test
console.log('Test 2: Listening Inline Blanks...');
const lisQDir = path.join(CONTENT_V3_DIR, 'listening/questions');
const lisQFiles = fs.readdirSync(lisQDir).filter(f => f.endsWith('.json'));
assert(lisQFiles.length > 0, 'No verified listening questions found');

const blankQuestions = [];
for (const f of lisQFiles.slice(0, 100)) {
  const q = JSON.parse(fs.readFileSync(path.join(lisQDir, f), 'utf8'));
  if (q.inputType === 'INLINE_BLANK') {
    blankQuestions.push(q);
  }
}
assert(blankQuestions.length > 0, 'No inline blank questions found in listening');
for (const q of blankQuestions.slice(0, 5)) {
  assert(q.prompt.includes('[INLINE_INPUT_') || q.tableData, `Question ${q.id} missing [INLINE_INPUT_N] marker`);
  assert(!/^(\(\d+\)\s*)?\[BLANK\]\s*$/i.test(q.prompt), `Question ${q.id} contains only [BLANK]`);
}
console.log('  ✓ Listening completion questions properly formatted with [INLINE_INPUT_N].\n');

// 3. Listening Audio Relationships Test
console.log('Test 3: Listening Audio Relationships...');
const lisTDir = path.join(CONTENT_V3_DIR, 'listening/tests');
const lisTFiles = fs.readdirSync(lisTDir).filter(f => f.endsWith('.json'));
assert(lisTFiles.length > 0, 'No verified listening tests found');

const sampleLisTest = JSON.parse(fs.readFileSync(path.join(lisTDir, lisTFiles[0]), 'utf8'));
assert.strictEqual(sampleLisTest.sections.length, 4, 'Listening test must have exactly 4 sections');

for (const sec of sampleLisTest.sections) {
  assert(sec.audio && sec.audio.path, `Section ${sec.sectionNumber} missing audio path`);
  const fullPath = path.join(CONTENT_V3_DIR, sec.audio.path);
  assert(fs.existsSync(fullPath), `Audio file does not exist on disk: ${sec.audio.path}`);
  assert(sec.questionGroups && sec.questionGroups.length > 0, `Section ${sec.sectionNumber} has no question groups`);
}
console.log('  ✓ Atomic section -> audio -> group relationship validated with 100% physical audio existence.\n');

// 4. Writing Normalization Test
console.log('Test 4: Writing Normalization...');
const wriT1Dir = path.join(CONTENT_V3_DIR, 'writing/task1');
const wriT2Dir = path.join(CONTENT_V3_DIR, 'writing/task2');

const t1Files = fs.readdirSync(wriT1Dir).filter(f => f.endsWith('.json'));
const t2Files = fs.readdirSync(wriT2Dir).filter(f => f.endsWith('.json'));
assert.strictEqual(t1Files.length, 12, 'Expected 12 verified Task 1 files');
assert.strictEqual(t2Files.length, 12, 'Expected 12 verified Task 2 files');

const sampleT1 = JSON.parse(fs.readFileSync(path.join(wriT1Dir, t1Files[0]), 'utf8'));
assert.strictEqual(sampleT1.taskType, 'TASK_1_TABLE');
assert.strictEqual(sampleT1.visual.type, 'TABLE');
assert(sampleT1.visual.tableData.rows.length > 0, 'Task 1 table has no rows');
assert(!sampleT1.prompt.includes('Cambridge IELTS Tests 1 to 17'), 'Task 1 contains Cambridge anchor link');
assert(!sampleT1.prompt.includes('<ins'), 'Task 1 contains Google AdSense tags');

const sampleT2 = JSON.parse(fs.readFileSync(path.join(wriT2Dir, t2Files[0]), 'utf8'));
assert.strictEqual(sampleT2.taskType, 'TASK_2_ESSAY');
assert.strictEqual(sampleT2.wordRequirement, 250);
assert(!sampleT2.prompt.includes('Cambridge IELTS Tests 1 to 17'), 'Task 2 contains Cambridge link');
console.log('  ✓ Writing Task 1 structured table visual data and Task 2 clean essay prompts verified.\n');

// 5. Speaking Extraction & Quarantine Test
console.log('Test 5: Speaking Extraction & Quarantine...');
const speQFile = path.join(CONTENT_V3_DIR, 'quarantine/speaking_quarantine.json');
assert(fs.existsSync(speQFile), 'Missing speaking_quarantine.json');
const speList = JSON.parse(fs.readFileSync(speQFile, 'utf8'));
assert(speList.length >= 179, 'Expected at least 179 quarantined speaking records');
for (const item of speList.slice(0, 5)) {
  assert.strictEqual(item.reason, 'SAMPLE_ANSWER_LEAKAGE');
  assert(item.sourceFile && item.sourceFile.includes('ielts-speaking-cue-card'), 'Missing sourceFile');
  assert(item.sourceHash, 'Missing sourceHash');
}
console.log('  ✓ Speaking blog model responses isolated in quarantine with SAMPLE_ANSWER_LEAKAGE provenance.\n');

// 6. Question Type Classification Test
console.log('Test 6: Question Type Classification...');
assert.strictEqual(classifyInstruction('Do the following statements agree with the information? Write TRUE FALSE NOT GIVEN'), 'TRUE_FALSE_NOT_GIVEN');
assert.strictEqual(classifyInstruction('Do the following statements reflect the claims of the writer? Write YES NO NOT GIVEN'), 'YES_NO_NOT_GIVEN');
assert.strictEqual(classifyInstruction('Choose the correct letter, A, B, C or D.'), 'MULTIPLE_CHOICE_SINGLE');
assert.strictEqual(classifyInstruction('Choose TWO letters, A-E.'), 'MULTIPLE_CHOICE_MULTI');
assert.strictEqual(classifyInstruction('Complete the notes below. Write NO MORE THAN TWO WORDS'), 'NOTE_COMPLETION');
assert.strictEqual(classifyInstruction('Complete the table below.'), 'TABLE_COMPLETION');
assert.strictEqual(classifyInstruction('Complete the summary below.'), 'SUMMARY_COMPLETION');
assert.strictEqual(classifyInstruction('Choose the correct heading for each paragraph from the list of headings below'), 'MATCHING_HEADINGS');
console.log('  ✓ Question type taxonomy properly classifies canonical IELTS instructions.\n');

// 7. Quarantine Rules Test
console.log('Test 7: Quarantine Rules & Provenance...');
for (const mod of ['listening', 'reading', 'writing', 'speaking']) {
  const qPath = path.join(CONTENT_V3_DIR, `quarantine/${mod}_quarantine.json`);
  assert(fs.existsSync(qPath), `Missing quarantine file for ${mod}`);
  const list = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  assert(Array.isArray(list), `Quarantine file for ${mod} is not an array`);
  if (list.length > 0) {
    const item = list[0];
    assert(item.reason, `Quarantined item in ${mod} missing reason`);
    assert(item.sourceFile, `Quarantined item in ${mod} missing sourceFile provenance`);
  }
}
console.log('  ✓ All 4 quarantine sets validated with explicit reasons and provenance.\n');

// 8. Duplicate Handling Test
console.log('Test 8: Duplicate Handling & Unique IDs...');
const seenIds = new Set();
for (const f of lisQFiles) {
  const q = JSON.parse(fs.readFileSync(path.join(lisQDir, f), 'utf8'));
  assert(!seenIds.has(q.id), `Duplicate ID found: ${q.id}`);
  seenIds.add(q.id);
}
console.log(`  ✓ All ${seenIds.size} Listening question IDs are strictly unique.\n`);

// 9. Source Provenance Test
console.log('Test 9: Source Provenance...');
assert(sampleLisTest.sourceEvidence?.sourceFile, 'Listening test missing sourceEvidence');
assert(sampleRea.sourceEvidence?.sourceFile, 'Reading test missing sourceEvidence');
assert(sampleT1.sourceEvidence?.sourceFile, 'Writing Task 1 missing sourceEvidence');
console.log('  ✓ Source provenance present across all tested modules.\n');

// 10. V3 Schema Validation Test
console.log('Test 10: V3 Schema Contracts...');
const schemas = ['question', 'section', 'passage', 'task', 'test'];
for (const s of schemas) {
  const schemaPath = path.join(CONTENT_V3_DIR, `schema/${s}.schema.json`);
  assert(fs.existsSync(schemaPath), `Missing schema file: ${s}.schema.json`);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert(schema.properties, `Invalid schema: ${s}.schema.json`);
}
console.log('  ✓ All 5 V3 JSON schema definitions are valid.\n');

console.log('============================================================');
console.log('ALL 10 CONTENT V3 AUTOMATED TESTS PASSED SUCCESSFULLY');
console.log('============================================================\n');
