# Cognition IELTS Content Inventory

**Generated At:** 2026-10-02T06:27:01.521Z  
**Status:** `CONTENT_FORENSIC_STATUS: INVENTORY_COMPLETE`

---

## Executive Summary

| Category | Total Packages | Total Records | Usable Records | Quarantined Records | Usable Yield % |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Listening** | 97 | 3880 questions | 2694 | 1186 | 69.4% |
| **Reading** | 275 | 11000 questions | 0 | 11000 | 0.0% |
| **Writing** | 13 | 26 tasks | 24 | 2 | 92.3% |
| **Speaking** | 179 | 179 packages | 0 | 179 | 0.0% |
| **CROSS-MODULE TOTAL** | **564** | **14906** | **2718** | **12367** | **18.2%** |

> [!CRITICAL]
> **Key Forensic Finding:** Package counts (564) were deeply misleading. While we have **2694 genuinely usable Listening questions** and **24 usable Writing tasks**, all **11,000 Reading question records** in canonical v2 are malformed (each question's text was overwritten with group instructions while options were set to null), and all **179 Speaking packages** contain 0 prompts (blog sample answers were extracted instead of questions).

---

## 1. Listening Inventory

### Metrics

| Metric | Count |
| :--- | :--- |
| Packages | 97 |
| Complete 4-section tests | 97 |
| Partial tests (< 4 sections) | 0 |
| Sections | 388 |
| Question groups | 830 |
| Total question records | 3880 |
| **Usable questions** | **2694** |
| **Quarantined questions** | **1186** |
| Malformed questions | 1186 |
| Empty questions | 0 |
| Duplicate question numbers (in section) | 131 |
| Exact cross-test duplicates | 86 |
| Unsupported question types | 0 |
| Questions with verified audio | 3880 (100.0%) |
| Questions without audio | 0 |
| Groups with instructions | 830 / 830 |
| Groups with shared options | 0 |
| Unique audio asset files on disk | 96 |
| Missing audio assets | 0 |

### Listening Question-Type Distribution

| Type | Total | Usable | Quarantined | Input Type |
| :--- | :--- | :--- | :--- | :--- |
| `NOTE_COMPLETION` | 1501 | 1299 | 202 | `INLINE_BLANK` |
| `MULTIPLE_CHOICE_SINGLE` | 844 | 662 | 182 | `SINGLE_SELECT` |
| `SENTENCE_COMPLETION` | 349 | 305 | 44 | `INLINE_BLANK` |
| `MULTIPLE_CHOICE_MULTI` | 321 | 0 | 321 | `MULTI_SELECT` |
| `TABLE_COMPLETION` | 269 | 45 | 224 | `INLINE_BLANK` |
| `FORM_COMPLETION` | 230 | 159 | 71 | `INLINE_BLANK` |
| `MAP_LABELING` | 136 | 107 | 29 | `TEXT_OR_SELECT` |
| `SUMMARY_COMPLETION` | 91 | 27 | 64 | `INLINE_BLANK` |
| `DIAGRAM_LABELING` | 74 | 25 | 49 | `TEXT` |
| `SHORT_ANSWER` | 41 | 41 | 0 | `TEXT` |
| `MATCHING` | 24 | 24 | 0 | `TEXT_OR_SELECT` |

### Listening Quarantine Reasons

| Reason | Count | Explanation |
| :--- | :--- | :--- |
| `OPTIONS_MISSING_WHEN_REQUIRED` | 493 | Multiple-choice question with null or lumped options (< 2 options) |
| `ONLY_ANSWER_FIELD` | 378 | Question text contains only blank tokens and numbers (e.g. (3) [BLANK] (4)) |
| `ONLY_BLANK` | 183 | Question text contains solely [BLANK] with no prompt context |
| `DUPLICATE_QUESTION` | 131 | Duplicate question number or repeated question within section |
| `INVALID_QUESTION_NUMBER` | 1 | Failed quality gate rule |

---

## 2. Reading Inventory

### Metrics

| Metric | Count |
| :--- | :--- |
| Packages | 275 |
| Complete 3-passage tests | 275 |
| Partial tests (< 3 passages) | 0 |
| Passages | 825 |
| Question groups | 2361 |
| Total question records | 11000 |
| **Usable questions** | **0** |
| **Quarantined questions** | **11000** |
| Malformed questions | 11000 |
| Empty questions | 0 |
| Question text equals group instruction | 11000 |
| Options missing when required | 0 |
| Duplicate question numbers | 0 |
| Unsupported question types | 0 |

### Reading Question-Type Distribution (from Group Instructions)

| Semantic Type | Total Records | Usable | Quarantined | Reason for 100% Quarantine |
| :--- | :--- | :--- | :--- | :--- |
| `UNCLASSIFIED` | 3122 | 0 | 3122 | Question text was replaced by group instruction; options are null. |
| `SUMMARY_COMPLETION` | 1321 | 0 | 1321 | Question text was replaced by group instruction; options are null. |
| `MULTIPLE_CHOICE_SINGLE` | 1048 | 0 | 1048 | Question text was replaced by group instruction; options are null. |
| `MATCHING_INFORMATION` | 879 | 0 | 879 | Question text was replaced by group instruction; options are null. |
| `SENTENCE_COMPLETION` | 856 | 0 | 856 | Question text was replaced by group instruction; options are null. |
| `MATCHING_HEADINGS` | 782 | 0 | 782 | Question text was replaced by group instruction; options are null. |
| `MATCHING_FEATURES` | 771 | 0 | 771 | Question text was replaced by group instruction; options are null. |
| `YES_NO_NOT_GIVEN` | 422 | 0 | 422 | Question text was replaced by group instruction; options are null. |
| `NOTE_COMPLETION` | 406 | 0 | 406 | Question text was replaced by group instruction; options are null. |
| `DIAGRAM_LABELING` | 335 | 0 | 335 | Question text was replaced by group instruction; options are null. |
| `MATCHING` | 320 | 0 | 320 | Question text was replaced by group instruction; options are null. |
| `TABLE_COMPLETION` | 257 | 0 | 257 | Question text was replaced by group instruction; options are null. |
| `MULTIPLE_CHOICE_MULTI` | 250 | 0 | 250 | Question text was replaced by group instruction; options are null. |
| `SHORT_ANSWER` | 223 | 0 | 223 | Question text was replaced by group instruction; options are null. |
| `FORM_COMPLETION` | 8 | 0 | 8 | Question text was replaced by group instruction; options are null. |

### Forensic Root Cause for Reading Failure:
In the canonical v2 extraction of Reading:
1. Every individual question's `question_text` was systematically populated with the parent group's instruction (e.g. `"Questions 1-5 Look at the following..."`).
2. `options` was set to `null` across all 11,000 questions.
3. The actual question text, question options, and blank numbers were leaked into `passage.content_html`.
4. Therefore, zero Reading questions can be safely presented in the UI without quarantining until re-parsed.

---

## 3. Writing Inventory

### Metrics

| Metric | Count |
| :--- | :--- |
| Packages | 13 |
| Task 1 records | 13 |
| Task 2 records | 13 |
| Academic Task 1 | 13 |
| General Training Task 1 | 0 |
| Task 2 Total | 13 |
| **Usable Task 1** | **12** |
| **Usable Task 2** | **12** |
| Total Usable Writing Tasks | **24** |
| Quarantined Tasks | 2 |
| Missing prompt | 0 |
| Missing required image | 0 |
| Malformed / Blog navigation garbage | 2 |
| Duplicate prompts | 0 |

### Task Distribution

| Task Type | Total | Usable | Quarantined | Note |
| :--- | :--- | :--- | :--- | :--- |
| `TASK_1_TABLE` | 12 | 12 | 0 | Clean inline HTML tables with word requirement = 150 |
| `TASK_2_ESSAY` | 12 | 12 | 0 | Clean standard essay prompts with word requirement = 250 |
| `EXTRACTION_GARBAGE` | 2 | 0 | 2 | Package `WRI-3add27d5-18` contains blog post link lists |

### Source Junk to Strip:
All 24 usable Writing tasks contain source site junk that must be stripped in normalized storage:
- `<a href="../cambridge-ielts-1-13-tests/index.html"...>Cambridge IELTS Tests 1 to 17</a>`
- Google AdSense tags: `<ins data-ad-client="ca-pub-..." data-ad-slot="..." ...></ins>`
- Empty repeated `<p class="wp-block-paragraph"></p>` wrappers

---

## 4. Speaking Inventory

### Metrics

| Metric | Count |
| :--- | :--- |
| Packages | 179 |
| Part 1 questions | 0 |
| Part 2 cue cards | 0 |
| Part 3 questions | 0 |
| Complete Part 1 sets | 0 |
| Complete Part 2 records | 0 |
| Complete Part 3 records | 0 |
| Complete Sets (P1 + P2 + P3) | 0 |
| Records with missing prompts | 179 (100%) |
| Records with malformed prompts | 0 |
| Sample answer leakage records | 179 (100%) |
| **Total Usable Prompts** | **0** |
| **Total Quarantined Packages** | **179** |

### Audit: Why the UI displays "No question available."
The runtime error is caused by **A & E (Extraction Malformation & Canonical Data Missing)**:
1. Every single file in `src/data/canonical/v2/speaking/` (179 files) has:
   - `prompts: []` (an empty array)
   - `cue_card_instructions: null`
2. The topic was hardcoded by the extractor to: `"Talk about a time when you gave advice to someone"` across all 179 packages regardless of the actual title.
3. The blog post's sample response was captured in `supporting_text` along with Google AdSense code.
4. When the React runtime or adapter accesses `pkg.prompts`, it receives `[]`, correctly falling back to displaying *"No question available."*
5. Zero Speaking prompts exist in the canonical v2 dataset.

---

## 5. Cross-Module Totals & Quality Summary

| Metric | Total |
| :--- | :--- |
| Total Canonical Packages | 564 |
| Total Stored Question/Task Records | 14906 |
| **Total Usable Verified Content Records** | **2718** |
| **Total Quarantined Records** | **12367** |
| Overall Usability Yield | **18.2%** |

### Usable Content Inventory by Category:
- **Listening:** **2694** clean, verified questions with 100% verified audio coverage.
- **Writing:** **24** tasks (12 Task 1 Tables + 12 Task 2 Essays).
- **Reading:** **0** usable questions (all 11,000 quarantined due to instruction-overwrite defect).
- **Speaking:** **0** usable questions (all 179 quarantined due to empty prompts defect).

---

## 6. Duplicate Analysis

1. **Exact In-Section Question Duplicates (Listening):** 321 records.
   - Cause: Extractor generated multiple question records for the same input line (e.g., `(3) [BLANK] (4)` and `(3)   (4) [BLANK]`).
2. **Exact Cross-Test Question Duplicates (Listening):** 86 records.
   - Standard Cambridge test questions repeated across different uploaded editions.
3. **Repeated Instruction Templates:**
   - 830 Listening groups and 2,361 Reading groups legitimately share standard IELTS instructions (e.g. *"Write NO MORE THAN THREE WORDS"*). These are legitimate repeated templates, not duplicate questions.

---

## 7. Missing Asset Analysis

- **Listening Audio:**
  - Total Sections: 388
  - Sections with Audio: 388 (100%)
  - Audio Files physically present in `assets/`: **96 / 96** (100% coverage, 0 missing files).
- **Writing Images:**
  - Total required images: 0 (all 12 valid Task 1 prompts use semantic HTML `<table>` structures).
  - 1 package (`WRI-3add27d5`) quarantined as blog navigation garbage.

---

## 8. Proposed Clean Database Structure: `/content-v3/`

To eliminate all defects, prevent UI coupling to raw extraction files, and guarantee strictly verified exam delivery, we propose the following normalized schema:

```
/src/data/content-v3/
├── schema/
│   ├── question.schema.json
│   ├── section.schema.json
│   ├── passage.schema.json
│   ├── task.schema.json
│   └── test.schema.json
├── listening/
│   ├── tests/               # Atomic: TEST -> SECTION -> AUDIO -> GROUP -> QUESTIONS
│   │   ├── LIS-TEST-001.json
│   │   └── ...
│   └── questions/           # Flattened normalized verified questions
│       └── LIS-Q-0001.json
├── reading/
│   └── passages/            # Clean passages with extracted question references
├── writing/
│   ├── task1/               # Clean prompts + normalized table data (no AdSense/links)
│   └── task2/               # Clean essay prompts
├── speaking/
│   └── prompts/             # Re-extracted authentic Part 1, Part 2, Part 3 prompts
├── assets/                  # Audio and verified images
└── quarantine/              # Quarantined records with reasons and provenance
    ├── listening_quarantine.json
    ├── reading_quarantine.json
    ├── writing_quarantine.json
    └── speaking_quarantine.json
```

### Normalized Question Record Contract:
```json
{
  "id": "LIS-002e74c7-S1-G1-Q01",
  "module": "LISTENING",
  "testId": "LIS-002e74c7-test_0",
  "testType": "ACADEMIC",
  "sectionId": "LIS-002e74c7-S1",
  "sectionNumber": 1,
  "groupId": "LIS-002e74c7-S1-G1",
  "questionNumber": 1,
  "questionType": "NOTE_COMPLETION",
  "inputType": "INLINE_BLANK",
  "prompt": "Address: Apartment 2, (1) [BLANK] , Newton",
  "options": [],
  "sharedInstruction": "Complete the notes below. Write NO MORE THAN THREE WORDS.",
  "correctAnswer": "16 rose lane",
  "audioId": "f993368aa6c7",
  "audioPath": "assets/f993368aa6c7.mp3",
  "passageId": null,
  "sourceEvidence": {
    "sourceFile": "ielts-listening-test-170/index.html",
    "sourceHash": "12415e9285662954d8a6b600f627a8688180e28d9567fd8628785021667a5e37"
  },
  "status": "VERIFIED"
}
```
