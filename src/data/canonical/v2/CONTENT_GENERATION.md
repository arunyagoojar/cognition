# Content Generation Architecture

## Overview
Cognition IELTS now exclusively uses verified, canonical test content from the V2 extraction pipeline. 
The dynamic generation logic has been rewritten to be perfectly deterministic and preserve strict semantic relationships.

## Core Rules

1. **Deterministic Randomization**: Content selection uses Mulberry32 (via `contentRandomizer.js`), heavily seeded to ensure identical parameters always return identical test content. `Math.random()` is banned from the content layer.
2. **Canonical Relationships Preserved**:
   - **Listening**: Sections remain atomic. Audio references stay bound to their section, and questions stay bound to their audio.
   - **Reading**: Passages remain atomic. Question groups stay bound to their parent passage HTML.
   - **Writing**: Task 1 images stay bound to their Task 1 prompts.
3. **Academic vs General Training**: Deterministic filtering ensures Academic dynamic tests only select from `ACADEMIC` verified content. Unclassified (`UNKNOWN`) content will trigger a `CONTENT_INSUFFICIENT` if forced, preventing silent corruption of Academic mock structure.

## Modules

- `contentRepository.js`: A facade over `canonical/v2/repository.js`. 
- `contentSelectors.js`: Validation and filtering (e.g. `getValidListeningSections`).
- `contentRandomizer.js`: Seeded PRNG (`createPrng`, `pickWithPrng`).
- `contentTestBuilder.js`: Emits stable mock manifests representing the generated test content.

## Mock & Practice

- **Authentic Mock**: Unimplemented in the builder layer yet, but represents exactly one unaltered V2 source package.
- **Dynamic Practice**: The test builder seamlessly constructs a complete practice test by sampling Section 1 from Package A, Section 2 from Package B, etc., provided all invariants are met (audio present, etc).

## Queues and Serialization

Because generation outputs a static manifest, test attempts natively support queue retention and browser reloading. A generated manifest acts as the source of truth for the exam components, rather than randomly querying the data tier repeatedly.
