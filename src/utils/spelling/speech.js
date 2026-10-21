// A word is spoken twice on entry; the caller starts its deadline only after
// both utterances finish. Replays never replace an existing answer deadline.
export function pronounceWord({word,voice,repetitions=1,onComplete,onError,synthesis=window.speechSynthesis,Utterance=window.SpeechSynthesisUtterance}) {
 let cancelled=false,watchdog,gap,current,remaining=repetitions;
 const fail=()=>{if(cancelled)return;cancelled=true;clearTimeout(watchdog);clearTimeout(gap);synthesis.cancel();onError();};
 const speak=()=>{
  if(cancelled)return;
  const utterance=new Utterance(word);current=utterance;
  utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.85;
  let ended=false;
  utterance.onend=()=>{
   if(cancelled || ended || current!==utterance)return;
   ended=true;clearTimeout(watchdog);remaining--;
   if(remaining)gap=setTimeout(speak,350);
   else {cancelled=true;onComplete();}
  };
  utterance.onerror=fail;
  watchdog=setTimeout(fail,10000);
  try{synthesis.speak(utterance);}catch{fail();}
 };
 synthesis.cancel();speak();
 return ()=>{cancelled=true;clearTimeout(watchdog);clearTimeout(gap);synthesis.cancel();};
}
