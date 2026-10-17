import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
const files=[...new Set([...html.matchAll(/(?:src|href)="\/?(assets\/[^"\s]+\.js)"/g)].map(m=>m[1]))];
let raw=0,gzip=0;
for(const file of files){const bytes=fs.readFileSync(path.join(root,'dist',file));raw+=bytes.length;gzip+=gzipSync(bytes).length;assert(!/\/(?:reading|listening|writing|speaking)-/.test(file)||bytes.length<50000,'Question bank entered the startup graph');assert(!file.includes('binaryInlined'),'Harper engine entered startup');assert(!file.includes('o200k_harmony'),'Review tokenizer entered startup');}
assert(raw<1500000,`Startup JavaScript budget exceeded: ${raw} bytes`);
console.log(`Startup JavaScript: ${(raw/1000).toFixed(1)} KB raw, ${(gzip/1000).toFixed(1)} KB gzip across ${files.length} entry/preload files; budget passed.`);

function inspectAssets(directory) {
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()) inspectAssets(file);
  else assert(fs.statSync(file).size<=25*1024*1024,`Cloudflare asset exceeds 25 MiB: ${path.relative(root,file)}`);
 }
}
inspectAssets(path.join(root,'dist'));
console.log('All deployable assets fit Cloudflare’s 25 MiB limit.');
