import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker/src/index.js';

let assetCalls = 0;
const env = {
  ASSETS: {
    fetch(request) {
      assetCalls++;
      return new Response(`asset:${new URL(request.url).pathname}`, {
        headers: { 'Content-Type': 'text/html', ETag: 'unchanged-asset' },
      });
    },
  },
};

// Cover navigation, static files, and APIs before any asset or auth handling.
for (const host of ['cognition.eu.cc', 'cognition.arunyagoojar.workers.dev']) {
  for (const path of ['/', '/favicon.svg', '/assets/app.js', '/practice/reading?test=a%2Fb&next=2', '/api/me']) {
    for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
      const response = await worker.fetch(new Request(`http://${host}${path}`, { method }), env);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('Location'), `https://${host}${path}`);
    }
  }
}
assert.equal(assetCalls, 0, 'HTTP redirects must run before serving assets');

// HTTPS passes through assets and their response headers, including SPA routes.
for (const path of ['/', '/favicon.svg', '/assets/app.js', '/practice/reading?test=1']) {
  const response = await worker.fetch(new Request(`https://cognition.eu.cc${path}`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Location'), null);
  assert.equal(response.headers.get('ETag'), 'unchanged-asset');
  assert.equal(await response.text(), `asset:${new URL(`https://cognition.eu.cc${path}`).pathname}`);
}

// Local HTTP is still usable, including IPv6 and localhost subdomains.
for (const host of ['localhost:8787', 'app.localhost:8787', '127.0.0.1:8787', '[::1]:8787']) {
  const response = await worker.fetch(new Request(`http://${host}/`), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Location'), null);
}

const beforeApi = assetCalls;
for (const origin of ['https://cognition.eu.cc', 'http://localhost:8787']) {
  const response = await worker.fetch(new Request(`${origin}/api/me`), env);
  assert.equal(response.status, 401, 'API authentication must remain enforced');
  assert.equal((await response.json()).error, 'Unauthorized');
}
assert.equal(assetCalls, beforeApi, 'API requests must never fall back to the SPA');
const preflight = await worker.fetch(new Request('https://cognition.eu.cc/api/me', {
  method: 'OPTIONS', headers: { Origin: 'https://cognition.eu.cc' },
}), env);
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://cognition.eu.cc');

const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
assert.match(config, /^run_worker_first\s*=\s*true\s*$/m,
  'Assets must not bypass the Worker HTTPS redirect');
assert.match(config, /\[dev\]\s+host\s*=\s*"localhost"\s+upstream_protocol\s*=\s*"http"/,
  'Wrangler must not rewrite local requests to the production HTTP hostname');
console.log('HTTPS redirect checks passed: paths, queries, methods, assets, SPA, local HTTP, API auth, and CORS.');
