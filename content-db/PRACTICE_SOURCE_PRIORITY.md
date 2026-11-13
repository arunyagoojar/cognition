# Cambridge-first practice selection

13 November 2026.

New Reading and Listening practice prioritizes complete source sets matched to Cambridge IELTS books, the Official Cambridge Guide, or Cambridge IELTS Trainer. This is a source-selection preference; it does not certify every imported answer key.

| Skill | Preferred sets | Questions | Composition |
|---|---:|---:|---|
| Reading | 33 | 1,320 | 31 numbered Cambridge IELTS, 1 Official Guide, 1 Trainer |
| Listening | 45 | 1,800 | 37 numbered Cambridge IELTS, 6 Official Guide, 2 Trainer |

## Selection rules

- Standalone practice selects from matching Cambridge sources before applying recent-repeat avoidance. Recent Cambridge material still takes precedence over fresh lower-priority material.
- New focused drills first restrict candidates to the requested passage/part and question type, then apply the same Cambridge preference. A matching Cambridge recommendation keeps its original source. Other retained sources are a fallback only when that focus has no matching Cambridge material.
- Both mock assemblers select complete Cambridge Reading and Listening packages. Seeded reconstruction remains deterministic; passage, question, option, and audio ordering remain unchanged.
- Explicit selection of another enabled Reading source still works. Saved sessions and completed reviews retain their original source, subject to the existing availability policy. Priority is not a new exclusion.
- The 36 unresolved Reading sets and 41 excluded Listening sets remain excluded from new practice. All archived records and completed history are preserved.
- Writing and Speaking selection are unchanged.

`src/data/production/practicePriority.js` is the shared preference policy. `readingIdentities.json` records the 33 Reading matches, source-page fingerprints, and evidence from the deeper Reading audit; Listening reuses `listeningIdentities.json`. These are corroborated identities, mostly from secondary references. A supplied source fingerprint must match the audited fingerprint before a loaded record receives preference. Lightweight catalog entries use the same audited test IDs.

`test/practice_priority.test.js` covers both pools, repeat avoidance, fallback, all 62 currently available objective part/type focuses, all stored Listening mock IDs, deterministic reconstruction, and source-order preservation. It runs within `npm test` and `npm run test:practice-audit`.
