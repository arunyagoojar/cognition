#!/usr/bin/env node
/**
 * Release gate — run before every production deploy:
 *   node scripts/release-check.mjs          → tests, validators, lint, production build, bundle checks
 *   node scripts/release-check.mjs --live   → after deploying: checks production's own bundle and API
 * Exits non-zero on the first failure; deploy only on a clean pass.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LIVE = 'https://cognition.eu.cc';
const run = (label, cmd, env = {}) => {
  process.stdout.write(`• ${label} … `);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'pipe', env: { ...process.env, ...env } });
    console.log('ok');
  } catch (e) {
    console.log('FAILED');
    console.error(String(e.stdout || '').slice(-3000), String(e.stderr || '').slice(-3000));
    process.exit(1);
  }
};
const check = (label, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!cond) process.exit(1);
};


// Bundle checks run on the local build and, with --live, on production's own
// bundle (builds are not byte-reproducible, so content is checked, not hashes).
function checkBundle(where, js, css) {
  const keyReads = [...js.matchAll(/\.VITE_CLERK_PUBLISHABLE_KEY\b(.{0,4})/g)];
  check(`${where}: every env read of the Clerk key has the baked fallback`, keyReads.every(m => m[1].startsWith('||')), `${keyReads.length} reads`);
  check(`${where}: Clerk publishable key present`, /pk_(test|live)_[A-Za-z0-9]+/.test(js));
  check(`${where}: API calls are same-origin`, !/VITE_API_BASE_URL:`https?:/.test(js) && !/localhost:8787/.test(js));
  for (const [label, needle] of [
    ['Reading workspace', 'rd-segmented'], ['Tips coach feed', 'Your IELTS coach'], ['text size control', 'text-size-control'],
    ['mock report', 'FULL MOCK EXAM'], ['AI wait note', 'AI examiner is still assessing'],
    ['session-aware AI errors', 'could not confirm your sign-in session'],
  ]) check(`${where}: feature ${label}`, js.includes(needle));
  for (const [label, needle] of [['inline blank fix', '.inline-blank *'], ['verification code boxes', 'cl-otpCodeFieldInput']]) {
    check(`${where}: style ${label}`, css.includes(needle));
  }
}

if (process.argv.includes('--live')) {
  const live = await (await fetch(`${LIVE}/?v=${Date.now()}`, { cache: 'no-store' })).text();
  const liveJs = (live.match(/assets\/index-[\w-]+\.js/) || [])[0];
  const liveCss = (live.match(/assets\/index-[\w-]+\.css/) || [])[0];
  check('production index references a bundle', Boolean(liveJs && liveCss), liveJs);
  const js = await (await fetch(`${LIVE}/${liveJs}`)).text();
  const css = await (await fetch(`${LIVE}/${liveCss}`)).text();
  check('production bundle is JavaScript (not the SPA fallback)', !js.trimStart().startsWith('<'));
  checkBundle('production', js, css);
  const api = await fetch(`${LIVE}/api/me`);
  check('production API responds and requires auth', api.status === 401, `status ${api.status}`);
} else {
  run('npm test (all suites)', 'npm test');
  run('Reading validator', 'python3 pipeline/validate_reading.py');
  run('Writing validator', 'python3 pipeline/validate_writing.py');
  run('lint', 'npx oxlint');
  run('production build', 'npx vite build', { PUBLIC_DIR_OVERRIDE: 'public-static', VITE_API_BASE_URL: '' });
  const dist = path.join(ROOT, 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const jsName = (html.match(/assets\/index-[\w-]+\.js/) || [])[0];
  const cssName = (html.match(/assets\/index-[\w-]+\.css/) || [])[0];
  check('index.html references the built bundle', Boolean(jsName && cssName), jsName);
  check('no source media shipped in dist', !fs.existsSync(path.join(dist, 'wp-content')) && !fs.existsSync(path.join(dist, 'videos')));
  checkBundle('build', fs.readFileSync(path.join(dist, jsName), 'utf8'), fs.readFileSync(path.join(dist, cssName), 'utf8'));
}
console.log('\nRelease check passed.');
