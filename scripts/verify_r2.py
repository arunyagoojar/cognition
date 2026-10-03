#!/usr/bin/env python3
"""Live-verifies every manifest entry against the R2 public URL
(status 200 + exact byte size + content-type). Usage: python3 scripts/verify_r2.py
Note: run with a browser User-Agent — Cloudflare bot-blocks python-urllib."""
import json, urllib.request, urllib.parse, concurrent.futures, sys

BASE = "https://pub-b158c0b753f14ee386f9d3217c48d007.r2.dev"
import os
m = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'content-db', 'media_manifest.json')))
files = m.get('files', m.get('media', [])) if isinstance(m, dict) else m

def check(f):
    key = f['r2Key']
    url = f"{BASE}/{urllib.parse.quote(key)}"
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return (key, r.status, int(r.headers.get('Content-Length', -1)), r.headers.get('Content-Type',''), f['bytes'], f['mimeType'])
    except urllib.error.HTTPError as e:
        return (key, e.code, -1, '', f['bytes'], f['mimeType'])
    except Exception as e:
        return (key, str(e)[:40], -1, '', f['bytes'], f['mimeType'])

results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
    for r in ex.map(check, files):
        results.append(r)

ok = [r for r in results if r[1]==200 and r[2]==r[4] and r[3].split(';')[0]==r[5]]
bad = [r for r in results if r not in ok]
print(f"VERIFIED: {len(ok)}/{len(results)} (status 200 + exact size + exact content-type)")
if bad:
    print(f"FAILURES: {len(bad)}")
    for r in bad[:20]: print(" ", r)
    sys.exit(1)
print("ALL OBJECTS MATCH MANIFEST EXACTLY")
