# Runtime Consumer Migration

## 1. Trace of Real Consumers
The React application consumes test content primarily through the following component paths:
- **`MockExamFlow.jsx`**
  - **Legacy Source:** `getRandomizedFullExam()` from `src/data/exams/examAssembler.js`
  - **Proposed Source:** `buildAuthenticMockManifest()` / `buildDynamicPracticeManifest()` adapted via `contentTestBuilder.js`
- **`ListeningModule.jsx`**
  - **Legacy Source:** `getListeningTest()`, `getRandomizedListeningTest()` from `src/data/listening/index.js`
  - **Proposed Source:** UI-adapted shape generated from the deterministic manifest.
- **`ReadingModule.jsx`**
  - **Legacy Source:** `getReadingTest()`, `getRandomizedReadingTest()` from `src/data/reading/index.js`
  - **Proposed Source:** UI-adapted shape generated from the deterministic manifest.
- **`WritingModule.jsx`**
  - **Legacy Source:** `getWritingTest()`, `getRandomizedWritingTest()` from `src/data/writing/index.js`
- **`SpeakingModule.jsx`**
  - **Legacy Source:** `getSpeakingTest()`, `getRandomizedSpeakingTest()` from `src/data/speaking/index.js`
- **`testQueue.js`**
  - **Legacy Source:** `AVAILABLE_AUTHENTIC_TESTS` from `examAssembler.js`
  - **Proposed Source:** Read `getPackagesByTestType` and filter for full tests from `contentRepository.js`.

## 2. Adaptation Strategy
The UI modules (`ListeningModule`, `ReadingModule`, etc.) expect deeply nested Javascript objects like `test.parts[].htmlContent` and `test.parts[].questions[].answer`.
The Canonical V2 schema differs slightly (e.g., `test.sections[].question_groups[].shared_content_html` and `question.correct_answer`).
Instead of redesigning the UI components, I will create `src/data/content/contentAdapter.js` which takes the deterministic v2 `manifest` and projects it EXACTLY into the shape the legacy UI components expect. This safely separates canonical structure from UI presentation.

## 3. Attempt Persistence
Currently `MockExamFlow.jsx` calls `getRandomizedFullExam()` on initialization and saves it to `saveActiveMockSession`. It currently serializes the entire massive JSON payload into localStorage, which is dangerous but functional. We will change this so it generates and stores the *manifest* containing the `generationId` and `seed`, and then re-expands that manifest into the UI object during render.

## 4. Audio Playback
`ListeningModule.jsx` expects `currentPart.audioFile`. The V2 pipeline provides `audio.canonical_path` like `assets/abc1234.mp3`. Our adapter will map `audio.canonical_path` to `audioFile`, and ensure we prefix it properly if the path is relative.

## Migration Plan
1. Create `contentAdapter.js` to map V2 schema to UI schema.
2. Update `examAssembler.js` / legacy index files to act as passthroughs to the new `contentTestBuilder.js` to minimize file changes, OR directly update the component imports. Direct component import update is safer and preferred by the prompt ("There must be one clear path: Component -> content service").
3. Ensure no `UNKNOWN` tests are leaked to `ACADEMIC` pools.
