import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
try {
 await page.addInitScript(()=>{
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'English',lang:'en-GB',localService:true}],addEventListener(){},removeEventListener(){},cancel(){},speak(speech){setTimeout(()=>speech.onend?.(),20);}}});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 });
 const url=process.env.SPELLING_BEE_URL || 'http://127.0.0.1:5173/qa/spelling-bee.html';await page.goto(url);
 await page.getByRole('button',{name:'Start Spelling Bee'}).waitFor();
 // Valid completed history: because was learned in session 1 and passed
 // spaced checks in 7 and 13. Five intervening sessions have now elapsed.
 await page.evaluate(async()=>{
  const {SPELLING_WORDS}=await import('/src/data/spelling/words.js');
  const filler=SPELLING_WORDS.filter(word=>word.word!=='because').slice(0,29).map(word=>({word:word.word,answer:'misspelled',correct:false,timedOut:false,responseTimeMs:1000}));
  const alternate=SPELLING_WORDS.find(word=>word.word!=='because' && !filler.some(row=>row.word===word.word)).word;
  const rows=Array.from({length:18},(_,index)=>({id:`schedule_${String(index+1).padStart(3,'0')}`,kind:'session',source:'spelling-bee',policyVersion:2,completedAt:new Date(Date.UTC(2026,9,index+1)).toISOString(),results:[{word:[1,7,13].includes(index+1)?'because':alternate,answer:[1,7,13].includes(index+1)?'because':'misspelled',correct:[1,7,13].includes(index+1),responseTimeMs:1000,timedOut:false},...filler]}));
  localStorage.setItem('cognition_spelling_v1:local-spelling-review',JSON.stringify(rows));
 });
 await page.reload();await page.getByRole('button',{name:'Start Spelling Bee'}).click();
 const score=page.locator('.bee-score-card');
 const spacing=await score.evaluate(el=>({gap:el.querySelector('button').getBoundingClientRect().top-el.querySelector('p').getBoundingClientRect().bottom,height:el.getBoundingClientRect().height}));
 assert(spacing.gap>=20,'score action has clear space below its description');assert(spacing.height<450,'score card is not stretched to word-bank height');
 await page.getByText('Occasional checks',{exact:true}).click();assert((await page.locator('.bee-bank').last().innerText()).includes('because'));
 assert((await page.locator('.bee-bank').last().innerText()).includes('2/3 checks'));
 await page.clock.install();await page.getByRole('button',{name:'Start a practice session'}).click();
 const draft=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cognition_draft_v2:local-spelling-review:spelling-bee')).data);
 let saved=await draft();assert(saved.words.some(word=>word.word==='because'));
 for(let index=0;index<30;index++) {
  await page.clock.runFor(500);saved=await draft();assert.equal(saved.results.length,index);
  await page.getByLabel('Your spelling').fill(saved.words[index].word);
  if(index%2)await page.getByLabel('Your spelling').press('Enter');else await page.getByRole('button',{name:'Submit spelling'}).click();
  await page.clock.runFor(900);
 }
 await page.getByRole('heading',{name:'Your spelling snapshot.'}).waitFor();
 const retired=page.locator('.bee-result-list').filter({has:page.getByRole('heading',{name:'Removed from your word bank'})});
 assert((await retired.innerText()).includes('because'));assert.equal(await retired.locator('li').count(),1);
 await page.getByRole('button',{name:'Back to Spelling Bee',exact:true}).click();
 await page.getByText('Words to practise',{exact:true}).click();await page.getByText('Occasional checks',{exact:true}).click();
 assert(!(await page.locator('.bee-bank').allTextContents()).some(text=>text.includes('because')),'retired word is absent from both active bank lists');
 await page.getByRole('button',{name:'Start a practice session'}).click();saved=await draft();assert.equal(saved.words.length,30);assert(!saved.words.some(word=>word.word==='because'),'retired word is not reintroduced in the next test');
 assert.deepEqual(errors,[]);
 console.log('Browser scheduling passed: due review, third successful spaced check, retired-word summary, removal from active bank, and exclusion from the next 30-word session.');
}finally{await browser.close();}
