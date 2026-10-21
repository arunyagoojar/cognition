// Tests the real app entry, with real signed-out Clerk state (no auth bypass).
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const page=await browser.newPage();const errors=[],spellingRequests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(request.url().includes('/api/spelling/'))spellingRequests.push(request.url());});
const origin=process.env.SPELLING_GUEST_URL || 'http://127.0.0.1:5173';
try {
 await page.addInitScript(()=>{
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Test English',lang:'en-GB',localService:true}],addEventListener(){},removeEventListener(){},cancel(){},speak(speech){setTimeout(()=>speech.onend?.(),20);}}});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 });
 await page.goto(origin);
 await page.getByRole('button',{name:'Start Spelling Bee'}).click();
 await page.getByText('Guest mode · Your spelling scores and word bank are saved on this device.').waitFor();
 assert(!await page.getByRole('button',{name:'Sign in to start'}).count());
 await page.getByRole('button',{name:'Take your first spelling test'}).click();
 await page.waitForFunction(()=>!document.querySelector('#bee-answer')?.disabled);
 await page.getByLabel('Your spelling').fill('becaus');
 await page.getByRole('button',{name:'Check spelling'}).click();
 await page.getByRole('heading',{name:'because',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cognition_draft_v2:guest:spelling-bee')).data.results[0].correct),false);
 // A direct visit also works without a session or sign-in dialog.
 await page.goto(`${origin}/#/spelling-bee`);
 await page.getByRole('heading',{name:'because',exact:true}).waitFor();
 await page.getByRole('button',{name:'Next word'}).click();
 await page.waitForFunction(()=>!document.querySelector('#bee-answer')?.disabled);
 assert.deepEqual(spellingRequests,[],'guest practice never accesses authenticated spelling endpoints');
 assert.deepEqual(errors,[]);
 console.log('Real app guest checks passed: dashboard entry, no sign-in, audio/answer/review, guest draft persistence, direct route, and no authenticated spelling requests.');
}finally{await browser.close();}
