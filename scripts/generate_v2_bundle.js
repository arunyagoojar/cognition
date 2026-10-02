import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const V2_DIR = path.join(__dirname, '../src/data/canonical/v2');
const OUT_FILE = path.join(V2_DIR, 'browser_bundle.js');

const index = JSON.parse(fs.readFileSync(path.join(V2_DIR, 'index.json'), 'utf-8'));

let out = `// AUTO-GENERATED BUNDLE FOR VITE BROWSER COMPATIBILITY
export const V2_BUNDLE = {
`;

for (const mod of ['listening', 'reading', 'writing', 'speaking']) {
  out += `  ${mod}: {\n`;
  const entries = index.modules[mod] || [];
  for (const entry of entries) {
    const p = path.join(V2_DIR, mod, `${entry.id}.json`);
    if (fs.existsSync(p)) {
      const data = fs.readFileSync(p, 'utf-8');
      out += `    "${entry.id}": ${data},\n`;
    }
  }
  out += `  },\n`;
}
out += `};\n`;
out += `export const V2_INDEX = ${JSON.stringify(index, null, 2)};\n`;

fs.writeFileSync(OUT_FILE, out);
console.log('Generated browser_bundle.js');
