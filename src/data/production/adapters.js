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
        visualHtml: g.visualHtml || null,
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
 * Speaking production adapter.
 * The source corpus only provides Part 2 cue cards (Makkar-style), so coverage is
 * explicitly partial: part1/part3 are unavailable and no full Speaking band is
 * derived from a single cue-card response (evaluation engine marks such attempts
 * as 'partial' and withholds the overall band).
 */
export function adaptProductionSpeaking(pkg) {
  // Full 3-part interview shape. Per-part provenance travels with each part:
  // Part 1/Part 3 are generated practice; the Part 2 topic is authentic Makkar.
  const p1 = pkg.part1 || { available: false };
  const p3 = pkg.part3 || { available: false };
  const parts = [];
  if (p1.available) {
    parts.push({
      partNumber: 1,
      part: 1,
      title: 'Part 1 · Introduction & Interview',
      instructions: 'Answer the questions in full sentences. Approx. 4–5 minutes for this part in a real test.',
      questions: p1.topicSet?.questions || [],
      followUps: p1.topicSet?.followUps || [],
      provenanceType: p1.provenanceType,
      topicSetTopic: p1.topicSet?.topic,
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
    topicProvenance: pkg.part2?.topic?.provenanceType || 'SOURCE_PRACTICE',
    topicSource: pkg.part2?.topic?.source || null,
    sampleAnswer: pkg.sampleAnswer,
  });
  if (p3.available) {
    parts.push({
      partNumber: 3,
      part: 3,
      title: 'Part 3 · Discussion',
      instructions: 'Discuss the questions with the examiner. Give extended, developed answers.',
      questions: (p3.questions || []).map(q => q.question),
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
    category: pkg.category,
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
 * Reading production adapter (Phase 6).
 * Academic Reading tests: 3 passages, question groups, answers from the verified
 * production database. includeAnswers gates the answer key like Listening.
 */
function resolvePromptHtml(html) {
    return html.replace(/src="(\/wp-content\/[^"]+)"/g, (m, p) => `src="${resolveMediaUrl(p)}"`);
}

/**
 * Reading extraction left most question groups as plain text (structured
 * records exist only for a subset of groups). Inject answerable blanks into
 * numbered question lines so every question is enterable; qid qN matches the
 * global answer-key numbering used by structured records.
 */
function injectReadingBlanks(html) {
  if (!html || html.includes('data-qid=')) return html;
  const blank = (n) => `<span class="inline-blank"><input type="text" data-qid="q${n}" class="cognition-exam-input" style="display:inline-block;width:130px;margin:0 4px" autocomplete="off" /><b class="blank-num">${n}</b></span> `;
  // Numbered question lines appear either as their own <p> or as newline-
  // separated lines inside a paragraph: "12. text" / "12 text" / "12) text".
  return html
    .replace(/<p>(\s*)(\d{1,2})([\.\)]?)\s/g, (m, sp, num) => {
      const n = parseInt(num, 10);
      if (!Number.isInteger(n) || n < 1 || n > 40) return m;
      return `<p>${sp}${blank(n)}`;
    })
    .replace(/\n(\d{1,2})([\.\)]?)\s(?=[^\n])/g, (m, num, dot) => {
      const n = parseInt(num, 10);
      if (!Number.isInteger(n) || n < 1 || n > 40) return m;
      return `\n${blank(n)}`;
    });
}

export function adaptProductionReading(rec, includeAnswers = false) {
  return {
    testId: rec.testId,
    id: rec.id,
    slug: rec.slug,
    title: rec.title,
    kind: rec.kind,
    isRandomized: false,
    durationMinutes: 60,
    passages: rec.passages.map(p => ({
      passageNumber: p.passageNumber,
      title: p.title,
      htmlContent: injectReadingBlanks(p.htmlContent),
      questions: p.questions.map(q => ({
        ...q,
        answer: includeAnswers ? q.answer : null,
      })),
      questionGroups: p.questionGroups.map(g => ({
        groupId: g.groupId,
        groupType: g.groupType,
        instructions: g.instructions,
        options: g.options,
        htmlContent: injectReadingBlanks(g.htmlContent),
        questions: g.questions.map(q => ({
          ...q,
          answer: includeAnswers ? q.answer : null,
        })),
      })),
    })),
    source: rec.source || null,
  };
}

export function getProductionReadingTest(testId, includeAnswers = false) {
  const rec = PRODUCTION_READING.find(r =>
    String(r.testId) === String(testId) || r.id === testId || r.slug === testId);
  return rec ? adaptProductionReading(rec, includeAnswers) : null;
}

export function getRandomProductionReadingTest(includeAnswers = false) {
  if (!PRODUCTION_READING.length) return null;
  const rec = PRODUCTION_READING[Math.floor(Math.random() * PRODUCTION_READING.length)];
  return adaptProductionReading(rec, includeAnswers);
}
