import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{channel:'chrome'}),headless:true});
try {
 for(const theme of ['dark','light']) {
  const page=await browser.newPage({viewport:{width:1000,height:800}});
  await page.addInitScript(value=>localStorage.setItem('omniprep_theme',value),theme);
  let holdMain;
  const requested=new Promise(resolve=>{holdMain=resolve;});
  await page.route(/\/src\/main\.jsx(?:\?|$)/,route=>holdMain(route));
  // Hold external auth initialization to exercise the actual startup screen.
  await page.route(/https:\/\/[^/]*clerk[^/]*\//,()=>{});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'commit'});
  const main=await requested;
  const expected=theme==='dark'?'rgb(12, 13, 15)':'rgb(247, 247, 245)';
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme,'theme precedes application JavaScript');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),expected,'initial HTML canvas matches the saved theme');
  await main.continue();
  await page.locator('.app-boot-screen').waitFor();
  assert.equal(await page.locator('.app-boot-screen').evaluate(el=>getComputedStyle(el).backgroundColor),expected,'auth loader matches theme');
  if(process.env.QA_SCREENSHOTS)await page.screenshot({path:`${process.env.QA_SCREENSHOTS}/loading-${theme}.png`,animations:'disabled'});
  await page.goto(`http://127.0.0.1:5173/qa/appearance.html?theme=${theme}&loading=page`);
  await page.locator('.page-loading').waitFor();
  assert.equal(await page.locator('.page-loading').evaluate(el=>getComputedStyle(el).backgroundColor),expected,'page-transition loader matches theme');
  await page.close();
 }
 console.log('Loading appearance passed: dark/light theme applies before JS, first paint, authentication startup and page-transition loading screens.');
}finally{await browser.close();}
