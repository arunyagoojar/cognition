import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/src/index.js';

const env = {
  ASSETS: {
    fetch() {
      throw new Error('API requests must never fall back to assets');
    },
  },
};

// The edge owns static HTTPS redirects. The API keeps a redirect fallback.
for (const host of ['cognition.eu.cc', 'cognition.arunyagoojar.workers.dev']) {
  for (const path of ['/api/me', '/api/attempts?test=a%2Fb&next=2']) {
    for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
      const response = await worker.fetch(new Request(`http://${host}${path}`, { method }), env);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('Location'), `https://${host}${path}`);
    }
  }
}

// Local HTTP is still usable, including IPv6 and localhost subdomains.
for (const host of ['localhost:8787', 'app.localhost:8787', '127.0.0.1:8787', '[::1]:8787']) {
  const response = await worker.fetch(new Request(`http://${host}/api/me`), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Location'), null);
}

for (const origin of ['https://cognition.eu.cc', 'http://localhost:8787']) {
  const response = await worker.fetch(new Request(`${origin}/api/me`), env);
  assert.equal(response.status, 401, 'API authentication must remain enforced');
  assert.equal((await response.json()).error, 'Unauthorized');
}
const preflight = await worker.fetch(new Request('https://cognition.eu.cc/api/me', {
  method: 'OPTIONS', headers: { Origin: 'https://cognition.eu.cc' },
}), env);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://cognition.eu.cc');

const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
assert.match(config, /^run_worker_first\s*=\s*\["\/api\/\*"\]\s*$/m,
  'Static requests must bypass the Worker so they do not consume the free quota');
assert.match(config, /\[dev\]\s+host\s*=\s*"localhost"\s+upstream_protocol\s*=\s*"http"/,
  'Wrangler must not rewrite local requests to the production HTTP hostname');
console.log('Free static routing and API HTTPS checks passed: paths, queries, methods, local HTTP, API auth, and CORS.');
