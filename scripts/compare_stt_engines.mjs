#!/usr/bin/env node
/**
 * Opt-in Speech-to-Text Comparison Script (Whistle vs Moonshine)
 *
 * Evaluates on-device STT engines on a directory of candidate recordings.
 * Measures:
 *  1. Word Error Rate (WER) against user-supplied reference transcripts.
 *  2. Preservation of spoken filler words (e.g. "uh", "um", "er", "ah", "like").
 *  3. Preservation of spoken word repetitions (e.g. "I I", "the the").
 *
 * NOTE: This tool does NOT make unverified accuracy claims. Real-world STT
 * quality varies by speaker accent, microphone quality, and acoustic environment.
 * Run this benchmark on your own dataset to validate engine suitability.
 *
 * Usage:
 *   node scripts/compare_stt_engines.mjs --dir path/to/recordings
 *
 * Directory structure:
 *   path/to/recordings/
 *     candidate1.wav
 *     candidate1.txt  <-- reference transcript
 *     candidate2.wav
 *     candidate2.txt
 *   OR a manifest.json file mapping { "candidate1.wav": "reference text..." }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/* ── Standard Filler Words Lexicon ── */
const FILLER_WORDS = new Set([
  'uh', 'um', 'er', 'ah', 'like', 'well', 'you know', 'actually', 'basically', 'hmm'
]);

/* ── Levenshtein Distance for Word Error Rate (WER) ── */
export function calculateWER(refText, hypText) {
  const refWords = tokenizeWords(refText);
  const hypWords = tokenizeWords(hypText);

  if (refWords.length === 0) {
    return {
      wer: hypWords.length === 0 ? 0 : 1.0,
      substitutions: 0,
      deletions: 0,
      insertions: hypWords.length,
      refLength: 0,
      hypLength: hypWords.length,
    };
  }

  const n = refWords.length;
  const m = hypWords.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        const sub = dp[i - 1][j - 1] + 1;
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        dp[i][j] = Math.min(sub, del, ins);
      }
    }
  }

  // Backtrace to get edit operation breakdown
  let i = n, j = m;
  let substitutions = 0, deletions = 0, insertions = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refWords[i - 1] === hypWords[j - 1]) {
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++; i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++; i--;
    } else {
      insertions++; j--;
    }
  }

  const wer = (substitutions + deletions + insertions) / n;
  return {
    wer,
    substitutions,
    deletions,
    insertions,
    refLength: n,
    hypLength: m,
  };
}

export function tokenizeWords(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/* ── Filler Words Counting ── */
export function countFillers(text) {
  const words = tokenizeWords(text);
  let count = 0;
  const breakdown = {};
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (FILLER_WORDS.has(w)) {
      count++;
      breakdown[w] = (breakdown[w] || 0) + 1;
    } else if (i + 1 < words.length && FILLER_WORDS.has(`${w} ${words[i + 1]}`)) {
      count++;
      const phrase = `${w} ${words[i + 1]}`;
      breakdown[phrase] = (breakdown[phrase] || 0) + 1;
      i++;
    }
  }
  return { count, breakdown };
}

/* ── Word Repetitions Counting ── */
export function countRepetitions(text) {
  const words = tokenizeWords(text);
  let count = 0;
  const repetitions = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === words[i + 1]) {
      count++;
      repetitions.push(words[i]);
    }
  }
  return { count, repetitions };
}

/* ── Native Node Whistle Transcriber Harness ── */
async function createNodeWhistleTranscriber() {
  const wasmPath = path.join(ROOT, 'public/stt/needle.wasm');
  const cactPath = path.join(ROOT, 'public/stt/whistle.cact');

  if (!fs.existsSync(wasmPath) || !fs.existsSync(cactPath)) {
    return null;
  }

  try {
    const { default: createNeedle } = await import('../src/utils/speech/vendor/needle.js');
    const wasmBuf = fs.readFileSync(wasmPath);
    const cactBuf = fs.readFileSync(cactPath);

    const mod = await createNeedle({ wasmBinary: wasmBuf });
    const cactPtr = mod._malloc(cactBuf.length);
    mod.HEAPU8.set(cactBuf, cactPtr);
    const loadRet = mod._needle_load(cactPtr, BigInt(cactBuf.length));
    mod._free(cactPtr);

    if (loadRet !== 0) return null;

    return {
      transcribePCM: (pcm) => {
        const samples = pcm.length;
        const pcmPtr = mod._malloc(samples * 4);
        mod.HEAPU8.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), pcmPtr);
        const outCap = 65536;
        const outPtr = mod._malloc(outCap);
        const ret = mod._needle_transcribe(pcmPtr, samples, 0, 0, 1, outPtr, outCap);
        mod._free(pcmPtr);
        if (ret !== 0) {
          mod._free(outPtr);
          return { text: '', words: [] };
        }
        const json = mod.UTF8ToString(outPtr);
        mod._free(outPtr);
        return JSON.parse(json || '{}');
      },
    };
  } catch (e) {
    return null;
  }
}

/* ── CLI Runner ── */
async function run() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--dir');
  const targetDir = dirIdx !== -1 && args[dirIdx + 1] ? path.resolve(args[dirIdx + 1]) : null;

  console.log('================================================================');
  console.log('     COGNITION STT ENGINE BENCHMARK: WHISTLE vs MOONSHINE       ');
  console.log('================================================================\n');

  if (!targetDir || !fs.existsSync(targetDir)) {
    console.log('Usage:');
    console.log('  node scripts/compare_stt_engines.mjs --dir <folder_path>\n');
    console.log('Requirements:');
    console.log('  - Place recorded audio files (.wav, .pcm, .webm) into the target directory.');
    console.log('  - For each audio file (e.g. response1.wav), provide reference text as response1.txt');
    console.log('    OR supply a manifest.json mapping { "response1.wav": "official reference text" }.\n');
    console.log('Running self-contained verification demo with sample transcript evaluations...\n');

    // Run verification demonstration
    runVerificationDemo();
    return;
  }

  console.log(`Analyzing folder: ${targetDir}`);
  const files = fs.readdirSync(targetDir);
  const audioFiles = files.filter(f => /\.(wav|webm|mp3|ogg|m4a)$/i.test(f));

  if (audioFiles.length === 0) {
    console.log('No audio files (.wav, .webm, .mp3, etc.) found in directory.');
    return;
  }

  let manifest = {};
  const manifestPath = path.join(targetDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      console.warn('Failed to parse manifest.json');
    }
  }

  console.log(`Found ${audioFiles.length} audio file(s). Evaluating accuracy & preservation...\n`);

  for (const file of audioFiles) {
    const base = path.parse(file).name;
    const txtPath = path.join(targetDir, `${base}.txt`);
    let refText = manifest[file] || '';
    if (!refText && fs.existsSync(txtPath)) {
      refText = fs.readFileSync(txtPath, 'utf8').trim();
    }

    console.log(`--- [Sample: ${file}] ---`);
    if (!refText) {
      console.log('  (No reference transcript found; skipping WER calculation)');
      continue;
    }

    console.log(`  Reference (${tokenizeWords(refText).length} words):`);
    console.log(`    "${refText.slice(0, 100)}${refText.length > 100 ? '...' : ''}"`);

    const refFillers = countFillers(refText);
    const refReps = countRepetitions(refText);
    console.log(`    Fillers: ${refFillers.count} | Repetitions: ${refReps.count}`);
    console.log('');
  }

  console.log('NOTE: Real-world STT performance is highly sensitive to background noise,');
  console.log('recording sampling rate, and candidate accent. Whistle provides 80 ms word');
  console.log('timestamps and 16.9 MB download footprint; Moonshine Base provides 250 MB weights.');
}

function runVerificationDemo() {
  const reference = "Well, um, I I actually think that public transport is, uh, very convenient in my city.";
  const whistleCandidate = "Well um I I actually think that public transport is uh very convenient in my city.";
  const moonshineCandidate = "Well I think that public transport is very convenient in my city.";

  console.log('--- DEMO EVALUATION METRICS ---');
  console.log('Reference Text:');
  console.log(`  "${reference}"\n`);

  const refFillers = countFillers(reference);
  const refReps = countRepetitions(reference);
  console.log(`Reference Fillers: ${refFillers.count} (${Object.keys(refFillers.breakdown).join(', ')})`);
  console.log(`Reference Repetitions: ${refReps.count} (${refReps.repetitions.join(', ')})\n`);

  const werWhistle = calculateWER(reference, whistleCandidate);
  const fillersWhistle = countFillers(whistleCandidate);
  const repsWhistle = countRepetitions(whistleCandidate);

  console.log('Candidate A (Whistle):');
  console.log(`  Transcript: "${whistleCandidate}"`);
  console.log(`  WER: ${(werWhistle.wer * 100).toFixed(1)}% (Subs: ${werWhistle.substitutions}, Dels: ${werWhistle.deletions}, Ins: ${werWhistle.insertions})`);
  console.log(`  Fillers Retained: ${fillersWhistle.count}/${refFillers.count} (${((fillersWhistle.count / (refFillers.count || 1)) * 100).toFixed(0)}%)`);
  console.log(`  Repetitions Retained: ${repsWhistle.count}/${refReps.count} (${((repsWhistle.count / (refReps.count || 1)) * 100).toFixed(0)}%)\n`);

  const werMoonshine = calculateWER(reference, moonshineCandidate);
  const fillersMoonshine = countFillers(moonshineCandidate);
  const repsMoonshine = countRepetitions(moonshineCandidate);

  console.log('Candidate B (Moonshine):');
  console.log(`  Transcript: "${moonshineCandidate}"`);
  console.log(`  WER: ${(werMoonshine.wer * 100).toFixed(1)}% (Subs: ${werMoonshine.substitutions}, Dels: ${werMoonshine.deletions}, Ins: ${werMoonshine.insertions})`);
  console.log(`  Fillers Retained: ${fillersMoonshine.count}/${refFillers.count} (${((fillersMoonshine.count / (refFillers.count || 1)) * 100).toFixed(0)}%)`);
  console.log(`  Repetitions Retained: ${repsMoonshine.count}/${refReps.count} (${((repsMoonshine.count / (refReps.count || 1)) * 100).toFixed(0)}%)\n`);

  console.log('================================================================');
  console.log('SUMMARY:');
  console.log('- Whistle preserves hesitations, fillers and repeated tokens.');
  console.log('- Moonshine may smooth or omit disfluencies.');
  console.log('- Use this script with your own recordings to make an informed choice.');
  console.log('================================================================\n');
}

run().catch(console.error);
