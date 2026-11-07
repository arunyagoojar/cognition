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
  buildDir = await mkdtemp(resolve('work/highlighting-'));
  await writeFile(resolve(buildDir, '.gitignore'), '*\n');
  await build({ logLevel: 'error', build: { outDir: buildDir, emptyOutDir: false, rollupOptions: { input: 'qa/highlighting.html' } } });
  server = await preview({ build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0 } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/qa/highlighting.html`;
  const modes = process.env.HIGHLIGHTING_MODE ? [process.env.HIGHLIGHTING_MODE] : ['practice', 'mock', 'drill'];
  for (const skill of ['reading', 'listening']) for (const mode of modes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}?skill=${skill}&mode=${mode}`, { waitUntil: 'domcontentloaded' });
    const clear = page.getByRole('button', { name: 'Clear highlights', exact: true });
    await clear.waitFor();
    assert(await clear.isDisabled(), `${skill}/${mode}: highlighting is available by default`);
    const painted = () => page.evaluate(() => [...CSS.highlights.values()].flatMap(highlight => [...highlight].map(range => range.toString())).join(''));
    if (skill === 'reading' && mode === 'practice') {
      const bounds = await page.locator('.rd-para').first().evaluate(el => {
        const node = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.length > 20);
        const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 12);
        const rect = range.getClientRects()[0];
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width - 1, bounds.y + bounds.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
      assert((await painted()).length > 0, 'real mouse dragging highlights text');
      await clear.click();
      await page.locator('.rd-para').first().evaluate(el => {
        const node = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.length > 20);
        document.activeElement.blur();
        const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 1);
        window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
      });
      await page.keyboard.down('Shift');
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.up('Shift');
      await page.waitForTimeout(400);
      assert.equal((await painted()).length, 5, 'keyboard selection highlights text');
      await clear.click();
    }
    const select = async (start, end) => {
      const selected = await page.locator('[data-text-highlighter]').evaluate((root, { start, end }) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: node => node.data.trim().length > 40 && !node.parentElement.closest('input,textarea,select,button,audio,[aria-hidden="true"]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
        });
        const node = walker.nextNode();
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end);
        window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        return node.data.slice(start, end);
      }, { start, end });
      await page.waitForTimeout(400);
      return selected;
    };
    const first = await select(0, 12);
    assert.equal(await painted(), first, `${skill}/${mode}: selection paints text`);
    const overlap = await select(6, 20);
    assert.equal(await painted(), first.slice(0, 6) + overlap, 'overlapping highlights merge');
    const highlight = await painted();
    if (process.env.QA_SCREENSHOTS && mode === 'practice') {
      await mkdir(process.env.QA_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(process.env.QA_SCREENSHOTS, `${skill}-desktop-light.png`) });
    }
    // Changing an answer must leave the real controls and highlights working.
    const input = page.locator('[data-text-highlighter] input[type="text"], [data-text-highlighter] input:not([type])').first();
    if (await input.count()) {
      await input.fill('test answer');
      assert.equal(await input.inputValue(), 'test answer');
      await input.evaluate(el => { el.focus(); el.select(); });
      await page.waitForTimeout(400);
      assert.equal(await painted(), highlight, 'answer text is not highlighted');
    }
    if (mode !== 'drill') {
      await page.locator('.exam-nav-section-pill').nth(1).click();
      assert.equal(await painted(), '', 'highlights do not leak into the next part');
      await page.locator('.exam-nav-section-pill').first().click();
      await page.waitForTimeout(100);
      assert.equal(await painted(), highlight, 'returning restores highlights');
    }
    await page.reload({ waitUntil: 'domcontentloaded' }); await clear.waitFor();
    assert.equal(await painted(), highlight, 'refresh restores saved highlights');
    // Compact layout and dark theme use the same feature.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.waitForTimeout(250); // Let the existing theme transition finish before visual QA.
    assert.equal(await painted(), highlight);
    if (process.env.QA_SCREENSHOTS) {
      await mkdir(process.env.QA_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: resolve(process.env.QA_SCREENSHOTS, `${skill}-${mode}-compact-dark.png`) });
    }
    await clear.click();
    assert.equal(await painted(), '', 'clear removes painted ranges');
    assert(await clear.isDisabled());
    await page.reload({ waitUntil: 'domcontentloaded' }); await clear.waitFor();
    assert.equal(await painted(), '', 'cleared highlights stay cleared');
    await select(0, 12);
    await page.evaluate(() => window.__beginPracticeSession());
    await page.reload({ waitUntil: 'domcontentloaded' }); await clear.waitFor();
    assert.equal(await painted(), '', 'starting a fresh session discards old highlights');
    await context.close();
    console.log(`PASS ${skill}/${mode}: default selection, overlap, answers, navigation, refresh, compact/dark, clear`);
  }
  assert.deepEqual(errors, [], 'no runtime errors');
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  if (buildDir) await rm(buildDir, { recursive: true, force: true });
}
