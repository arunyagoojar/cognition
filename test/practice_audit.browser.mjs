import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, preview } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let server, buildDir;
const errors = [];
try {
  await mkdir('work', { recursive: true });
  buildDir = await mkdtemp(resolve('work/practice-audit-'));
  await writeFile(resolve(buildDir, '.gitignore'), '*\n');
  await build({ logLevel: 'error', build: { outDir: buildDir, emptyOutDir: false, rollupOptions: { input: 'qa/highlighting.html' } } });
  server = await preview({ build: { outDir: buildDir }, preview: { host: '127.0.0.1', port: 0 } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/qa/highlighting.html`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?skill=reading&test=235`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('radiogroup', { name: 'Question 5', exact: true }).waitFor();
  const choose = (number, value) => page.locator(`input[name="question-q${number}"][value="${value}"]`).check({ force: true });
  await page.getByRole('textbox', { name: 'Question 1', exact: true }).fill('needs');
  await choose(5, 'C'); await choose(7, 'A'); await choose(8, 'B'); await choose(11, 'FALSE');
  assert.equal(await page.locator('input[name="question-q6"]:checked').count(), 0, 'skipping Q6 does not select it implicitly');
  assert.equal(await page.locator('.rd-stim-line').count(), 4, 'Q1–4 are distinct blocks');
  await page.locator('.exam-nav-section-pill').nth(1).click();
  const stems = await page.locator('.rd-prompt').allTextContents();
  assert(stems.some(s => s.includes('existing products')));
  assert(stems.some(s => s.includes('a number of products fail because')));
  assert(stems.some(s => s.includes('Nobel prize winner Kahneman and Tversky')));
  assert(stems.every(s => !s.includes('~~~~') && !s.includes('hinh')));
  await page.locator('.exam-nav-section-pill').nth(2).click();
  assert.equal(await page.locator('.rd-stim-line').count(), 3, 'Q32–36 retain three complete source sentences');
  await page.getByRole('textbox', { name: 'Question 36', exact: true }).fill('classical education');
  await page.locator('#submit-reading-exam').click();
  await page.getByRole('button', { name: 'Review answers', exact: true }).click();
  const row = n => page.locator('.answer-review-item').filter({ has: page.locator('.ar-qnum', { hasText: new RegExp(`^Q${n}$`) }) });
  assert.match(await row(6).textContent(), /No answer given/);
  assert.match(await row(7).locator('.ar-row').first().textContent(), /A · fish/);
  assert.match(await row(8).locator('.ar-row').first().textContent(), /B · oxen/);
  assert.match(await row(8).locator('.ar-row').nth(1).textContent(), /A · fish/);
  assert(await row(1).evaluate(el => el.classList.contains('is-correct')));
  assert(await row(11).evaluate(el => el.classList.contains('is-correct')));
  assert(await row(36).evaluate(el => el.classList.contains('is-correct')));
  assert.equal(await page.locator('.ar-question').count(), 40, 'every answer row has question wording, including shared multi-select stems');
  for (const n of [1, 2, 3]) {
    await page.getByRole('button', { name: `Passage ${n}`, exact: true }).click();
    assert(await page.locator('.review-source-context .rd-para').count() > 0);
    assert(await page.locator('.review-source-questions input, .review-source-questions select').count() > 0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'review fits compact widths');
  if (process.env.QA_SCREENSHOTS) {
    await mkdir(process.env.QA_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: resolve(process.env.QA_SCREENSHOTS, 'reading235-review-compact.png') });
  }
  // Fresh run: selecting Q6 must remain attached to Q6 independently of Q7/Q8.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?skill=reading&test=235`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /Questions/ }).click();
  await page.getByRole('radiogroup', { name: 'Question 6', exact: true }).waitFor();
  await choose(6, 'B'); await choose(7, 'C'); await choose(8, 'A');
  await page.locator('.exam-nav-section-pill').nth(2).click();
  await page.locator('#submit-reading-exam').click();
  await page.getByRole('button', { name: 'Review answers', exact: true }).click();
  assert.match(await row(6).locator('.ar-row').first().textContent(), /B · oxen/);
  assert(await row(6).evaluate(el => el.classList.contains('is-correct')));
  assert.match(await row(7).locator('.ar-row').first().textContent(), /C · goats/);
  assert.match(await row(8).locator('.ar-row').first().textContent(), /A · fish/);
  const mark = row(7).getByRole('button',{name:/Mark as correct/});
  const beforeScore=await page.getByRole('status').filter({hasText:/correct.*Manual corrections/}).textContent();
  await mark.click();
  assert.match(await row(7).textContent(),/Manually corrected/);
  const afterScore=await page.getByRole('status').filter({hasText:/correct.*Manual corrections/}).textContent();
  assert.equal(parseInt(afterScore),parseInt(beforeScore)+1,'manual credit increases this attempt by exactly one');
  assert.equal(await row(1).getByRole('button',{name:/Mark as correct/}).count(),0,'blank answers cannot be credited');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Review answers',exact:true}).click();
  assert.match(await row(7).textContent(),/Manually corrected/,'correction survives refresh');
  await row(7).getByRole('button',{name:/Undo correction for/}).click();
  assert(!/Manually corrected/.test(await row(7).textContent()));
  const undoScore=await page.getByRole('status').filter({hasText:/correct.*Manual corrections/}).textContent();
  assert.equal(parseInt(undoScore),parseInt(beforeScore),'Undo restores the recorded score');
  console.log('PASS Reading 235: skipped slots, Q6/B, independent choices, Q11/FALSE, contextual variants, complete questions and summary blocks.');

  await page.evaluate(() => localStorage.clear());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}?skill=reading&test=102`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-text-highlighter]').waitFor();
  const count = await page.locator('[data-text-highlighter]').evaluate(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('input,textarea,select,button,audio,script,style,[contenteditable],[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    const text = nodes.map(n => n.data).join('');
    const ranges = [...text.matchAll(/\b[A-Za-z]{5,}\b/g)].slice(0, 500).map(m => [m.index, m.index + m[0].length]);
    localStorage.setItem('cognition_draft_v2:guest:reading:102:false:passage-0:highlights', JSON.stringify({ version: 2, data: { text, ranges } }));
    return ranges.length;
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-text-highlighter]').waitFor();
  const painted = () => page.evaluate(() => [...CSS.highlights.values()].flatMap(h => [...h].map(r => r.toString())).join('|'));
  const before = await painted(); assert(count >= 400 && before.length > 1500);
  await page.locator('.rd-choice input[type="checkbox"]').first().check({ force: true });
  assert.equal(await painted(), before, 'hundreds of legacy marks survive changing the live selected-answer counter');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-text-highlighter]').waitFor();
  assert.equal(await painted(), before, 'marks survive reload after dynamic content changes');
  console.log('PASS Highlight stress: 500 marks, legacy draft migration, changed answer counter, and refresh.');

  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?skill=listening&mode=review&manual=1`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Review answers', exact: true }).click();
  for (const n of [1, 2, 3, 4]) {
    await page.getByRole('button', { name: `Part ${n}`, exact: true }).click();
    assert(await page.locator('.review-source-questions input, .review-source-questions select').count() > 0);
  }
  assert.equal(await page.locator('.answer-review-item').count(), 40);
  const listeningRow=page.locator('.answer-review-item').first();
  await listeningRow.getByRole('button',{name:/Mark as correct/}).click();
  assert.match(await listeningRow.textContent(),/Manually corrected/);
  assert.match(await page.getByRole('status').filter({hasText:/correct.*Manual corrections/}).textContent(),/^25\/40/);
  await listeningRow.getByRole('button',{name:/Undo correction for/}).click();
  assert.match(await page.getByRole('status').filter({hasText:/correct.*Manual corrections/}).textContent(),/^24\/40/);

  await page.getByRole('button', { name: 'Back to summary', exact: false }).first().click();
  await page.getByRole('button', { name: 'Review answers', exact: true }).waitFor();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  await context.close();
  console.log('PASS Listening review: original question groups, all four parts, read-only answers, and unchanged summary.');
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  if (buildDir) await rm(buildDir, { recursive: true, force: true });
}
