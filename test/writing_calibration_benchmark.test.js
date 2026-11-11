import assert from 'node:assert/strict';
import { checkWritingCalibration } from '../scripts/lib/writingCalibrationBenchmark.mjs';
const result = checkWritingCalibration();
assert.equal(result.humanReferenceSamples.length, 12);
assert.equal(result.predictiveModelMetrics, null);
for (const check of result.checks) assert(check.passed, `${check.id}: ${check.rule}`);
console.log(`Offline writing calibration: ${result.checks.length} safeguards passed against ${result.humanReferenceSamples.length} published human-band references. No live grading or model accuracy claim.`);
