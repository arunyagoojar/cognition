import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:4173/listening', { waitUntil: 'networkidle0' });
    console.log('PASS: Loaded listening intro page');

    // Find and click 'START LISTENING TEST'
    const buttons = await page.$$('button');
    let startBtn = null;
    for (const b of buttons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes('START LISTENING TEST')) {
        startBtn = b;
        break;
      }
    }
    if (startBtn) {
      await startBtn.click();
      console.log('PASS: Clicked START LISTENING TEST');
      await page.waitForTimeout(2000); // wait for render
      
      const content = await page.content();
      if (content.includes('Item 1: Details regarding')) {
         console.log('FAIL: Synthetic text found!');
      } else {
         console.log('PASS: No synthetic text found');
      }
    } else {
      console.log('FAIL: Could not find start button');
      const html = await page.evaluate(() => document.body.innerHTML);
      console.log('HTML Dump:', html.substring(0, 1000));
      process.exit(1);
    }
  } catch (e) {
    console.error('FAIL: Browser test error', e);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
