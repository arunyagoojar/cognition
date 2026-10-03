import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[PAGE ERROR]', String(e).slice(0, 400)));
page.on('console', m => { const t = m.text(); if (/error/i.test(t)) console.log('[console]', t.slice(0, 200)); });
await page.setViewport({ width: 1440, height: 900 });
await page.goto('https://cognition.eu.cc/', { waitUntil: 'networkidle2' });
await sleep(3000);
if (!(await page.$('.account-menu-btn'))) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign in')?.click());
  await sleep(2500);
  await page.type('#identifier-field', 'e2e-tester+clerk_test@cognition-test.dev', { delay: 10 });
  await page.type('#password-field', '767aa4cca167b8b4a1ca235e', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Check your email/i.test(document.body.textContent), { timeout: 20000 }).catch(() => {});
  await sleep(700);
  await page.keyboard.type('424242', { delay: 60 });
  await page.waitForFunction(() => !/Check your email/i.test(document.body.textContent), { timeout: 20000 }).catch(() => {});
  await sleep(2000);
}
await page.evaluate(() => document.querySelector('#performance-overview-card')?.click());
await sleep(3000);
const text = await page.evaluate(() => document.body.textContent.replace(/\s+/g, ' ').slice(0, 120));
console.log('VIEW:', text);
await browser.close();
