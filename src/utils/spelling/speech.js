// A word is spoken twice on entry; the caller starts its deadline only after
// both utterances finish. Replays never replace an existing answer deadline.

// Filter out legacy robotic synthesizers and novelty voices that distort speech clarity.
export const NOVELTY_VOICE_REGEX = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|zarvox|wobble)$/i;

export function isUsableVoice(voice) {
 if (!voice || !voice.name) return false;
 if (!/^en/i.test(voice.lang || '')) return false;
 if (NOVELTY_VOICE_REGEX.test(voice.name.trim())) return false;
 return true;
}

export function getEnglishVoices(voices = []) {
 if (!Array.isArray(voices)) return [];
 return voices.filter(isUsableVoice);
}

// Resolves the preferred voice:
// By default, system or browser text-to-speech is used.
// If a specific voiceId was selected, it matches against the available English voices.
export function resolveVoice(voices = [], voiceId = 'system-default') {
 const english = getEnglishVoices(voices);
 if (voiceId && voiceId !== 'system-default') {
  const matched = english.find(v => (v.voiceURI || v.name) === voiceId);
  if (matched) return matched;
 }
 const systemDefault = english.find(v => v.default);
 if (systemDefault) {
  return { ...systemDefault, isSystemDefault: true, name: 'System / Browser default' };
 }
 return { name: 'System / Browser default', lang: 'en-US', default: true, isSystemDefault: true };
}

export function pronounceWord({
 word,
 voice,
 repetitions = 1,
 onComplete,
 onError,
 synthesis = (typeof window !== 'undefined' ? window.speechSynthesis : null),
 Utterance = (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null)
}) {
 let cancelled = false, watchdog, gap, current, remaining = repetitions;
 const fail = () => {
  if (cancelled) return;
  cancelled = true;
  clearTimeout(watchdog);
  clearTimeout(gap);
  synthesis?.cancel();
  onError();
 };
 const speak = () => {
  if (cancelled || !synthesis || !Utterance) return;
  const utterance = new Utterance(word);
  current = utterance;
  // If a specific non-default voice was chosen, assign it.
  // Otherwise, leaving utterance.voice = null signals the browser to use its native
  // system/browser text-to-speech engine.
  if (voice && !voice.isSystemDefault && (voice.voiceURI || (typeof SpeechSynthesisVoice !== 'undefined' && voice instanceof SpeechSynthesisVoice))) {
   try { utterance.voice = voice; } catch { /* ignore */ }
  } else if (voice && !voice.isSystemDefault && voice.name && !voice.default) {
   try { utterance.voice = voice; } catch { /* ignore */ }
  } else {
   try { utterance.voice = null; } catch { /* ignore */ }
  }
  utterance.lang = voice?.lang || 'en-US';
  // Rate 0.95 gives articulate phoneme separation without robotic slurring or time-stretching.
  utterance.rate = 0.95;
  let ended = false;
  utterance.onend = () => {
   if (cancelled || ended || current !== utterance) return;
   ended = true;
   clearTimeout(watchdog);
   remaining--;
   if (remaining) gap = setTimeout(speak, 350);
   else { cancelled = true; onComplete(); }
  };
  utterance.onerror = fail;
  watchdog = setTimeout(fail, 10000);
  try { synthesis.speak(utterance); } catch { fail(); }
 };
 synthesis?.cancel();
 speak();
 return () => {
  cancelled = true;
  clearTimeout(watchdog);
  clearTimeout(gap);
  synthesis?.cancel();
 };
}
