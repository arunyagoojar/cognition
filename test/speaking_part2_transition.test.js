import assert from 'node:assert/strict';
import { SPEAKING_REC_STATE as STATE, measuredSpeakingDuration, nextSpeakingPreparationSecond, speakingInteractionState, speakingPart2Controls, updateSpeakingInteraction } from '../src/utils/speakingInteraction.js';
import { speakingQuestionKey } from '../src/utils/speakingContext.js';
import { computeSpeechMetrics } from '../src/utils/speech/speechMetrics.js';
import { buildSpeakingUserPrompt } from '../src/utils/ieltsRubric.js';

// Reproduce the real race: after Next leaves the last Part 1 question,
// MediaRecorder.onstop and transcription finish in separate async callbacks.
const part1Key = speakingQuestionKey({ partNumber: 1 }, 11);
const part2Key = speakingQuestionKey({ partNumber: 2 }, 0);
let states = updateSpeakingInteraction({}, part1Key, STATE.RECORDING);
let recordings = {};
assert.equal(speakingInteractionState(states, part2Key), STATE.IDLE);
recordings[part1Key] = { recordingId: 'saved-first-part', transcriptStatus: 'pending', transcript: '' };
states = updateSpeakingInteraction(states, part1Key, STATE.TRANSCRIBING);
assert(speakingPart2Controls(speakingInteractionState(states, part2Key, recordings[part2Key])).preparation);
assert(speakingPart2Controls(speakingInteractionState(states, part2Key, recordings[part2Key])).notes);

// Starting preparation must continue while the previous part transcribes.
states = updateSpeakingInteraction(states, part2Key, STATE.PREPARING);
recordings[part1Key] = { ...recordings[part1Key], transcriptStatus: 'done', transcript: 'My final answer from Part 1 is preserved.' };
states = updateSpeakingInteraction(states, part1Key, STATE.COMPLETED);
assert.equal(speakingInteractionState(states, part2Key), STATE.PREPARING);
assert(speakingPart2Controls(speakingInteractionState(states, part2Key)).notes);

let secondsLeft = 60;
for (let i = 0; i < 60; i++) {
  secondsLeft = nextSpeakingPreparationSecond(secondsLeft);
  if (secondsLeft === 0) states = updateSpeakingInteraction(states, part2Key, STATE.READY_TO_SPEAK);
}
assert.equal(secondsLeft, 0);
assert.equal(speakingInteractionState(states, part2Key), STATE.READY_TO_SPEAK);
assert(speakingPart2Controls(speakingInteractionState(states, part2Key)).recorder, 'Start speaking must appear when preparation expires');
assert.equal(recordings[part1Key].transcript, 'My final answer from Part 1 is preserved.');
assert(speakingPart2Controls(STATE.FAILED).preparation, 'a microphone error must offer recovery controls');
assert.equal(speakingInteractionState({}, part2Key, { transcriptStatus: 'pending' }), STATE.TRANSCRIBING);
assert.equal(speakingInteractionState({}, part2Key, { transcriptStatus: 'done' }), STATE.COMPLETED);
console.log('✓ Part 1 → Part 2 keeps preparation visible through late recording/transcription callbacks and shows recording after timer expiry');

const shortAnswer = 'I take the bus because it is convenient and affordable.';
for (const recording of [{}, { duration: 0 }, { duration: -10 }, { duration: Infinity }, { duration: NaN }]) {
  const duration = measuredSpeakingDuration(recording);
  assert.equal(duration, 0, 'unknown timing must never become an invented 30-second recording');
  assert.equal(computeSpeechMetrics({ text: shortAnswer, durationSec: duration }).wordsPerMinute, null, 'unknown duration cannot invent a pace');
  const prompt = buildSpeakingUserPrompt({ transcripts: { '0_0': shortAnswer }, durations: { '0_0': duration } });
  assert(prompt.includes('n/a'), 'the provider must see pace as unavailable');
  assert(!prompt.includes(' | 30 | '));
}
assert.equal(measuredSpeakingDuration({ duration: 8.5 }), 8.5, 'a short measured Part 1 response keeps its actual duration');
assert.equal(computeSpeechMetrics({ text: shortAnswer, durationSec: measuredSpeakingDuration({ duration: 8.5 }) }).wordsPerMinute, 71);
assert.equal(computeSpeechMetrics({ text: shortAnswer, durationSec: 0, segments: [{ start: 1, end: 9.5 }] }).durationSec, 8.5, 'real segment timing remains usable without a recording duration');
console.log('✓ delivery metrics preserve short measured answers and never fabricate timing or words-per-minute for unknown durations');
