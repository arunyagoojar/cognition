import React,{useSyncExternalStore} from 'react';
import {readButtonSounds,setButtonSoundsEnabled,subscribeButtonSounds} from '../../utils/buttonSounds.js';

export default function SoundToggle({showLabel=false}) {
 const enabled=useSyncExternalStore(subscribeButtonSounds,readButtonSounds,()=>true);
 return <button type="button" className={`sound-toggle ${showLabel?'with-label':''}`} role="switch" aria-checked={enabled} aria-label="Button sounds" title={`Button sounds ${enabled?'on':'off'}`} data-ui-sound="off" onClick={()=>setButtonSoundsEnabled(!enabled)}>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4z"/>{enabled?<><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></>:<path d="m16 9 5 6m0-6-5 6"/>}</svg>
  {showLabel && <span>{enabled?'On':'Off'}</span>}
 </button>;
}
