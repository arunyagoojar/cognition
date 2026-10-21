import assert from 'node:assert/strict';
import {pronounceWord} from '../src/utils/spelling/speech.js';
const spoken=[];let completed=0,failed=0;
class Utterance{constructor(text){this.text=text;}}
const synthesis={cancel(){},speak(utterance){spoken.push(utterance);}};
const cancel=pronounceWord({word:'because',voice:{name:'English',lang:'en-GB'},repetitions:2,synthesis,Utterance,onComplete:()=>completed++,onError:()=>failed++});
assert.equal(spoken.length,1);spoken[0].onend();assert.equal(completed,0,'the first utterance cannot start the answer timer');
await new Promise(resolve=>setTimeout(resolve,370));assert.equal(spoken.length,2);assert.equal(spoken[1].text,'because');spoken[1].onend();assert.equal(completed,1);cancel();assert.equal(failed,0);
const stop=pronounceWord({word:'friend',voice:{lang:'en-GB'},repetitions:2,synthesis,Utterance,onComplete:()=>completed++,onError:()=>failed++});
const interrupted=spoken.at(-1);stop();interrupted.onend();interrupted.onerror();assert.equal(completed,1);assert.equal(failed,0,'cancelled playback cannot trigger callbacks after leaving a word');
pronounceWord({word:'people',voice:{lang:'en-GB'},repetitions:2,synthesis:{cancel(){},speak(){throw new Error('Autoplay blocked');}},Utterance,onComplete:()=>completed++,onError:()=>failed++});assert.equal(failed,1);
console.log('Spelling speech passed: exactly two sequential pronunciations, completion after both, cancellation, and autoplay failure.');
