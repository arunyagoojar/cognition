import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shots=process.env.QA_SCREENSHOTS;
try {
 await page.addInitScript(()=>{
  window.__tones=[];window.__gains=[];window.__contexts=0;window.__speechActive=false;
  Object.defineProperty(window,'speechSynthesis',{value:{get speaking(){return window.__speechActive;},pending:false}});
  window.AudioContext=class {
   constructor(){window.__contexts++;this.currentTime=0;this.state='running';this.destination={};}
   createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(){window.__tones.push(true);},stop(){this.onended?.();}};}
   createGain(){return{gain:{setValueAtTime(v){window.__gains.push(v);},exponentialRampToValueAtTime(v){window.__gains.push(v);}},connect(){},disconnect(){}};}
   close(){return Promise.resolve();}
  };
 });
 await page.goto('http://127.0.0.1:5173/qa/appearance.html?theme=light');
 await page.getByRole('heading',{name:'questionnaire',exact:true}).waitFor();
 assert.equal(await page.locator('.bee-missing-slot').count(),2);
 assert.equal(await page.locator('.bee-compared-word .is-match').allTextContents().then(a=>a.join('')),'questionare');
 assert((await page.locator('.bee-comparison-help').innerText()).includes('missing “i”'));
 const colors=await page.locator('.hub-feature-card').evaluateAll(cards=>cards.slice(0,2).map(el=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
  context.fillStyle=getComputedStyle(el).backgroundColor;context.fillRect(0,0,1,1);
  return [...context.getImageData(0,0,1,1).data];
 }));
 for(const [i,base] of [[0,[190,148,245]],[1,[252,204,66]]]) {
  assert(colors[i].slice(0,3).every((value,j)=>Math.abs(value-base[j])<=3),'same accent hue');
  assert(colors[i][3]>100 && colors[i][3]<220,'coloured cards are visibly translucent');
 }
 assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(247, 247, 245)');
 const navSizes=await page.locator('header').evaluate(header=>{const gear=header.querySelector('.nav-settings-btn'),signIn=header.querySelector('.nav-signin-btn'),a=gear.getBoundingClientRect(),b=signIn.getBoundingClientRect();return {width:a.width,gear:a.height,signIn:b.height,radius:getComputedStyle(gear).borderRadius};});
 assert(Math.abs(navSizes.width-navSizes.gear)<1 && Math.abs(navSizes.gear-navSizes.signIn)<1,'Settings is circular and matches Sign In height');assert.equal(navSizes.radius,'50%');
 const unlock=await page.locator('.practice-thumbnail-unlock .practice-unlock-skills button').evaluateAll(buttons=>buttons.map(button=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(button).backgroundColor;ctx.fillRect(0,0,1,1);const rect=button.getBoundingClientRect();return {color:[...ctx.getImageData(0,0,1,1).data],width:rect.width,height:rect.height};
 }));
 for(const [i,expected] of [[0,[190,148,245]],[1,[252,204,66]],[2,[255,234,228]],[3,[255,255,255]]]) { assert(unlock[i].color.slice(0,3).every((value,j)=>Math.abs(value-expected[j])<=3),'unlock button uses its practice-card colour');assert(unlock[i].width<150 && unlock[i].height<=40,'unlock controls are compact chips'); }
 const halos=await page.locator('.hub-feature-card').evaluateAll(cards=>cards.map(el=>{
  const colors=getComputedStyle(el).boxShadow.match(/rgba?\([^)]*\)|color\([^)]*\)/g);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');context.fillStyle=colors.at(-1);context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data];
 }));
 for(const [index,expected] of [[0,[190,148,245]],[1,[252,204,66]],[2,[255,255,255]]])assert(halos[index].slice(0,3).every((value,j)=>Math.abs(value-expected[j])<=4),'painted haze matches each card colour');
 const haloRoom=await page.locator('.practice-thumbnail-rail').evaluate(rail=>{const card=rail.firstElementChild.getBoundingClientRect(),bounds=rail.getBoundingClientRect();return {top:card.top-bounds.top,bottom:bounds.bottom-card.bottom};});
 assert(haloRoom.top>=28 && haloRoom.bottom>=28,'rail leaves paint room around the card halo');
 assert.equal(await page.locator('header').getByRole('switch').count(),0,'sound control belongs in Settings');
 await page.getByRole('button',{name:/^Lessons/}).click();
 assert.equal(await page.evaluate(()=>window.__tones.length),1);
 assert(await page.evaluate(()=>Math.max(...window.__gains)<=.018),'quiet gain envelope');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByRole('switch',{name:'Button sounds'}).getAttribute('aria-checked'),'true');
 await page.getByRole('switch',{name:'Button sounds'}).click();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const mutedTones=await page.evaluate(()=>window.__tones.length);
 await page.getByRole('button',{name:/^Lessons/}).click();
 assert.equal(await page.evaluate(()=>window.__tones.length),mutedTones,'muted buttons produce no tone');
 await page.reload();await page.getByRole('heading',{name:'questionnaire',exact:true}).waitFor();
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert.equal(await page.getByRole('switch',{name:'Button sounds'}).getAttribute('aria-checked'),'false','mute survives reload');
 await page.getByRole('switch',{name:'Button sounds'}).click();
 await page.getByRole('button',{name:'Close',exact:true}).click();
 const enabledTones=await page.evaluate(()=>window.__tones.length);
 await page.evaluate(()=>window.__speechActive=true);await page.getByRole('button',{name:/^Lessons/}).click();
 assert.equal(await page.evaluate(()=>window.__tones.length),enabledTones,'speech is not interrupted by click tones');
 await page.evaluate(()=>{window.__speechActive=false;document.body.dataset.recording='true';});await page.getByRole('button',{name:/^Lessons/}).click();
 assert.equal(await page.evaluate(()=>window.__tones.length),enabledTones,'no click tones while recording');
 await page.evaluate(()=>delete document.body.dataset.recording);
 const tips=page.getByRole('button',{name:/^Tips & Strategies/});
 await tips.hover();await page.waitForTimeout(200);
 assert.equal(await tips.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','Tips hover label is white on its dark fill');
 assert.equal(await tips.evaluate(el=>getComputedStyle(el).translate),'0px -1px','shared subtle hover motion');
 const mock=page.getByRole('button',{name:/^Start Test/});
 const buttonStyles=await page.locator('.btn-coral-pill-sm').evaluateAll(buttons=>buttons.map(button=>{const style=getComputedStyle(button);return [style.borderRadius,style.padding,style.fontSize].join('|');}));assert.equal(new Set(buttonStyles).size,1,'mock CTA uses the same pill style as Continue buttons');
 await mock.hover();await page.waitForTimeout(200);
 assert.equal(await mock.evaluate(el=>getComputedStyle(el).translate),'none','mock hover keeps its paint layer stationary');
 assert.equal(await page.locator('.afu-practice').evaluate(el=>getComputedStyle(el).animationFillMode),'backwards','entrance compositing layer is released');
 assert(await mock.evaluate(el=>getComputedStyle(el).borderTopStyle!=='none' && parseFloat(getComputedStyle(el).borderTopWidth)>=1),'mock CTA retains its outline on hover');
 assert((await mock.evaluate(el=>getComputedStyle(el).boxShadow)).includes('inset'),'hover retains glass rim');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 assert((await page.getByRole('dialog',{name:'Settings'}).evaluate(el=>getComputedStyle(el).backdropFilter)).includes('32px'));
 if(shots)await page.screenshot({path:`${shots}/settings-light-glass.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 if(shots)await page.screenshot({path:`${shots}/appearance-light-desktop.png`,fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(shots)await page.screenshot({path:`${shots}/appearance-light-mobile.png`,fullPage:true,animations:'disabled'});
 await page.emulateMedia({contrast:'more'});
 assert.equal(await page.locator('.hub-feature-card').first().evaluate(el=>getComputedStyle(el).backdropFilter),'none');
 assert.equal(await page.locator('.hub-feature-card').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(190, 148, 245)');
 assert.equal(await page.locator('.insight-panel').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
 await page.emulateMedia({contrast:'no-preference'});await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://127.0.0.1:5173/qa/appearance.html?theme=dark');await page.getByRole('heading',{name:'questionnaire',exact:true}).waitFor();
 assert.equal(await page.locator('.practice-thumbnail-unlock .practice-unlock-skills button').first().evaluate(el=>getComputedStyle(el).color),'rgb(244, 243, 240)','unlock buttons adapt to dark mode');
 const mockCard=page.locator('.mock-card-dark-hero');await mockCard.scrollIntoViewIfNeeded();await mockCard.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));const before=await mockCard.evaluate(el=>el.getBoundingClientRect().top+scrollY);await mockCard.hover();await page.waitForTimeout(200);const after=await mockCard.evaluate(el=>el.getBoundingClientRect().top+scrollY);assert(Math.abs(before-after)<1,'glass card does not jump or expose its old edge on hover');
 assert((await mockCard.evaluate(el=>getComputedStyle(el).boxShadow)).includes('inset'));
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 if(shots)await page.screenshot({path:`${shots}/settings-dark-glass.png`,animations:'disabled'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 if(shots)await page.screenshot({path:`${shots}/appearance-dark-desktop.png`,fullPage:true,animations:'disabled'});
 // Composite panel fills over the canvas, including the strongest glass sheen.
 const contrasts=await page.evaluate(()=>{
  const rgb=s=>s.match(/[\d.]+/g).map(Number);
  const over=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
  const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  const canvas=rgb(getComputedStyle(document.body).backgroundColor);
  return [...document.querySelectorAll('.hub-feature-card')].map(card=>{
   const bg=over(rgb(getComputedStyle(card).backgroundColor),canvas),bright=over([255,255,255,.04],bg);
   return Math.min(...[bg,bright].map(fill=>ratio(rgb(getComputedStyle(card.querySelector('.hub-feature-desc')).color),fill)));
  });
 });
 assert(contrasts.every(r=>r>=4.5),`dark card text contrast: ${contrasts}`);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(shots)await page.screenshot({path:`${shots}/appearance-dark-mobile.png`,fullPage:true,animations:'disabled'});
 await page.emulateMedia({contrast:'more',reducedMotion:'reduce'});
 assert.equal(await page.locator('.hub-feature-card').first().evaluate(el=>getComputedStyle(el).backdropFilter),'none');
 assert.equal(await page.locator('.hub-feature-card').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 32, 47)');
 assert.deepEqual(errors,[]);
 console.log(`Appearance passed: light palette, spelling alignment, dark contrast (${contrasts.map(n=>n.toFixed(1)).join(', ')}:1), mobile layout, solid high-contrast fallback, quiet click envelope, persistent mute, and speech/recording suppression. Web Audio instrumented.`);
}finally{await browser.close();}
