#!/usr/bin/env node
// Runs the API and UI together, using only the local D1 database.
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false',
  WRANGLER_LOG_PATH: fileURLToPath(new URL('../.wrangler/logs/', import.meta.url)),
  WRANGLER_REGISTRY_PATH: fileURLToPath(new URL('../.wrangler/registry/', import.meta.url)) };
const migration = spawnSync('npm', ['run', 'db:local'], { cwd, env, stdio: 'inherit' });
if (migration.status !== 0) process.exit(migration.status || 1);

const children = ['dev:api', 'dev'].map(script => spawn('npm', ['run', script], {
  cwd, env, stdio: 'inherit', detached: process.platform !== 'win32',
}));
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch { /* already exited */ }
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
