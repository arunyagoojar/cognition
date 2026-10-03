# Quarantine recovery plan

Status: **deferred.** Nothing in quarantine is served, and nothing is being recovered now.
Every quarantined unit stays in `content-db/<module>/` with its parsed content, reason codes
and source provenance (page path, sha256, line range). Recovery is a later phase, once
Cognition has its own media storage and an owner review workflow. Do not salvage by
guessing: a unit is released only when the resource below makes it pass the same validator
and contract tests as everything already in production.

Counts are from the locked database. A unit can carry several reason codes, so the
per-reason counts overlap and do not sum to the total.

## Reading — `content-db/reading/` (`quality-audit.json` has one record per group)

Served: 109 complete 40-question tests (4,360 questions).
Held back: 195 `practice_only` tests. Their 6,196 individually validated questions are not
served, because the app only runs complete timed tests. 15 tests are fully quarantined, and
2,119 questions sit in quarantined groups.

| Reason | Questions | What unblocks it |
|---|---|---|
| ANSWER_NOT_IN_PASSAGE | 833 | Source-corpus review. The official key is not in the passage text: a key typo ("common crap" for *carp*), a plural or wording mismatch, or the wrong key line. An owner edits the key against the printed answer, with the change recorded. |
| MEDIA_NOT_IN_R2 | 363 | Upload the 88 images listed in `reading/media-pending.json` to our media storage (key `cognition/images/reading/<sha256>.<ext>`) and add them to `media_manifest.json`. Then re-run the pipeline. No code change needed. |
| TEST_QUARANTINED | 298 | Follows the test-level reasons below (10 passage-boundary, 4 missing key, 2 artifact). |
| ORPHAN_OPTIONS / MISSING_OPTION_POOL / INCOMPLETE_OPTIONS | 270 / 151 / 64 | Extractor work. Option pools printed as images or in unusual layouts need a pool parser for that layout, or manual entry with provenance. |
| ANSWER_INVALID_FOR_TYPE / ANSWER_TYPE_MISMATCH | 242 / 208 | Source review. The key contradicts the question type (e.g. True/False key on a Yes/No legend, letters outside the pool, an offset key). Needs a human decision per test. Never auto-mapped. |
| MISSING_QUESTION / EMPTY_QUESTION / AMBIGUOUS_STRUCTURE | 222 / 30 / 140 | Extractor work, or the question exists only inside an image. Questions inside images are recoverable after the media upload plus manual transcription. |
| MISSING_ANSWER | 214 | The source page has no key for these numbers. Needs an authoritative key source (e.g. the published book). |
| MALFORMED_BLANK / NUMBERING_MISMATCH / DUPLICATE_QUESTION | 73 / 17 / 13 | Source layout defects (two gaps under one number, dot leaders without a number). Manual restructuring with provenance. |
| ANSWER_EXCEEDS_WORD_LIMIT | 53 | Source review: the key breaks the stated word limit. |
| MISSING_INSTRUCTION / MEDIA_MISSING | 54 / 15 | Source review; the image file is absent from the corpus. |

Test-level reasons: PASSAGE_BOUNDARY_AMBIGUOUS (10), ANSWER_KEY_MISSING (4), EXTRACTION_ARTIFACT (2).

Practice-only serving: once a practice mode with per-type sessions and no full-test band
exists, the 195 practice-only tests' validated groups can be served without further data work.

## Listening — `content-db/listening/` (`index.json › reconciliation`)

Served: 87 complete, fully verified 40-question tests (3,480 questions). Reconciliation:
264 source pages = 87 production + 111 quarantined full-test pages + 52 MCQ drill pages
+ 10 duplicates + 4 irrelevant.

| Reason | Units (tests) | What unblocks it |
|---|---|---|
| INCOMPLETE_TEST | 109 tests | Follows from the question-level reasons below: a test ships only with all 40 verified. |
| QUESTION_NOT_EXTRACTED | 166 (52) | Extractor work for headings fused with content, or for questions inside images. |
| OPTIONS_MISSING / OPTION_TEXT_EMPTY | 133 (37) / 14 (13) | Option lists printed only on a figure or image. Recoverable with image transcription plus provenance. |
| LETTER_KEY_ON_TEXT_QUESTION | 95 (23) | A word-box group whose box was not found. Needs a pool parser for that layout. |
| PHANTOM_SPLIT_MERGED | 51 (36) | Group header layout defects. Extractor work. |
| KEY_LIST_AMBIGUOUS / KEY_OR_AMBIGUOUS | 24 / 2 | Source review: the key lists several words with no stated order or alternatives. |
| STEM_MISSING_IN_SOURCE / MULTI_PROMPT_MISSING | 24 / 21 | The source omits the question text. Needs an authoritative source. |
| MULTI_* (count, key, letters) / ANSWER_NOT_IN_OPTIONS / KEY_NOT_A_LETTER | 33 | Source review per group. |
| RENDER_CHECK_FAILED | 10 tests | Leftover dot leaders or a duplicated inline blank in the stimulus. Extractor fix, then re-gate. |
| NON_STANDARD_* / SOURCE_INCOMPLETE | 9 tests | Not standard 40-question tests (42 questions, 39 questions, odd sections). Keep out of full tests. |
| AUDIO_NOT_IN_R2 | 1 test (122) | Upload `122_we.mp3_` (a valid MP3 in the corpus) to `cognition/audio/listening/122_we.mp3`, add it to the manifest, re-run. |
| NOT_A_FULL_TEST | 52 drill pages | Not recoverable as full tests. Could become part-drills in a future practice mode. |

Duplicates (10): one copy of each Cambridge near-duplicate pair is kept. Conflicting key
items are recorded in each duplicate's `duplicateEvidence` for owner review.

## Writing — `content-db/writing/`

Served: 128 of 132 tests (Task 1 + Task 2 from the same page).

| Reason | Tests | What unblocks it |
|---|---|---|
| TASK1_VISUAL_INCOMPLETE | 44, 95, 126 | Upload the second Task 1 images (`im-44.png`, `test-95-min.png`, `w_125-2.webp`) to media storage and add them to the manifest. The Writing screen then needs to show more than one image per task. |
| MULTIPLE_PROMPTS_FUSED | 93 | The source page fuses two Task 2 questions. An owner picks the intended prompt, recorded with provenance. |

## Speaking — `content-db/speaking/`

Served: 179 packages. Nothing is quarantined. Part 2 topics come from the source practice
site. Part 1, cue-card prompts and Part 3 are written for Cognition in the IELTS format
(`content-db/speaking/authored/`) and labelled that way in the app.
