import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const url=process.env.SPELLING_BEE_URL || 'http://127.0.0.1:5173/qa/spelling-bee.html';
const shots=process.env.QA_SCREENSHOTS;
try {
 await page.addInitScript(()=>{
  const listeners=new Map();window.__spokenWords=[];
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Test English',lang:'en-GB',localService:true}],addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),cancel(){},speak(speech){window.__spokenWords.push(speech.text);setTimeout(()=>speech.onend?.(),40);}}});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 });
 await page.goto(url);
 await page.getByRole('button',{name:'Start Spelling Bee'}).waitFor();
 assert.equal(await page.locator('.hub-cards-stack > .hub-feature-card').count(),3);
 assert.equal(await page.locator('.hub-feature-card').first().getByRole('button').count(),2);
 if(shots)await page.screenshot({path:`${shots}/bee-dashboard.png`,fullPage:true});
 await page.getByRole('button',{name:'Start Spelling Bee'}).click();
 await page.clock.install();
 await page.getByRole('button',{name:'Take your first spelling test'}).click();
 const draft=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cognition_draft_v2:local-spelling-review:spelling-bee')).data);
 let saved=await draft();assert.equal(saved.words.length,30);assert(['ready','speaking'].includes(saved.stage));
 assert.equal(await page.getByLabel('Your spelling').isDisabled(),true);
 assert.equal(await page.getByText('because',{exact:true}).count(),0,'answer stays hidden before submission');
 await page.clock.runFor(100);assert.equal(await page.getByLabel('Your spelling').isDisabled(),true);assert.equal((await draft()).deadline,null);
 await page.clock.runFor(400);assert.equal(await page.evaluate(()=>window.__spokenWords.length),2);
 assert.equal(await page.getByLabel('Your spelling').isEnabled(),true);
 assert.equal(await page.locator('form button').count(),1);assert.equal(await page.getByRole('button',{name:/^(Unsure|Confident)$/}).count(),0);
 assert(await page.getByLabel('Your spelling').evaluate(el=>parseFloat(getComputedStyle(el).borderBottomWidth)>0),'the typing area has a visible boundary');
 if(shots)await page.screenshot({path:`${shots}/bee-test.png`,fullPage:true});
 await page.getByLabel('Your spelling').fill('becaus');await page.getByRole('button',{name:'Submit spelling'}).click();
 assert.equal(await page.getByRole('heading',{name:'because',exact:true}).count(),1);
 await page.getByRole('heading',{name:'Meaning',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Roots & origin',exact:true}).count(),1);
 assert.equal(await page.locator('.bee-chunks').innerText(),'be\ncause');assert(await page.getByRole('link',{name:'English Wiktionary',exact:true}).count()>0);
 await page.clock.fastForward(30000);assert.equal((await draft()).results.length,1,'review stays untimed');
 if(shots)await page.screenshot({path:`${shots}/bee-review.png`,fullPage:true});
 await page.getByRole('button',{name:'Next word'}).click();
 // Timeout is an incorrect answer, even if the typed spelling would have matched.
 await page.clock.runFor(500);
 await page.getByLabel('Your spelling').fill('friend');await page.clock.fastForward(10100);
 assert.equal(await page.getByText('TIME’S UP',{exact:true}).count(),1);assert.equal((await draft()).results.at(-1).correct,false);
 await page.getByRole('button',{name:'Next word'}).click();
 // Replaying does not buy another ten seconds.
 await page.clock.runFor(500);
 const deadline=(await draft()).deadline;await page.clock.fastForward(4000);
 await page.getByRole('button',{name:'Listen to word',exact:true}).click();await page.clock.runFor(60);assert.equal((await draft()).deadline,deadline);
 await page.getByLabel('Your spelling').fill('people');await page.getByLabel('Your spelling').press('Enter');assert((await draft()).results.at(-1).responseTimeMs>=4000);assert((await draft()).results.at(-1).responseTimeMs<=5000);assert(!('confidence' in (await draft()).results.at(-1)));assert.equal(await page.locator('.bee-is-correct').count(),1);await page.clock.runFor(900);
 // Finish all 30, including an incorrect final answer (which must still show notes).
 for(let index=3;index<30;index++) {
  saved=await draft();assert.equal(saved.results.length,index);
  await page.clock.runFor(500);
  await page.getByLabel('Your spelling').fill(index===29?'wrong':saved.words[index].word);
  if(index===3)await page.clock.runFor(5500);
  await page.getByRole('button',{name:'Submit spelling'}).click();
  if(index===29){await page.getByRole('heading',{name:'psychology',exact:true}).waitFor();assert((await page.locator('.bee-note-grid').innerText()).includes('ψυχή'));await page.getByRole('button',{name:'See my summary'}).click();}
  else await page.clock.runFor(900);
 }
 await page.getByRole('heading',{name:'Your spelling snapshot.'}).waitFor();
 assert.equal((await draft()).results.length,30);assert.equal((await draft()).policyVersion,2);assert((await draft()).results.every(row=>Number.isInteger(row.responseTimeMs)));assert((await draft()).results[3].responseTimeMs>5000);
 assert.equal(await page.locator('.bee-summary-score>strong').innerText(),'8.1/9');
 assert.equal(await page.locator('.bee-result-list').count(),5);
 if(shots)await page.screenshot({path:`${shots}/bee-summary.png`,fullPage:true});
 const activities=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cognition_spelling_v1:local-spelling-review') || '[]'));
 assert.equal((await activities()).filter(r=>r.kind==='session').length,1);
 await page.reload();await page.getByRole('button',{name:'Start Spelling Bee'}).click();await page.getByRole('heading',{name:'Your spelling snapshot.'}).waitFor();assert.equal((await activities()).filter(r=>r.kind==='session').length,1,'refresh cannot duplicate score');
 await page.getByRole('button',{name:'Practise another 30'}).click();saved=await draft();assert.equal(saved.words.length,30);assert(new Set(saved.words.map(w=>w.word)).size===30);assert(saved.words.some(w=>w.word==='because'));assert(!saved.words.some(w=>w.word==='people'),'quick correct words are skipped during cooldown');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(shots)await page.screenshot({path:`${shots}/bee-mobile.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.clock.runFor(500);
 if(shots)await page.screenshot({path:`${shots}/bee-dark.png`,fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Restore active answer timer on refresh, including an expired deadline.
 await page.clock.runFor(500);
 await page.evaluate(()=>{const key='cognition_draft_v2:local-spelling-review:spelling-bee';const d=JSON.parse(localStorage.getItem(key));d.data.deadline=Date.now()-1;localStorage.setItem(key,JSON.stringify(d));});
 await page.reload();await page.getByRole('button',{name:'Start Spelling Bee'}).click();await page.getByText('TIME’S UP',{exact:true}).waitFor();
 assert.equal((await draft()).results.length,1);
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Start Spelling Bee'}).waitFor();assert.equal(await page.locator('.hub-spelling-score strong').innerText(),'8.1/9');
 if(shots)await page.screenshot({path:`${shots}/bee-dashboard-score.png`,fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: combined cards, 30-word test, hidden answers, speech timing, automatic response timing, one submit button, correct/incorrect feedback, timeout, untimed reviews, final-word notes, score persistence, fresh rotation, expired refresh, mobile and dark mode. Audio mocked for deterministic timing.');
}catch(error){console.log(errors);console.log(await page.locator('body').innerText());throw error;}finally{await browser.close();}
