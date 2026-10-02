import { buildDynamicPracticeManifest, validateManifest } from '../src/data/content/contentTestBuilder.js';
import assert from 'assert';

function testDeterministicGeneration() {
  console.log("=== Deterministic Generation Tests ===");
  
  // 1. Same seed -> Identical output
  const res1 = buildDynamicPracticeManifest({ seed: "test-seed-123", testType: "UNKNOWN" });
  const res2 = buildDynamicPracticeManifest({ seed: "test-seed-123", testType: "UNKNOWN" });
  
  assert.strictEqual(res1.status, "OK");
  assert.strictEqual(res2.status, "OK");
  assert.strictEqual(res1.generationId, res2.generationId);
  
  const h1 = res1.modules.listening.sections[0].sourcePackageId;
  const h2 = res2.modules.listening.sections[0].sourcePackageId;
  assert.strictEqual(h1, h2, "Same seed must pick the exact same package");
  
  // 2. Different seed -> Different valid output (or same if pool is very small, but generationId is different)
  const res3 = buildDynamicPracticeManifest({ seed: "different-seed-456", testType: "UNKNOWN" });
  assert.strictEqual(res3.status, "OK");
  assert.notStrictEqual(res1.generationId, res3.generationId, "Different seed must have different generationId");
  
  // 3. Listening section/audio integrity
  const sec1 = res1.modules.listening.sections[0];
  assert.strictEqual(sec1.sectionNumber, 1, "Must be section 1");
  assert(sec1.audio.startsWith("assets/"), "Audio must exist and be canonical");
  assert(sec1.section.question_groups.length > 0, "Questions must exist");
  
  // 4. Reading passage integrity
  const p2 = res1.modules.reading.passages[1];
  assert.strictEqual(p2.passageNumber, 2, "Must be passage 2");
  assert(p2.passage.question_groups.length > 0, "Reading questions must exist");
  
  // 5. Academic never selects UNKNOWN
  // The academic pool is practically 0 in our V2 import, so it should fail safely.
  const academicRes = buildDynamicPracticeManifest({ seed: "test-seed", testType: "ACADEMIC" });
  assert.strictEqual(academicRes.status, "CONTENT_INSUFFICIENT", "Must safely fail if insufficient Academic content");
  
  // 6. Validation functions
  assert.strictEqual(validateManifest(res1), true, "Generated manifest must pass validation");
  
  // We purposely corrupt the manifest to test validation
  const corrupted = JSON.parse(JSON.stringify(res1));
  corrupted.modules.listening.sections[0].sectionNumber = 99; // Corrupt section mapping
  assert.strictEqual(validateManifest(corrupted), false, "Validation must catch corrupted section numbers");
  
  console.log("All Deterministic Generation Tests Passed!");
}

testDeterministicGeneration();
