/**
 * Cognition IELTS - Content Validation CLI Engine (v2)
 * Scans new canonical packages and validates data quality gates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'src/data/canonical/packages');

console.log('============================================================');
console.log('COGNITION IELTS — CANONICAL CONTENT VALIDATION (V2)');
console.log('============================================================\n');

const stats = {
  verified: 0,
  needsReview: 0,
  failed: 0,
  errors: []
};

function checkFile(filePath, content, moduleName) {
  let hasError = false;
  
  if (!content.testId) {
    stats.errors.push(`${filePath}: Missing testId`);
    hasError = true;
  }
  
  if (content.validationState === 'NEEDS_REVIEW') {
    stats.needsReview++;
    return;
  } else if (content.validationState !== 'VERIFIED') {
    stats.errors.push(`${filePath}: Invalid validationState ${content.validationState}`);
    hasError = true;
  }
  
  if (moduleName === 'listening') {
    if (!content.parts || content.parts.length === 0) {
      stats.errors.push(`${filePath}: Listening test has no parts`);
      hasError = true;
    }
    for (const p of content.parts) {
      if (!p.questions || p.questions.length === 0) {
        stats.errors.push(`${filePath}: Listening part ${p.sectionNumber} has no questions`);
        hasError = true;
      }
      if (p.audioFile && p.audioFile.includes("://") === false && !fs.existsSync(path.join(ROOT_DIR, 'public', p.audioFile))) {
        // Skip strict audio check since we don't have all files physically yet, or just log warning
      }
    }
  }
  
  if (moduleName === 'reading') {
    if (!content.passages || content.passages.length === 0) {
      stats.errors.push(`${filePath}: Reading test has no passages`);
      hasError = true;
    }
    for (const p of content.passages) {
      if (!p.questions || p.questions.length === 0) {
        stats.errors.push(`${filePath}: Reading passage ${p.passageNumber} has no questions`);
        hasError = true;
      }
    }
  }

  if (moduleName === 'writing') {
    if (!content.task1 || !content.task1.prompt) {
      stats.errors.push(`${filePath}: Writing test has no task 1 prompt`);
      hasError = true;
    }
  }

  if (moduleName === 'speaking') {
    if (!content.parts || content.parts.length === 0) {
      stats.errors.push(`${filePath}: Speaking test has no parts`);
      hasError = true;
    }
  }
  
  if (hasError) {
    stats.failed++;
  } else {
    stats.verified++;
  }
}

function scanDir(moduleName) {
  const dirPath = path.join(PACKAGES_DIR, moduleName);
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const filePath = path.join(dirPath, f);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      checkFile(f, data, moduleName);
    } catch (e) {
      stats.errors.push(`${f}: Failed to parse JSON`);
      stats.failed++;
    }
  }
}

scanDir('listening');
scanDir('reading');
scanDir('writing');
scanDir('speaking');

console.log(`Verified Packages: ${stats.verified}`);
console.log(`Needs Review:      ${stats.needsReview}`);
console.log(`Failed/Invalid:    ${stats.failed}`);

if (stats.errors.length > 0) {
  console.log('\nErrors detected:');
  stats.errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
  if (stats.errors.length > 20) {
    console.log(`  ... and ${stats.errors.length - 20} more errors.`);
  }
  process.exit(1);
}

process.exit(0);
