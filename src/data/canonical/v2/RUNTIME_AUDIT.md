# Canonical V2 Runtime Audit

## 1. Actual Package Granularity
- **Listening (97 packages):** One JSON represents a complete extracted test package, which contains an array of `sections` (usually 1 to 4 sections). Each section contains question groups, audio references, and questions.
- **Reading (275 packages):** One JSON represents a complete extracted test package, which contains an array of `passages` (usually 1 to 3 passages). Each passage contains its source HTML content, embedded images, and question groups.
- **Writing (13 packages):** One JSON represents an extracted test package, which contains an array of `tasks` (Task 1 and Task 2).
- **Speaking (179 packages):** One JSON represents a specific extracted Speaking part (usually Part 2 cue cards, sample answers, or prompt discussions).

## 2. Module Schemas
- **Listening:** `ListeningTest` -> `sections` array -> `question_groups` array -> `questions` array. Includes audio asset references at the section level.
- **Reading:** `ReadingTest` -> `passages` array -> `question_groups` array -> `questions` array. Includes embedded image asset references at the passage level.
- **Writing:** `WritingTest` -> `tasks` array. Includes image references for Task 1 diagram prompts.
- **Speaking:** `SpeakingTest` -> contains `prompts`, `supporting_text`, `part`, `topic`.

## 3. Relationship Integrity
Relationships are natively hierarchical and perfectly preserved within each single JSON document. There is no ambiguous ID-linking required to match a passage to its questions—they are nested explicitly in the `passages[i].question_groups` schema. Audio files are explicitly scoped to the `ListeningSection` where they belong.

## 4. Asset Integrity
Assets are completely self-contained.
- JSON references like `canonical_path: "assets/a1b2c3d4e5f6.jpg"` map perfectly to the local `src/data/canonical/v2/assets/` directory.
- No HTTP or WordPress `wp-content` references are required for rendering.
- Total Assets: 154 deduplicated local files.

## 5. HTML Safety Findings
- Fragments contain legitimate semantic HTML elements (`<p>`, `<table>`, `<img>`, `<strong>`, etc.).
- External scripts, social sharing metadata, iframes, and ads were already decomposed by the extraction pipeline.
- **Renderer Note:** The UI may occasionally encounter residual non-malicious WordPress presentation classes (e.g., `wp-block-image`), which the styling engine can safely ignore or override.

## 6. Answer-Key Separation
- **Verified:** Answer keys are structurally fully decoupled from the student-facing HTML. 
- The `correct_answer` field exists exclusively as a string on the atomic `QuestionBase` objects in the schema.
- Hidden "Show Answers" DOM nodes were successfully stripped out by the V2 parsers, preventing accidental answer leakage to the student UI.

## 7. Academic/General Representation
The schema cleanly supports `ACADEMIC`, `GENERAL_TRAINING`, and `UNKNOWN` via the top-level `test_type` property.
Currently, a vast majority (559 packages) are `UNKNOWN` due to a lack of deterministic textual indicators in their WordPress source HTML. The runtime adapter provides the exact test types unmodified.

## 8. Runtime Adapter API
A lightweight, read-only JavaScript adapter was successfully implemented at `src/data/canonical/v2/repository.js`. It abstracts the filesystem and provides explicit programmatic access without mutation:
- `getAllListeningPackages()` / `getListeningPackage(id)`
- `getAllReadingPackages()` / `getReadingPackage(id)`
- `getAllWritingPackages()` / `getWritingPackage(id)`
- `getAllSpeakingPackages()` / `getSpeakingPackage(id)`
- `getPackagesByTestType(moduleName, testType)`
- `getVerifiedPackages(moduleName)`
- `getPackagesWithAudio()`
- `getPackagesWithImages(moduleName)`

## 9. Known Limitations
- Since many tests are strictly typed as `UNKNOWN`, a dynamic test generator will need a fallback strategy to sample from `UNKNOWN` packages if it exhausts strictly `ACADEMIC` or `GENERAL_TRAINING` packages.
- Speaking packages primarily consist of Part 2 cue cards, so generating a flawless Part 1/2/3 combined mock exam may require intelligent combining heuristics.

## 10. Recommended Next Step
Safely transition the dynamic generation and exam randomization architecture (`src/data/dynamicGenerator.js`) to consume `v2/repository.js`.

**READY_FOR_RUNTIME_INTEGRATION**
