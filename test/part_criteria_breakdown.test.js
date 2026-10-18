import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const output = path.resolve('node_modules/.cache/cognition-test/PartCriteriaBreakdown.mjs');
await build({ stdin: { contents: "export {default} from './src/components/common/PartCriteriaBreakdown.jsx';", resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, format: 'esm', platform: 'node', outfile: output, jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'], logLevel: 'silent' });
const { default: Breakdown } = await import(pathToFileURL(output).href);
const render = props => renderToStaticMarkup(React.createElement(Breakdown, props));
const speakingKeys = ['fluencyAndCoherence', 'lexicalResource', 'grammaticalRangeAndAccuracy'];
const diagnostics = Object.fromEntries([1, 2, 3].map(part => [`part${part}`, {
  practiceBand: 5 + part / 2,
  needsPractice: true,
  criteria: Object.fromEntries(speakingKeys.map((key, index) => [key, { band: part + index + 3, evidence: `An exact quote from Part ${part}.`, feedback: `Develop the ${key} evidence.` }])),
  reason: 'Develop the example with a specific detail.',
  nextAction: 'Give one example that supports your point.',
}]));
const summary = render({ partDiagnostics: diagnostics });
assert(summary.includes('Part practice estimates'));
assert(summary.includes('Separate from your overall Speaking grade'));
assert.equal((summary.match(/class="part-criteria-row"/g) || []).length, 9);
assert(summary.includes('Part 2, Lexical resource:'));
assert(summary.includes('An exact quote from Part 3.'));
assert(summary.includes('<details'));
assert(!summary.includes('Task fulfilment'));
assert(!summary.includes('Pronunciation</span>'), 'pronunciation must not appear as a scored part criterion');
const sections = [1, 2, 3].map(part => ({ key: part, band: diagnostics[`part${part}`].practiceBand, criteria: diagnostics[`part${part}`].criteria, observation: diagnostics[`part${part}`] }));
const performance = render({ sections, onPractice() {} });
assert.equal((performance.match(/class="part-criteria-row"/g) || []).length, 9);
for (const part of [1, 2, 3]) assert(performance.includes(`Practise Part ${part}`));
const drill = render({ partDiagnostics: diagnostics, partNumbers: [2] });
assert.equal((drill.match(/class="part-criteria-row"/g) || []).length, 3);
assert(drill.includes('<h4>Part 2</h4>'));
assert(!drill.includes('<h4>Part 1</h4>') && !drill.includes('<h4>Part 3</h4>'), 'focused practice must show only the selected part');

const writing = render({ skill: 'writing', sections: [1, 2].map(part => ({ key: part, band: part === 1 ? 7.5 : 6, criteria: Object.fromEntries([part === 1 ? 'taskAchievement' : 'taskResponse', 'coherenceAndCohesion', 'lexicalResource', 'grammaticalRangeAndAccuracy'].map(key => [key, { band: 6, rationale: 'A task-specific assessment.', evidence: `Task ${part} exact quotation.` }])) })) });
assert(writing.includes('Writing task estimates'));
assert(writing.includes('Task 2 carries twice the weight'));
assert.equal((writing.match(/class="part-criteria-row"/g) || []).length, 8);
assert(writing.includes('Task 1, Task achievement:'));
assert(writing.includes('Task 2, Task response:'));
assert(writing.includes('7.5'));
assert(writing.includes('6.0'));
assert(!writing.includes('Fluency</span>'));
assert(!writing.includes('Part 3'));

const legacy = render({ partDiagnostics: { part2: { needsPractice: true, reason: 'Add a relevant example.', evidence: 'A preserved candidate quote.' } } });
assert(legacy.includes('Qualitative feedback'));
assert(legacy.includes('A preserved candidate quote.'));
assert(!legacy.includes('0.0'));
assert.equal((legacy.match(/class="part-criteria-row"/g) || []).length, 0, 'old qualitative results must not acquire invented grades');
assert(render({}).includes('Your saved result has no part estimates'));
assert(render({}).includes('Recheck your saved full Speaking test'));
console.log('✓ shared part/task UI: three Speaking criteria per part, four Writing criteria per task, exact evidence and labelled estimates, qualitative legacy fallback');
