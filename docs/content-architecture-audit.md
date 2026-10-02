# Cognition IELTS Content Architecture Audit

## 1. Executive Summary
This audit provides a comprehensive inspection of the existing Cognition application architecture, data models, content repositories, audio/visual assets, scoring pipelines, and randomization mechanics prior to implementing the unified canonical content architecture.

---

## 2. Current Architecture & Stack

### 2.1 Technology Stack & Tooling
* **Framework:** React 19.2.8 (`react`, `react-dom`) + Vite 8.3.0
* **Animation & UI:** Motion 13.4.6, Lucide React 1.47.0, Tailwind CSS 4.3.3
* **Linting & Quality:** Oxlint 1.81.0, TypeScript compiler (`tsc`)
* **Python Runtime:** Python 3.12+ with PyMuPDF 1.28.2 (`fitz`) and macOS Vision framework for OCR/coordinate detection

### 2.2 Navigation & Routing Architecture
* **State-Based Router:** Managed in `src/App.jsx` with views: `home`, `performance`, `learning`, `listening`, `reading`, `writing`, `speaking`, `mock`.
* **Contextual Navigation:** `src/components/navigation/ContextualNav.jsx` provides synchronized breadcrumb hierarchy and diagnostic status pills.

### 2.3 State Management & Storage
* **Canonical Performance Store:** `src/utils/performanceStore.js` (`omniprep_performance_store_v1`) provides the single source of truth for attempts, scores, and derived analytics (`derivePerformanceSummary()`).
* **Rotation Queue:** `src/utils/testQueue.js` (`omniprep_test_rotation_queue_v1`) maintains deterministic FIFO test rotation across sessions.
* **Reactive Store Updates:** Custom DOM events (`omniprep:performance_updated`) enable cross-component reactivity without full browser reloads.

---

## 3. Current Data Sources & Content Pools

### 3.1 Listening Pools (`src/data/listening/`)
* **Parts Directory:** `src/data/listening/parts/*.json` (96 JSON files: Books 14–19, Tests 1–4, Parts 1–4).
* **Structure:** Each JSON file represents a 10-question part with `testId`, `part` (1–4), `audioFile`, and a flat `questions[]` array.
* **Audio Assets:** `public/audio/cambridge{book}_test{test}_part{part}.mp3` (97 active MP3 files, all >1MB).

### 3.2 Reading Pools (`src/data/reading/`)
* **Passages Directory:** `src/data/reading/passages/*.json` (72 JSON files: Books 14–19, Tests 1–4, Passages 1–3).
* **Structure:** Each JSON file contains `passageNumber`, `title`, `text`, and `questions[]` (13 or 14 questions).

### 3.3 Writing Pools (`src/data/writing/`)
* **Pool Engine:** `src/data/writing/writingPool.js` (113 KB) containing 24 complete task sets (`wr-c14-t1` through `wr-c19-t4`).
* **Visual Assets:** `public/images/cambridge{book}_test{test}_task1.png` (24 high-resolution diagram/chart assets).
* **Structure:** Contains Task 1 prompt, authentic diagram image, Band 9 model report, Task 2 prompt, and Band 9 model essay.

### 3.4 Speaking Pools (`src/data/speaking/`)
* **Pool Engine:** `src/data/speaking/speakingPool.js` (142 KB) containing 24 complete 3-part interview suites (`sp-c14-t1` through `sp-c19-t4`).
* **Structure:** Part 1 everyday questions, Part 2 1-minute prep cue card, Part 3 abstract discussion questions.

### 3.5 Authentic Test Manifests (`src/data/exams/examAssembler.js`)
* Defines 24 authentic Cambridge exams (`c14-t1` through `c19-t4`).
* Assembles full exams via `getAuthenticExam(testId)`.

---

## 4. Current Problems Identified

1. **Synthetic Placeholders in Partial Ingestions:** Several listening/reading JSON files (e.g. `c14_t1_p1.json`, `c14_t1_pass1.json`) contain placeholder answer strings (e.g. `"answer2"`, `"\uffff27"`) from early regex passes rather than canonical verified content.
2. **Lack of Immutable Canonical IDs:** Questions currently use raw integer numbers (`1`, `2`, `3`) or flat keys rather than immutable identifiers (`CAM14-T4-L-S1-Q01`).
3. **Missing Source Evidence Lineage:** Extracted questions lack provenance metadata (PDF source, page number, bounding box coordinates, extraction method, confidence score).
4. **Loosely Structured Answer Keys:** Answers are stored as simple string arrays (`["litter"]`) without first-class rule definitions (case sensitivity, numeric tolerance, plural variants, article allowances).
5. **Question Grouping Omission:** Listening and Reading questions are stored as flat arrays without preserving question group boundaries (e.g., Note Completion vs. Multiple Choice vs. Table Completion).
6. **Unconstrained Random Practice:** `getRandomizedListeningTest()` uses unbounded `Math.random()` without seed reproducibility or validation states.
7. **No Automated Content Validation CLI:** No single script validates schemas, audio existence, image resolution, answer key completeness, and full-test reconstruction.

---

## 5. Target Canonical Architecture & Migration Strategy

```
SOURCE (Cambridge PDFs & Audio)
        ↓
DETERMINISTIC EXTRACTION (PyMuPDF Coordinates & Native Text)
        ↓
CANONICAL CONTENT LAYER (Immutable IDs, Structured Question Groups, Source Evidence)
        ↓
CONTENT VALIDATOR (Schema, Reference, Asset, Answer Key Checks)
        ↓
VERIFIED PACKAGES (Only VERIFIED content enters practice pools)
        ↓
APPLICATION ADAPTERS (Safe consumption by UI & Exam Engines)
```

### Migration Principles:
1. **Zero Breakage Guarantee:** Existing UI components (`ListeningModule`, `ReadingModule`, `WritingModule`, `SpeakingModule`, `MockExamFlow`) continue to function without disruption.
2. **Adapter Layer:** Expose backward-compatible APIs (`getListeningSection`, `getReadingPassage`, `getWritingTask`, `getSpeakingPart`, `createAuthenticMock`, `generateDynamicPractice`).
3. **Three Separate Domains:**
   - **Content:** Questions, passages, prompts, audio, images, transcripts, source evidence, validation metadata.
   - **Test Rotation:** Queue order, seeds, cycle tracking.
   - **Performance:** User attempts, answers, bands, AI evaluations.

---

## 6. File Scope & Modification Boundaries

### Files to be Created:
* `src/data/canonical/types.ts`: TypeScript definitions for canonical packages, groups, answers, and manifests.
* `src/data/canonical/normalizer.js`: Deterministic text and answer normalization.
* `src/data/canonical/sourceEvidence.js`: Source evidence tracking and coordinate schema.
* `src/data/canonical/validator.js`: Comprehensive content validation engine.
* `src/data/canonical/dynamicGenerator.js`: Seeded, reproducible package-constrained practice generator.
* `src/data/canonical/reconstructor.js`: Full-test reconstruction and fidelity verifier.
* `src/data/canonical/manifests/`: Immutable authentic Cambridge test manifests (Books 14–19).
* `src/data/canonical/repository.js`: Content loader and querying service.
* `scripts/validate_content.js`: CLI tool for `npm run validate:content`.
* `test/randomization.test.js`: Property-based and seed reproducibility test suite (100+ iterations).

### Files to be Enhanced with Adapters:
* `src/data/listening/index.js`
* `src/data/reading/index.js`
* `src/data/writing/index.js`
* `src/data/speaking/index.js`
* `src/data/exams/examAssembler.js`
* `package.json` (add `validate:content` and test scripts)

### Files to Remain Untouched:
* `src/utils/performanceStore.js` (Authoritative score single source of truth)
* `src/utils/bandCalculator.js` (Cambridge rounding and band tables)
* `src/utils/geminiEvaluator.js` (Versioned system prompts and AI evaluation)
* UI presentation styles, navigation layout, theme configs.
