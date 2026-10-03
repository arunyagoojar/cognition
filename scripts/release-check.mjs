#!/usr/bin/env node
/**
 * Release gate — run before every production deploy:
 *   node scripts/release-check.mjs          → tests, validators, lint, production build, bundle checks
 *   node scripts/release-check.mjs --live   → also confirms cognition.eu.cc serves exactly this build
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
const js = fs.readFileSync(path.join(dist, jsName), 'utf8');
const css = fs.readFileSync(path.join(dist, cssName), 'utf8');

// the API client must carry the publishable key (else signed-in users get "Sign in")
const keyReads = [...js.matchAll(/\.VITE_CLERK_PUBLISHABLE_KEY\b(.{0,4})/g)];
check('every env read of the Clerk key has the baked fallback', keyReads.every(m => m[1].startsWith('||')), `${keyReads.length} reads`);
check('Clerk publishable key present in bundle', /pk_(test|live)_[A-Za-z0-9]+/.test(js));
check('API calls are same-origin (no localhost/absolute API base)', !/VITE_API_BASE_URL:`https?:/.test(js) && !/localhost:8787/.test(js));
check('no source media shipped in dist', !fs.existsSync(path.join(dist, 'wp-content')) && !fs.existsSync(path.join(dist, 'videos')));
for (const [label, needle] of [
  ['Reading workspace', 'rd-segmented'], ['Tips coach feed', 'Your IELTS coach'], ['text size control', 'text-size-control'],
  ['mock report', 'FULL MOCK EXAM'], ['AI wait note', 'AI examiner is still assessing'],
]) check(`feature in bundle: ${label}`, js.includes(needle));
for (const [label, needle] of [['inline blank fix', '.inline-blank *'], ['verification code boxes', 'cl-otpCodeFieldInput']]) {
  check(`style in bundle: ${label}`, css.includes(needle));
}

if (process.argv.includes('--live')) {
  const live = await (await fetch(`${LIVE}/?v=${Date.now()}`, { cache: 'no-store' })).text();
  const liveJs = (live.match(/assets\/index-[\w-]+\.js/) || [])[0];
  check('production serves this exact build', liveJs === jsName, `live ${liveJs} · local ${jsName}`);
  const api = await fetch(`${LIVE}/api/me`);
  check('API responds and requires auth', api.status === 401, `status ${api.status}`);
}
console.log('\nRelease check passed.');
