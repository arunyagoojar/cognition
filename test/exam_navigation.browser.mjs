import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, preview } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: 'chrome' }), headless: true });
let server, buildDir;
const errors = [];
try {
  await mkdir('work', { recursive: true });
  buildDir = await mkdtemp(resolve('work/exam-navigation-'));
  await writeFile(resolve(buildDir, '.gitignore'), '*\n');
  await build({ logLevel: 'error', build: { outDir: buildDir, emptyOutDir: false, rollupOptions: { input: 'qa/exam-navigation.html' } } });
  server = await preview({ build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0 } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/qa/exam-navigation.html`;
  for (const skill of process.env.NAV_SKILL ? [process.env.NAV_SKILL] : ['reading', 'listening', 'writing', 'speaking']) for (const mode of ['practice', 'mock']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
    // Navigation testing never needs to download or initialise a speech model.
    await context.route(/huggingface\.co|hf\.co/, route => route.abort());
    const page = await context.newPage();
    const gradingRequests = [];
    page.on('request', request => { if (/\/api\/ai\/|generativelanguage\.googleapis\.com|api\.groq\.com/.test(request.url())) gradingRequests.push(request.url()); });
    page.on('pageerror', error => errors.push(`${skill}/${mode}: ${error.message}`));
    await page.goto(`${base}?skill=${skill}&mode=${mode}`, { waitUntil: 'domcontentloaded' });
    const nav = page.getByRole('navigation', { name: 'Exam navigation' });
    await nav.waitFor();
    await page.evaluate(() => document.fonts.ready);
    if (skill === 'writing') {
      await page.getByRole('textbox', { name: 'Task 1 response', exact: true }).fill('This is a draft in progress. It must not be sent for grading while typing.');
      await page.waitForTimeout(350);
      assert.equal(gradingRequests.length, 0, 'typing does not trigger AI grading');
    }
    const sections = nav.locator('.exam-nav-section-pill');
    const count = await sections.count();
    const label = width => `${skill}/${mode}/${width}`;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      const verifyGeometry = async () => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(() => {
          const bar = document.querySelector('.exam-bottom-nav');
          return Number.parseFloat(bar.closest('.exam-focus-layout').style.getPropertyValue('--exam-bottom-nav-height')) === Math.ceil(bar.getBoundingClientRect().height);
        });
        const geometry = await nav.evaluate(bar => {
          const box = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          return { bar: box(bar), viewport: { width: innerWidth, height: innerHeight }, padding: Number.parseFloat(getComputedStyle(bar.closest('.exam-focus-layout')).paddingBottom),
            buttons: [...bar.querySelectorAll('button')].map(button => ({ ...box(button), name: button.getAttribute('aria-label') || button.textContent.trim(), disabled: button.disabled,
              hit: button.contains(document.elementFromPoint(button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2, button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2)) })) };
        });
        for (const button of geometry.buttons) {
          const message = `${label(width)} ${button.name}`;
          assert(button.width >= 43.9 && button.height >= 43.9, `${message}: 44px touch target`);
          assert(button.left >= -0.5 && button.right <= width + 0.5, `${message}: fits viewport`);
          assert(button.top >= geometry.bar.top && button.bottom <= geometry.bar.bottom + 0.5, `${message}: contained in toolbar`);
          assert(button.hit, `${message}: receives its own centre-point hit`);
        }
        for (let i = 0; i < geometry.buttons.length; i++) for (let j = i + 1; j < geometry.buttons.length; j++) {
          const a = geometry.buttons[i], b = geometry.buttons[j];
          assert(Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 0.5 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 0.5, `${label(width)}: ${a.name} and ${b.name} do not overlap`);
        }
        assert(geometry.padding >= geometry.bar.height + 23.5, `${label(width)}: content reserves the measured toolbar height (padding ${geometry.padding}, bar ${geometry.bar.height})`);
      };
      await verifyGeometry();
      for (let i = 0; i < count; i++) {
        await sections.nth(i).click();
        assert.equal(await sections.nth(i).getAttribute('aria-current'), 'step', `${label(width)}: real click selects section ${i + 1}`);
        assert(await sections.nth(i).getAttribute('aria-label'), `${label(width)}: compact section keeps its full accessible name`);
        await verifyGeometry();
      }
      await nav.locator('.exam-nav-btn-prev').click();
      assert.equal(await sections.nth(count - 2).getAttribute('aria-current'), 'step', `${label(width)}: Previous works`);
      await nav.locator('.exam-nav-btn-next').click();
      assert.equal(await sections.nth(count - 1).getAttribute('aria-current'), 'step', `${label(width)}: Next works`);
      await verifyGeometry();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const content = await nav.evaluate(bar => {
        const shell = bar.closest('.exam-focus-layout');
        const children = [...shell.children].filter(node => node !== bar && getComputedStyle(node).display !== 'none' && getComputedStyle(node).position !== 'fixed');
        return { lastBottom: children.at(-1).getBoundingClientRect().bottom, barTop: bar.getBoundingClientRect().top };
      });
      assert(content.lastBottom <= content.barTop + 0.5, `${label(width)}: final content can scroll above the fixed bar`);
      if (process.env.QA_SCREENSHOTS && width === 390) {
        await mkdir(process.env.QA_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: resolve(process.env.QA_SCREENSHOTS, `${skill}-${mode}-navigation-390.png`) });
      }
    }
    await sections.first().focus();
    await page.keyboard.press('Enter');
    assert.equal(await sections.first().getAttribute('aria-current'), 'step', `${skill}/${mode}: keyboard selects section`);
    assert(await sections.first().evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 2), 'keyboard focus is visible');
    console.log(`PASS ${skill}/${mode}: 320, 390, 768, 1440px; sections, Previous/Next, hit targets, overlap, reserved space and keyboard.`);
    if (skill === 'writing') assert.equal(gradingRequests.length, 0, 'no AI grading before submission');
    await context.close();
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} finally {
  await browser.close();
  await server?.close();
  if (buildDir) await rm(buildDir, { recursive: true, force: true });
}
