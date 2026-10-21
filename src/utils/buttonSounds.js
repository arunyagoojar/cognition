const STORAGE_KEY='cognition_interface_sounds';
const CHANGE_EVENT='cognition:interface-sounds';

export function buttonSoundsEnabled() {
 try{return localStorage.getItem(STORAGE_KEY)!=='off';}catch{return true;}
}
export function setButtonSoundsEnabled(enabled) {
 try{localStorage.setItem(STORAGE_KEY,enabled?'on':'off');}catch{/* Keep the current page preference when storage is unavailable. */}
 currentPreference=enabled;
 window.dispatchEvent(new Event(CHANGE_EVENT));
}
let currentPreference;
export const readButtonSounds=()=>currentPreference ?? buttonSoundsEnabled();
export function subscribeButtonSounds(callback) {
 const update=()=>{currentPreference=undefined;callback();};
 const localUpdate=()=>callback();
 window.addEventListener(CHANGE_EVENT,localUpdate);window.addEventListener('storage',update);
 return()=>{window.removeEventListener(CHANGE_EVENT,localUpdate);window.removeEventListener('storage',update);};
}

// Local synthesis avoids downloaded assets, requests, and any speech interruption.
// Capture the click once, including buttons whose handlers stop propagation.
export function installButtonSounds() {
 let context,lastClick=-Infinity;
 const play=event=>{
  if(!event.isTrusted || !readButtonSounds())return;
  const button=event.target.closest?.('button,[role="button"],[role="tab"],[role="switch"],input[type="submit"],input[type="button"]');
  if(!button || button.disabled || button.getAttribute('aria-disabled')==='true' || button.closest('[inert]') || button.dataset.uiSound==='off')return;
  // Keep pronunciation, listening audio, and microphone recordings clear.
  if(window.speechSynthesis?.speaking || window.speechSynthesis?.pending || document.querySelector('[data-recording="true"]'))return;
  if([...document.querySelectorAll('audio,video')].some(media=>!media.paused && !media.ended && !media.muted))return;
  if(performance.now()-lastClick<60)return;
  lastClick=performance.now();
  try {
   const Audio=window.AudioContext || window.webkitAudioContext;
   if(!Audio)return;
   context ??=new Audio();
   if(context.state==='suspended')void context.resume().catch(()=>{});
   const tone=context.createOscillator(),volume=context.createGain(),start=context.currentTime;
   tone.type='sine';tone.frequency.setValueAtTime(620,start);tone.frequency.exponentialRampToValueAtTime(300,start+.035);
   volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(.018,start+.004);volume.gain.exponentialRampToValueAtTime(.0001,start+.04);
   tone.connect(volume);volume.connect(context.destination);
   tone.onended=()=>{tone.disconnect();volume.disconnect();};
   tone.start(start);tone.stop(start+.045);
  }catch{/* Optional feedback must never prevent an interaction. */}
 };
 document.addEventListener('click',play,true);
 return()=>{document.removeEventListener('click',play,true);void context?.close().catch(()=>{});};
}
