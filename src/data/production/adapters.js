/**
 * Production content adapters (Phase 3).
 *
 * Maps the generated production runtime bundle (src/data/production/productionContent.js,
 * built deterministically from content-db by pipeline/build_runtime.py) into the shapes
 * the exam modules render. Same contract as the previous V2-backed adapters — the UI is
 * unchanged, only the content source moved to the production database.
 */
import {
  PRODUCTION_LISTENING,
  PRODUCTION_SPEAKING,
  PRODUCTION_WRITING,
  PRODUCTION_READING,
} from './productionContent.js';
import { resolveMediaUrl } from '../../utils/media.js';

export function getProductionListeningTest(testId, includeAnswers = false) {
  const rec = PRODUCTION_LISTENING.find(t =>
    String(t.testId) === String(testId) || t.id === testId || t.slug === testId);
  if (!rec) return null;
  return adaptProductionListening(rec, includeAnswers);
}

export function getAllProductionListeningTests() {
  return PRODUCTION_LISTENING;
}

export function adaptProductionListening(rec, includeAnswers = false) {
  return {
    testId: rec.testId,
    id: rec.id,
    slug: rec.slug,
    title: rec.title,
    status: rec.status,
    cambridgeIdentity: rec.cambridgeIdentity,
    audio: rec.audio,
    isRandomized: false,
    durationMinutes: 32,
    source: rec.source,
    parts: rec.parts.map(p => ({
      id: `${rec.id}-p${p.part}`,
      part: p.part,
      title: p.title,
      instructions: p.instructions,
      audioFile: resolveMediaUrl(p.audioFile || rec.audio.appPath) || null,
      audioFlags: rec.audio.flags,
      htmlContent: resolvePromptHtml(p.htmlContent),
      questions: p.questions.map(q => ({
        ...q,
        answer: includeAnswers ? q.answer : null,
      })),
      questionGroups: p.questionGroups.map(g => ({
        groupId: g.groupId,
        groupType: g.groupType,
        instructions: g.instructions,
        wordLimit: g.wordLimit,
        options: g.options,
        visualHtml: g.visualHtml ? resolvePromptHtml(g.visualHtml) : null,
        selection: g.selection || null,
        optionPool: g.optionPool || null,
        htmlContent: g.htmlContent,
        questions: g.questions.map(q => ({
          ...q,
          answer: includeAnswers ? q.answer : null,
        })),
      })),
    })),
  };
}

/**
 * Speaking production adapter. Packages follow the IELTS format:
 *   Part 1 — 3 familiar topics × 4 questions (flattened; each question keeps its topic)
 *   Part 2 — cue card: topic, "You should say:" prompts, "and explain …"
 *   Part 3 — 2 discussion themes × 3 questions (flattened; each keeps its theme)
 * Provenance is carried per part: the Part 2 topic comes from the source
 * practice site; prompts, Part 1 and Part 3 are written for Cognition in the
 * IELTS format. Neither is presented as official IELTS material.
 */
export const SPEAKING_PROVENANCE_LABEL = {
  SOURCE_PRACTICE_TOPIC: 'Practice topic',
  COGNITION_AUTHORED_PRACTICE: 'Practice questions in the IELTS format',
};

export function adaptProductionSpeaking(pkg) {
  const p1 = pkg.part1 || { available: false };
  const p3 = pkg.part3 || { available: false };
  const parts = [];
  if (p1.available) {
    const topics = p1.topics || [];
    parts.push({
      partNumber: 1,
      part: 1,
      title: 'Part 1 · Introduction & Interview',
      instructions: 'Answer the questions in full sentences. Approx. 4–5 minutes for this part in a real test.',
      questions: topics.flatMap(t => t.questions),
      questionTopics: topics.flatMap(t => t.questions.map(() => t.topic)),
      topicSetTopic: topics[0]?.topic || null,
      followUps: [],
      provenanceType: p1.provenanceType,
    });
  }
  parts.push({
    partNumber: 2,
    part: 2,
    title: 'Part 2 · Long Turn',
    instructions: '1 minute to prepare (make notes), then speak for up to 2 minutes.',
    cueCard: {
      topic: pkg.cueCard.topic,
      leadIn: pkg.cueCard.leadIn || 'You should say:',
      bulletPrompts: pkg.cueCard.bulletPrompts || [],
      finalInstruction: pkg.cueCard.finalInstruction || '',
    },
    questions: [pkg.cueCard.topic],
    topicProvenance: pkg.provenance?.part2Topic || 'SOURCE_PRACTICE_TOPIC',
    promptsProvenance: pkg.provenance?.part2Prompts || 'COGNITION_AUTHORED_PRACTICE',
    sampleAnswer: pkg.sampleAnswer,
  });
  if (p3.available) {
    const themes = p3.themes || [];
    parts.push({
      partNumber: 3,
      part: 3,
      title: 'Part 3 · Discussion',
      instructions: 'Discuss the questions with the examiner. Give extended, developed answers.',
      questions: themes.flatMap(t => t.questions),
      questionTopics: themes.flatMap(t => t.questions.map(() => t.theme)),
      provenanceType: p3.provenanceType,
    });
  }
  return {
    testId: pkg.id,
    id: pkg.id,
    slug: pkg.slug,
    title: `IELTS Speaking — ${pkg.cueCard.topic || 'Cue Card'}`,
    isRandomized: false,
    coverage: pkg.coverage,
    provenance: pkg.provenance || null,
    hubNumber: pkg.hubNumber,
    sampleAnswer: pkg.sampleAnswer,
    source: pkg.source,
    parts,
  };
}

export function getProductionSpeakingPackage(testId) {
  const pkg = PRODUCTION_SPEAKING.find(p =>
    p.id === testId || p.slug === testId || String(p.hubNumber) === String(testId));
  return pkg ? adaptProductionSpeaking(pkg) : null;
}

export function getRandomProductionSpeakingPackage() {
  const pool = PRODUCTION_SPEAKING;
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return adaptProductionSpeaking(pick);
}


/**
 * Writing production adapter (Phase 5).
 * Academic Writing tests with exact source prompts and Task 1 visuals/tables.
 * Full test = Task 1 + Task 2 from the SAME source package (relationship preserved);
 * practice mode may serve a single task via getProductionWritingTask.
 */
export function adaptProductionWriting(rec) {
  const resolveImage = (task) => {
    if (!task) return null;
    return {
      ...task,
      instructions: task.instructions || (task.wordLimitMin ? `Write at least ${task.wordLimitMin} words.` : ''),
      image: task.image && task.image.file
        ? { ...task.image, file: resolveMediaUrl(task.image.file) }
        : task.image,
    };
  };
  return {
    testId: rec.testId,
    id: rec.id,
    slug: rec.slug,
    title: rec.title,
    kind: rec.kind,
    isRandomized: false,
    durationMinutes: 60,
    task1: resolveImage(rec.task1),
    task2: resolveImage(rec.task2),
    source: rec.provenance || null,
  };
}

export function getProductionWritingTest(testId) {
  const rec = PRODUCTION_WRITING.find(w =>
    String(w.testId) === String(testId) || w.id === testId || w.slug === testId);
  return rec ? adaptProductionWriting(rec) : null;
}

export function getRandomProductionWritingTest() {
  if (!PRODUCTION_WRITING.length) return null;
  const rec = PRODUCTION_WRITING[Math.floor(Math.random() * PRODUCTION_WRITING.length)];
  return adaptProductionWriting(rec);
}

export function getRandomProductionWritingTask(kind) {
  // practice mode: a random verified task of the requested kind (1 or 2),
  // wrapped in a single-task test object; source package id travels with it
  const pool = PRODUCTION_WRITING.filter(w => w[kind === 1 ? 'task1' : 'task2']);
  if (!pool.length) return null;
  const rec = pool[Math.floor(Math.random() * pool.length)];
  const full = adaptProductionWriting(rec);
  return {
    ...full,
    title: `IELTS Academic Writing — Task ${kind} Practice`,
    practiceTask: kind,
    sourcePackageId: rec.id,
  };
}


/**
 * Reading production adapter (Phase 6 · contract v2).
 * The runtime bundle already carries the normalized structure (passage
 * paragraphs, question groups, option pools, stimulus segments with blank
 * tokens, one answer control per question). This adapter only maps shapes:
 * it gates answers behind includeAnswers and resolves media to R2. It never
 * parses HTML and never repairs content — broken content is quarantined in
 * content-db and never reaches the bundle.
 */
function resolvePromptHtml(html) {
  if (!html) return html;
  return html.replace(/src="(?:\.\.\/)*(\/?wp-content\/[^"]+)"/g, (m, p) => `src="${resolveMediaUrl(p.startsWith('/') ? p : `/${p}`)}"`);
}

const READING_FULL_TESTS = PRODUCTION_READING.filter(r => r.fullMockEligible && r.questionCount === 40);

function adaptReadingQuestion(q, includeAnswers) {
  return {
    ...q,
    answer: includeAnswers ? q.answer : null,
    acceptedAnswers: includeAnswers ? q.acceptedAnswers : null,
  };
}

function adaptReadingStimulus(stimulus) {
  if (!stimulus) return null;
  return {
    ...stimulus,
    blocks: stimulus.blocks.map(b => (b.type === 'image' ? { ...b, src: resolveMediaUrl(b.src) } : b)),
  };
}

export function adaptProductionReading(rec, includeAnswers = false) {
  return {
    testId: rec.testId,
    id: rec.id,
    slug: rec.slug,
    title: rec.title,
    fullMockEligible: rec.fullMockEligible,
    questionCount: rec.questionCount,
    isRandomized: false,
    durationMinutes: 60,
    passages: rec.passages.map(p => ({
      passageNumber: p.passageNumber,
      title: p.title,
      paragraphs: p.paragraphs.map(x => (x.type === 'image' ? { ...x, src: resolveMediaUrl(x.src) } : x)),
      passageText: p.passageText,
      questions: p.questions.map(q => adaptReadingQuestion(q, includeAnswers)),
      questionGroups: p.questionGroups.map(g => ({
        ...g,
        stimulus: adaptReadingStimulus(g.stimulus),
        questions: g.questions.map(q => adaptReadingQuestion(q, includeAnswers)),
      })),
    })),
    source: rec.source || null,
  };
}

export function getAllProductionReadingTests() {
  return READING_FULL_TESTS;
}

export function getProductionReadingTest(testId, includeAnswers = false) {
  const rec = READING_FULL_TESTS.find(r =>
    String(r.testId) === String(testId) || r.id === testId || r.slug === testId);
  return rec ? adaptProductionReading(rec, includeAnswers) : null;
}

/** Full Reading tests only: complete 1–40 numbering, every question keyed. */
export function getRandomProductionReadingTest(includeAnswers = false) {
  if (!READING_FULL_TESTS.length) return null;
  const rec = READING_FULL_TESTS[Math.floor(Math.random() * READING_FULL_TESTS.length)];
  return adaptProductionReading(rec, includeAnswers);
}
