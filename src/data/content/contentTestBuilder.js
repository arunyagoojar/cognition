import { createPrng, pickWithPrng } from './contentRandomizer.js';
import {
  getValidListeningSections,
  getValidReadingPassages,
  getValidWritingTasks,
  getValidSpeakingPackages
} from './contentSelectors.js';
import { getPackagesByTestType } from './contentRepository.js';

/**
 * Builds a deterministic mock test manifest from verified sources.
 */
export function buildDynamicPracticeManifest({ seed, testType }) {
  const prng = createPrng(seed);
  
  // Listening: Need 4 sections from 4 valid sources
  const s1Pool = getValidListeningSections(1, testType);
  const s2Pool = getValidListeningSections(2, testType);
  const s3Pool = getValidListeningSections(3, testType);
  const s4Pool = getValidListeningSections(4, testType);
  
  // Reading: Need 3 passages from 3 valid sources
  const p1Pool = getValidReadingPassages(1, testType);
  const p2Pool = getValidReadingPassages(2, testType);
  const p3Pool = getValidReadingPassages(3, testType);
  
  // Writing: Task 1 and Task 2
  const wt1Pool = getValidWritingTasks(1, testType);
  const wt2Pool = getValidWritingTasks(2, testType);
  
  // Speaking: 1 package (can be cue card, etc)
  const spkPool = getValidSpeakingPackages();

  // If we lack content, report it
  if (!s1Pool.length || !s2Pool.length || !s3Pool.length || !s4Pool.length ||
      !p1Pool.length || !p2Pool.length || !p3Pool.length ||
      !wt1Pool.length || !wt2Pool.length ||
      !spkPool.length) {
    return {
      status: "CONTENT_INSUFFICIENT",
      testType: testType,
      error: "Could not satisfy dynamic generation invariant due to insufficient strictly typed verified content."
    };
  }

  const s1 = pickWithPrng(s1Pool, prng);
  const s2 = pickWithPrng(s2Pool, prng);
  const s3 = pickWithPrng(s3Pool, prng);
  const s4 = pickWithPrng(s4Pool, prng);
  
  const p1 = pickWithPrng(p1Pool, prng);
  const p2 = pickWithPrng(p2Pool, prng);
  const p3 = pickWithPrng(p3Pool, prng);
  
  const wt1 = pickWithPrng(wt1Pool, prng);
  const wt2 = pickWithPrng(wt2Pool, prng);
  
  const spk = pickWithPrng(spkPool, prng);

  return {
    status: "OK",
    generationId: `dyn-${seed}`,
    seed: seed,
    mode: "dynamic_practice",
    testType: testType,
    modules: {
      listening: {
        sections: [
          { sourcePackageId: s1.packageId, sectionNumber: 1, audio: s1.section.audio.canonical_path, section: s1.section },
          { sourcePackageId: s2.packageId, sectionNumber: 2, audio: s2.section.audio.canonical_path, section: s2.section },
          { sourcePackageId: s3.packageId, sectionNumber: 3, audio: s3.section.audio.canonical_path, section: s3.section },
          { sourcePackageId: s4.packageId, sectionNumber: 4, audio: s4.section.audio.canonical_path, section: s4.section }
        ]
      },
      reading: {
        passages: [
          { sourcePackageId: p1.packageId, passageNumber: 1, passage: p1.passage },
          { sourcePackageId: p2.packageId, passageNumber: 2, passage: p2.passage },
          { sourcePackageId: p3.packageId, passageNumber: 3, passage: p3.passage }
        ]
      },
      writing: {
        tasks: [
          { sourcePackageId: wt1.packageId, taskNumber: 1, task: wt1.task },
          { sourcePackageId: wt2.packageId, taskNumber: 2, task: wt2.task }
        ]
      },
      speaking: {
        packageId: spk.canonical_id,
        package: spk
      }
    }
  };
}

/**
 * Builds a deterministic Authentic Mock manifest from verified sources.
 * It selects exactly ONE source (test_id) where ALL required modules overlap.
 */
export function buildAuthenticMockManifest({ seed, testType }) {
  const prng = createPrng(seed);
  
  const lpkgs = getPackagesByTestType('listening', testType).filter(p => p.validation_state === 'VERIFIED' && p.sections?.length === 4);
  const rpkgs = getPackagesByTestType('reading', testType).filter(p => p.validation_state === 'VERIFIED' && p.passages?.length === 3);
  const wpkgs = getPackagesByTestType('writing', testType).filter(p => p.validation_state === 'VERIFIED' && p.tasks?.length === 2);
  const spkgs = getValidSpeakingPackages();

  // Find all test_ids that have representation in all 4 modules
  const lMap = new Map();
  const rMap = new Map();
  const wMap = new Map();
  const sMap = new Map();

  // Helper to group by test_id. If a test_id appears MULTIPLE times in the SAME module, 
  // it is a dummy/generic ID (like "test_0") and CANNOT be used to establish a strict 1:1:1:1 relationship.
  const addToMap = (map, pkgs) => {
    for (const p of pkgs) {
      if (!p.test_id) continue;
      if (map.has(p.test_id)) {
        map.set(p.test_id, 'COLLISION'); // Mark as invalid for authentic mock
      } else {
        map.set(p.test_id, p);
      }
    }
  };

  addToMap(lMap, lpkgs);
  addToMap(rMap, rpkgs);
  addToMap(wMap, wpkgs);
  addToMap(sMap, spkgs);

  const validTestIds = [...lMap.keys()].filter(id => 
    lMap.get(id) !== 'COLLISION' &&
    rMap.get(id) && rMap.get(id) !== 'COLLISION' &&
    wMap.get(id) && wMap.get(id) !== 'COLLISION' &&
    sMap.get(id) && sMap.get(id) !== 'COLLISION'
  );

  if (validTestIds.length === 0) {
    return {
      status: "CONTENT_INSUFFICIENT",
      testType: testType,
      error: "No strict 1:1:1:1 source test_id relationship spans all 4 modules. Cannot assemble a legitimate authentic mock without fabricating relationships."
    };
  }

  const selectedTestId = pickWithPrng(validTestIds, prng);
  const lPkg = lMap.get(selectedTestId);
  const rPkg = rMap.get(selectedTestId);
  const wPkg = wMap.get(selectedTestId);
  const sPkg = sMap.get(selectedTestId);

  return {
    status: "OK",
    generationId: `mock-${seed}`,
    seed: seed,
    mode: "authentic_mock",
    testType: testType,
    modules: {
      listening: {
        sections: lPkg.sections.map(s => ({
          sourcePackageId: lPkg.canonical_id,
          sectionNumber: s.section_number,
          audio: s.audio.canonical_path,
          section: s
        }))
      },
      reading: {
        passages: rPkg.passages.map(p => ({
          sourcePackageId: rPkg.canonical_id,
          passageNumber: p.passage_number,
          passage: p
        }))
      },
      writing: {
        tasks: wPkg.tasks.map(t => ({
          sourcePackageId: wPkg.canonical_id,
          taskNumber: t.task_number,
          task: t
        }))
      },
      speaking: {
        packageId: sPkg.canonical_id,
        package: sPkg
      }
    }
  };
}

/**
 * Validates a generated manifest invariant.
 */
export function validateManifest(manifest) {
  if (manifest.status !== "OK") return false;
  
  const { listening, reading, writing, speaking } = manifest.modules;
  
  // Listening validation
  for (let i = 0; i < 4; i++) {
    const sec = listening.sections[i];
    if (sec.sectionNumber !== i + 1) return false;
    if (!sec.audio) return false;
    // ensure all questions belong
    if (!sec.section.question_groups || sec.section.question_groups.length === 0) return false;
  }
  
  // Reading validation
  for (let i = 0; i < 3; i++) {
    const pas = reading.passages[i];
    if (pas.passageNumber !== i + 1) return false;
    if (!pas.passage.question_groups || pas.passage.question_groups.length === 0) return false;
  }
  
  return true;
}
