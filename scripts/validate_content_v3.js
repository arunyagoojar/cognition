/**
 * Cognition IELTS - Content V3 Database Validation Suite
 *
 * Validates every single record in src/data/content-v3/:
 * - Schema compliance
 * - Unique deterministic IDs
 * - Valid module, questionType, inputType
 * - Non-empty question text
 * - No [BLANK]-only questions
 * - No raw HTML UI controls (<input, <select, etc.)
 * - No WordPress artifacts (Cambridge anchor tags, tracking tags)
 * - No Google AdSense (<ins class="adsbygoogle">)
 * - No placeholder text (Item 1..., Details regarding...)
 * - Audio path resolution and physical file existence
 * - Section/audio atomic relationships
 * - Writing visual structure validation (structured table data)
 * - Speaking quarantine validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_V3_DIR = path.join(ROOT_DIR, 'src/data/content-v3');

const PLACEHOLDER_PATTERNS = [
  /^Item \d+[:\s]/i,
  /^Details regarding/i,
  /^Sample question/i,
  /^Question unavailable/i,
  /^Example question/i,
  /^Questions -/i,
  /^answer\d+/i
];

const VALID_QUESTION_TYPES = new Set([
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTI',
  'MATCHING',
  'FORM_COMPLETION',
  'NOTE_COMPLETION',
  'TABLE_COMPLETION',
  'SUMMARY_COMPLETION',
  'SENTENCE_COMPLETION',
  'SHORT_ANSWER',
  'MAP_LABELING',
  'DIAGRAM_LABELING',
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MATCHING_HEADINGS',
  'MATCHING_INFORMATION',
  'MATCHING_FEATURES',
  'TASK_1_TABLE',
  'TASK_1_GRAPH',
  'TASK_1_CHART',
  'TASK_1_MAP',
  'TASK_1_PROCESS',
  'TASK_1_LETTER',
  'TASK_2_ESSAY',
  'PART_1',
  'PART_2_CUE_CARD',
  'PART_3'
]);

const VALID_INPUT_TYPES = new Set([
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'TEXT',
  'TEXT_OR_SELECT',
  'INLINE_BLANK',
  'AUDIO_RECORDING',
  'ESSAY_TEXT'
]);

export function validateV3Database() {
  console.log('============================================================');
  console.log('VALIDATING CONTENT V3 DATABASE');
  console.log('============================================================\n');

  const stats = {
    listeningTestsChecked: 0,
    listeningQuestionsChecked: 0,
    readingTestsChecked: 0,
    readingQuestionsChecked: 0,
    writingTasksChecked: 0,
    speakingQuarantinedChecked: 0,
    totalErrors: 0,
    errors: []
  };

  const seenIds = new Set();

  function recordError(scope, id, message) {
    stats.totalErrors++;
    stats.errors.push(`[${scope}] ID: ${id} -> ${message}`);
  }

  // 1. Validate Writing
  const t1Dir = path.join(CONTENT_V3_DIR, 'writing/task1');
  const t2Dir = path.join(CONTENT_V3_DIR, 'writing/task2');

  const t1Files = fs.existsSync(t1Dir) ? fs.readdirSync(t1Dir).filter(f => f.endsWith('.json')) : [];
  for (const f of t1Files) {
    stats.writingTasksChecked++;
    const t = JSON.parse(fs.readFileSync(path.join(t1Dir, f), 'utf8'));

    if (seenIds.has(t.id)) recordError('WRITING_T1', t.id, 'Duplicate ID');
    seenIds.add(t.id);

    if (t.taskNumber !== 1) recordError('WRITING_T1', t.id, 'Invalid taskNumber');
    if (!t.prompt || t.prompt.length < 10) recordError('WRITING_T1', t.id, 'Empty or too short prompt');
    if (t.prompt.includes('Cambridge IELTS') || t.prompt.includes('adsbygoogle') || t.prompt.includes('<ins')) {
      recordError('WRITING_T1', t.id, 'Contains WordPress artifacts or AdSense');
    }
    if (!t.visual || t.visual.type !== 'TABLE' || !t.visual.tableData || !Array.isArray(t.visual.tableData.rows)) {
      recordError('WRITING_T1', t.id, 'Missing or malformed tableData');
    }
    if (t.status !== 'VERIFIED') recordError('WRITING_T1', t.id, 'Status not VERIFIED');
  }

  const t2Files = fs.existsSync(t2Dir) ? fs.readdirSync(t2Dir).filter(f => f.endsWith('.json')) : [];
  for (const f of t2Files) {
    stats.writingTasksChecked++;
    const t = JSON.parse(fs.readFileSync(path.join(t2Dir, f), 'utf8'));

    if (seenIds.has(t.id)) recordError('WRITING_T2', t.id, 'Duplicate ID');
    seenIds.add(t.id);

    if (t.taskNumber !== 2) recordError('WRITING_T2', t.id, 'Invalid taskNumber');
    if (!t.prompt || t.prompt.length < 10) recordError('WRITING_T2', t.id, 'Empty prompt');
    if (t.prompt.includes('Cambridge IELTS') || t.prompt.includes('adsbygoogle')) {
      recordError('WRITING_T2', t.id, 'Contains WordPress artifacts or AdSense');
    }
    if (t.status !== 'VERIFIED') recordError('WRITING_T2', t.id, 'Status not VERIFIED');
  }

  // 2. Validate Listening Questions
  const lisQDir = path.join(CONTENT_V3_DIR, 'listening/questions');
  const lisQFiles = fs.existsSync(lisQDir) ? fs.readdirSync(lisQDir).filter(f => f.endsWith('.json')) : [];

  for (const f of lisQFiles) {
    stats.listeningQuestionsChecked++;
    const q = JSON.parse(fs.readFileSync(path.join(lisQDir, f), 'utf8'));

    if (seenIds.has(q.id)) recordError('LISTENING_Q', q.id, 'Duplicate ID');
    seenIds.add(q.id);

    if (q.module !== 'LISTENING') recordError('LISTENING_Q', q.id, 'Invalid module');
    if (!VALID_QUESTION_TYPES.has(q.questionType)) recordError('LISTENING_Q', q.id, `Invalid questionType: ${q.questionType}`);
    if (!VALID_INPUT_TYPES.has(q.inputType)) recordError('LISTENING_Q', q.id, `Invalid inputType: ${q.inputType}`);
    if (!q.prompt || q.prompt.length === 0) recordError('LISTENING_Q', q.id, 'Empty prompt');
    if (/^(\(\d+\)\s*)?\[BLANK\]\s*$/i.test(q.prompt)) recordError('LISTENING_Q', q.id, 'Prompt contains only [BLANK]');
    if (PLACEHOLDER_PATTERNS.some(re => re.test(q.prompt))) recordError('LISTENING_Q', q.id, 'Prohibited placeholder detected');
    if (/<input|<select|<button|fname/i.test(q.prompt)) recordError('LISTENING_Q', q.id, 'Contains HTML UI controls');

    // Audio existence
    if (!q.audioPath) {
      recordError('LISTENING_Q', q.id, 'Missing audioPath');
    } else {
      const fullAudio = path.join(CONTENT_V3_DIR, q.audioPath);
      if (!fs.existsSync(fullAudio)) {
        recordError('LISTENING_Q', q.id, `Audio file does not exist on disk: ${q.audioPath}`);
      }
    }

    if (q.status !== 'VERIFIED') recordError('LISTENING_Q', q.id, 'Status not VERIFIED');
  }

  // 3. Validate Listening Test Packages
  const lisTDir = path.join(CONTENT_V3_DIR, 'listening/tests');
  const lisTFiles = fs.existsSync(lisTDir) ? fs.readdirSync(lisTDir).filter(f => f.endsWith('.json')) : [];

  for (const f of lisTFiles) {
    stats.listeningTestsChecked++;
    const pkg = JSON.parse(fs.readFileSync(path.join(lisTDir, f), 'utf8'));

    if (!pkg.sections || pkg.sections.length !== 4) {
      recordError('LISTENING_TEST', pkg.id, `Test does not contain exactly 4 sections (found ${pkg.sections?.length})`);
    }

    for (const sec of (pkg.sections || [])) {
      if (!sec.audio || !sec.audio.path) {
        recordError('LISTENING_SEC', sec.id, 'Missing section audio');
      } else {
        const fullAudio = path.join(CONTENT_V3_DIR, sec.audio.path);
        if (!fs.existsSync(fullAudio)) {
          recordError('LISTENING_SEC', sec.id, `Audio missing on disk: ${sec.audio.path}`);
        }
      }
      if (!sec.questionGroups || sec.questionGroups.length === 0) {
        recordError('LISTENING_SEC', sec.id, 'Section has no question groups');
      }
    }
  }

  // 4. Validate Reading Tests & Questions
  const reaTDir = path.join(CONTENT_V3_DIR, 'reading/tests');
  const reaTFiles = fs.existsSync(reaTDir) ? fs.readdirSync(reaTDir).filter(f => f.endsWith('.json')) : [];

  for (const f of reaTFiles) {
    stats.readingTestsChecked++;
    const test = JSON.parse(fs.readFileSync(path.join(reaTDir, f), 'utf8'));

    if (test.module !== 'READING') recordError('READING_TEST', test.id, 'Invalid module');
    if (!test.questions || test.questions.length < 25) {
      recordError('READING_TEST', test.id, `Too few questions in verified reading test (${test.questions?.length})`);
    }

    for (const q of (test.questions || [])) {
      stats.readingQuestionsChecked++;
      if (seenIds.has(q.id)) recordError('READING_Q', q.id, 'Duplicate ID');
      seenIds.add(q.id);

      if (!q.prompt || q.prompt.length < 5) recordError('READING_Q', q.id, 'Empty or too short prompt');
      if (q.prompt === q.sharedInstruction) recordError('READING_Q', q.id, 'Prompt equals shared group instruction');
      if (PLACEHOLDER_PATTERNS.some(re => re.test(q.prompt))) recordError('READING_Q', q.id, 'Prohibited placeholder');
      if (q.questionType === 'MULTIPLE_CHOICE_SINGLE' && (!q.options || q.options.length < 2)) {
        recordError('READING_Q', q.id, 'MCQ has < 2 options');
      }
      if (q.status !== 'VERIFIED') recordError('READING_Q', q.id, 'Status not VERIFIED');
    }
  }

  // 5. Validate Speaking Quarantine
  const speQPath = path.join(CONTENT_V3_DIR, 'quarantine/speaking_quarantine.json');
  if (fs.existsSync(speQPath)) {
    const speList = JSON.parse(fs.readFileSync(speQPath, 'utf8'));
    stats.speakingQuarantinedChecked = speList.length;
    for (const item of speList) {
      if (item.reason !== 'SAMPLE_ANSWER_LEAKAGE') {
        recordError('SPEAKING_QUARANTINE', item.testId, `Unexpected quarantine reason: ${item.reason}`);
      }
      if (!item.sourceFile) {
        recordError('SPEAKING_QUARANTINE', item.testId, 'Missing sourceFile provenance');
      }
    }
  } else {
    recordError('SPEAKING_QUARANTINE', 'GLOBAL', 'Missing speaking_quarantine.json');
  }

  console.log(`Writing Tasks Verified: ${stats.writingTasksChecked}`);
  console.log(`Listening Tests Verified: ${stats.listeningTestsChecked}`);
  console.log(`Listening Questions Verified: ${stats.listeningQuestionsChecked}`);
  console.log(`Reading Tests Verified: ${stats.readingTestsChecked}`);
  console.log(`Reading Questions Verified: ${stats.readingQuestionsChecked}`);
  console.log(`Speaking Quarantined Records: ${stats.speakingQuarantinedChecked}`);
  console.log(`Total Validation Errors: ${stats.totalErrors}`);

  if (stats.totalErrors > 0) {
    console.error('Validation Errors Encountered:');
    stats.errors.slice(0, 20).forEach(e => console.error(e));
    return false;
  } else {
    console.log('\n============================================================');
    console.log('ALL CONTENT V3 VALIDATION CHECKS PASSED PERFECTLY (0 ERRORS)');
    console.log('============================================================\n');
    return true;
  }
}

if (process.argv[1] && process.argv[1].endsWith('validate_content_v3.js')) {
  const ok = validateV3Database();
  process.exit(ok ? 0 : 1);
}
