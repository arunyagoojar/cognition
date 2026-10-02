# Runtime Integration Audit

## 1. Current Source vs. Proposed Source
- **Current Source**: Content currently originates from old canonical datasets accessed via `src/data/canonical/repository.js`. There are wrapper entry points `src/data/listening/index.js`, `src/data/reading/index.js`, `src/data/writing/index.js`, and `src/data/speaking/index.js`. Dynamic generation logic resides in `src/data/canonical/dynamicGenerator.js`, which randomly picks content packages using a basic PRNG.
- **Proposed Source**: All content must originate exclusively from `src/data/canonical/v2/repository.js`. The logic will be consolidated into a structured service layer under `src/data/content/` (including `contentTestBuilder.js`, `contentRandomizer.js`, `contentSelectors.js`, and `contentRepository.js`).

## 2. Files Affected
- **Legacy Dependencies to Deprecate/Replace later:** 
  - `src/data/listening/index.js`
  - `src/data/reading/index.js`
  - `src/data/writing/index.js`
  - `src/data/speaking/index.js`
  - `src/data/canonical/dynamicGenerator.js`
  - `src/data/exams/examAssembler.js`
- **New Service Layer to Create:**
  - `src/data/content/contentRepository.js`
  - `src/data/content/contentSelectors.js`
  - `src/data/content/contentRandomizer.js`
  - `src/data/content/contentTestBuilder.js`

## 3. Existing Selection/Randomization/Queue Logic
- **Existing Mock Generation**: `examAssembler.js` builds authentic exams from the legacy repository.
- **Existing Practice Randomization**: `dynamicGenerator.js` uses Mulberry32 to deterministically select one full package of each module. However, the legacy modules (`src/data/listening/index.js`) contain raw `Math.random()` to pick arrays. This completely breaks deterministic seeding and invariant validation.
- **Existing Queue/Rotation Logic**: Currently absent or loosely coupled. Needs strict integration with generated deterministic manifests.
- **Existing Answer Key / Audio Lookup**: Handled manually via object mapping in legacy `index.js`.
- **Existing Result/Evaluation**: Hardcoded expectations for the legacy structures. Will be preserved unchanged for now.

## 4. Migration Risks
- Legacy `index.js` files use raw `Math.random()`, ignoring seeds completely.
- Existing scoring and UI expect flat structural mappings. The new `contentTestBuilder.js` must emit the exact expected shapes for `ListeningTest`, `ReadingTest`, etc., that the UI currently consumes, but constructed accurately from v2 atomic packages.
- Mixing 1-to-4 section Listening tests means we must gracefully assemble 4 distinct sections from the pool of valid V2 Listening tests when building a dynamic test.

## 5. Duplicate Content Systems
- The app currently features dual-layer logic: `dynamicGenerator.js` handles seeded random selection, but `listening/index.js` does its own unseeded randomization. This creates conflicting behaviors and duplicates responsibility. We will replace this with a single unified, deterministic flow under `src/data/content/`.
