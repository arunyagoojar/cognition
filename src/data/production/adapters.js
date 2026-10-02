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
} from './productionContent.js';

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
      audioFile: p.audioFile || rec.audio.appPath || null,
      audioFlags: rec.audio.flags,
      htmlContent: p.htmlContent,
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
  const cueCardLines = [
    pkg.cueCard.topic,
    ...(pkg.cueCard.bulletPrompts || []),
  ].filter(Boolean);

  return {
    testId: pkg.id,
    id: pkg.id,
    slug: pkg.slug,
    title: `IELTS Speaking — ${pkg.cueCard.topic || 'Cue Card'}`,
    isRandomized: false,
    coverage: pkg.coverage,
    hubNumber: pkg.hubNumber,
    sampleAnswer: pkg.sampleAnswer,
    source: pkg.source,
    parts: [
      {
        partNumber: 2,
        part: 2,
        title: 'Part 2 · Cue Card',
        instructions: 'Read the cue card, use the preparation time, then speak for up to two minutes.',
        cueCard: pkg.cueCard,
        questions: cueCardLines,
      },
    ],
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
