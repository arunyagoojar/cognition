// Async recording/transcription events remain attached to the answer that
// created them. A previous answer must never change the next answer's controls.
export const SPEAKING_REC_STATE = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  READY_TO_SPEAK: 'ready_to_speak',
  RECORDING: 'recording',
  TIME_REACHED: 'time_reached',
  SAVED: 'saved',
  TRANSCRIBING: 'transcribing',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export function updateSpeakingInteraction(states, questionKey, nextState) {
  return { ...states, [questionKey]: nextState };
}

export function speakingInteractionState(states, questionKey, recording) {
  return states[questionKey] || (recording
    ? recording.transcriptStatus === 'pending' ? SPEAKING_REC_STATE.TRANSCRIBING : SPEAKING_REC_STATE.COMPLETED
    : SPEAKING_REC_STATE.IDLE);
}

export function speakingPart2Controls(state) {
  return {
    notes: ['idle', 'preparing', 'ready_to_speak', 'recording', 'time_reached', 'failed'].includes(state),
    preparation: state === SPEAKING_REC_STATE.IDLE || state === SPEAKING_REC_STATE.FAILED,
    recorder: ['ready_to_speak', 'recording', 'time_reached'].includes(state),
    saved: ['saved', 'transcribing', 'completed'].includes(state),
  };
}

export function nextSpeakingPreparationSecond(secondsLeft) {
  return Math.max(0, (secondsLeft ?? 0) - 1);
}
