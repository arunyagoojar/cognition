# Content V3 Database — Final Forensic Audit

**Status:** `BLOCKED`

This document serves as the definitive reconciliation of the V3 Database reconstruction. The audit was conducted against the raw website source and the generated JSON payloads in `src/data/content-v3/`.

## 1. Reconciling Listening Counts
*   **Total Tests:** 96 complete tests (exactly 4 sections each).
*   **Total Sections:** 384 (Correcting previous reports of 387/388).
*   **Audio References:** 95 unique audio files. Tests `LIS-4568dbc5-test_0` and `LIS-748ab6cd-test_0` share the exact same audio asset (`assets/eb687a895c36.mp3`), explaining the 96 vs 95 discrepancy.
*   **Total Questions:** 3,241 questions inside the 96 complete tests. The in-memory counter of 3,266 includes 25 questions from incomplete tests that were discarded during assembly.

## 2. Reconciling Reading Count Discrepancy
*   **Discrepancy Explained:** The pipeline reported 9,683 verified questions, but only 9,352 questions exist within the final assembled tests.
*   **Cause:** The reconstruction engine extracts questions individually and increments the `verifiedQuestions` counter. However, at the test assembly stage, tests with `< 25` valid questions are discarded. The 331 "missing" questions belong to these discarded tests.

## 3. Loss of 5 Reading Tests
*   **Original:** 275 test directories in raw source.
*   **Current:** 270 valid tests.
*   **Cause:** The 5 missing tests failed to meet the `testQuestions.length >= 25` threshold required for a valid Reading test and were subsequently dropped/quarantined. 

## 4. Provenance Audit for Listening
*   A random sample of 25 Listening questions was programmatically audited.
*   **Result:** 25/25 (100%) correctly maintained `sourceEvidence` (including `sourceFile` and `sourceHash`) linking back to the raw source HTML.

## 5. Listening Structure Audit
*   **Result:** All 96 tests enforce an atomic 4-section structure. Every section successfully references a corresponding audio asset object pointing to a local file.

## 6. Inline Blank Validation (BLOCKER)
*   **Result:** FAILED. 
*   **Details:** 213 Listening questions still contain `[BLANK]`, `______`, or `_____` placeholders instead of the normalized `[INLINE_INPUT_N]`. The current pipeline logic in `build_content_v3.js` fails to normalize underscores and misses some `[BLANK]` cases.

## 7. Semantic Reading Audit
*   A random sample of 50 Reading questions was audited for semantic validity.
*   **Result:** 50/50 passed. Prompts are well-formed (no missing stems), and Multiple Choice questions have at least 2 valid options.

## 8. Writing Task Visual/Semantic Validation
*   **Result:** Passed. All 12 Writing Task 1 packages successfully parsed visual data into a strict `{ title, headers, rows }` structural payload, completely eliminating arbitrary `<table>` HTML.

## 9. Speaking Module Investigation
*   **Result:** Confirmed. The previous quarantine decision was correct.
*   **Details:** A recursive forensic read of the 180 "speaking-cue-card" HTML directories revealed that they are entirely SEO-driven blog posts. They contain numbered lists of sentences for students to memorize (e.g., "1. I love to write... 2. I have always dreamt..."). There are ZERO authentic examiner prompts or cue card instructions present in the raw source. 

---

### Conclusion
**The V3 Database cannot proceed to runtime integration.** 

The V3 database is internally consistent and strictly provenance-bound, but the Listening extraction engine must be patched to correct the 213 inline blank placeholder failures before integration can begin.
