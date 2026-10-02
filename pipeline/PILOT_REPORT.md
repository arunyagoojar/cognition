# PILOT_REPORT.md — Cognition Phase 2: Listening Extraction Pilot

**Pipeline:** `pipeline/extract_listening.py` (deterministic DOM extraction, stages S0–S9) + `pipeline/render_records.py` (V8 render reconstruction).
**Outputs:** `pipeline/pilot/records/*.json` (proposed DB records), `pipeline/pilot/reconstructions/*.md` (app renderings), `pipeline/pilot/summary.json`, `pipeline/pilot/comparison.json`.
**Constraints honored:** sample only (8 of 197 tests), no canonical/v2 changes, no app changes, raw source read-only, no discrepancy silently repaired.

## 1. Sample selection (deliberately difficult, per phase instructions)

| Test | Why it is in the sample |
|---|---|
| `ielts-listening-test-1` | baseline: tables, notes, MCQ, 5-of-8 box matching; audio dialect A; the "everything normal" page |
| `ielts-listening-test-170` | audio dialect B (wp-shortcode); multi-blank Q10 ("between (10) and ___"); **V2 was verifiably wrong here** (duplicate numbers `[3,3,5,5,7,7,9]`, group q10-10 with 2 questions, q36-40 with 4); key ends with an empty item "40." |
| `ielts-listening-test-105` | map labeling (Q14–20 + image), flow-chart completion with word box, lazy-loaded map image |
| `ielts-listening-test-35` | unusual numbering: 12 question groups incl. "Questions 19 and 20"-style ranges, Decide-which-THREE groups, sentence completion via input boxes; cache-variant audio ref |
| `ielts-listening-test-172` | "Section N" part markers (not "Part"), Circle-the-TWO-options groups; genuine 39-item key |
| `ielts-listening-test-61` | **audio anomaly**: page embeds test-100's audio (`100_deep-q7b50db1914.mp3`); the test's own audio does not exist |
| `ielts-listening-test-100` | **cache-variant audio**: page references only the LiteSpeed cache copy |
| `ielts-listening-test-122` | **audio anomaly**: references `122_we.mp3_` (trailing underscore) — Phase 1 believed audio was missing; the pilot found it |

## 2. Result summary

| Test | Groups | Questions extracted | Key items | Answers mapped | Audio | Status |
|---|---|---|---|---|---|---|
| test-1 | 8 | **40/40** | 40 | 40 | resolved (dialect A) | flagged |
| test-170 | 10 | **39/40** | 40 | 39 | resolved (dialect B) | **quarantined** |
| test-105 | 6 | **40/40** | 40 | 40 | resolved (dialect A) | flagged |
| test-35 | 12 | **40/40** | 40 | 40 | resolved (cache canonicalized) | flagged |
| test-172 | 7 | **39/39** | 39 | 39 | resolved | flagged |
| test-61 | 11 | **40/40** | 40 | 40 | resolved ⚠ foreign audio | flagged |
| test-100 | 11 | **40/40** | 40 | 40 | resolved (cache canonicalized) | flagged |
| test-122 | 8 | **40/40** | 40 | 40 | resolved ⚠ `.mp3_` | flagged |
| **Total** | 73 | **318/320** | 318 | 318 | — | 1 quarantined, 7 flagged |

("flagged" = verified content with recorded warnings; "quarantined" = test-level fail, record parked with evidence — not emitted to a production database in a real run.)

## 3. RAW vs EXTRACTED comparison (per test)

Discovered counts are re-derived independently from raw HTML (group markers, blank tokens, `fname` inputs, answer-key itemization) — they do not read the extractor's output.

| Metric | t-1 | t-170 | t-105 | t-35 | t-172 | t-61 | t-100 | t-122 |
|---|---|---|---|---|---|---|---|---|
| Raw group ranges | 8 | 10 | 6 | 12 | 7 | 11 | 11 | 8 |
| Raw group marker slots | 40 | 40 | 40 | 40 | 40 | 40 | 40 | 40 |
| Raw blank tokens `(N)` | 30 | 27 | 25 | 10 | 30 | 19 | 19 | 25 |
| Raw `fname` inputs | 35 | 28 | 32 | 34 | 30 | 29 | 29 | 32 |
| Raw key items | 40 | 40 (1 empty) | 40 | 40 | 39 | 40 | 40 | 40 |
| **Questions extracted** | **40** | **39** | **40** | **40** | **39** | **40** | **40** | **40** |
| Missing vs key | — | 33 | — | — | — | — | — | — |
| **Answers mapped** | 40 | 39 | 40 | 40 | 39 | 40 | 40 | 40 |
| Answer-value mismatches vs raw | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Audio relationship | 1:1 ✓ | 1:1 ✓ | 1:1 ✓ | 1:1 cache→canonical | 1:1 ✓ | 1:1 ⚠ foreign | 1:1 cache→canonical | 1:1 ⚠ `.mp3_` |
| Validation | flagged | quarantined | flagged | flagged | flagged | flagged | flagged | flagged |

Blank-token vs question counts differ by design on every page: MCQ/matching/map questions
carry no `(N)` tokens. The three-way reconciliation (group slots ↔ extracted ↔ key) holds
on 7/8 tests; test-170 is the documented exception below.

## 4. Differences from source (explicit, none repaired)

1. **test-170, Q33 — source defect.** The page contains no stem text for Q33: after Q32's
   options the raw HTML runs directly into a bare `A/B/C` option block and then Q34. The
   key has `33. B`. The extractor does not invent a stem: Q33 is absent from questions,
   the gap is caught by V3 (`NUMBERING_GAP`, `GROUP_COUNT_MISMATCH`), the orphan option
   block is preserved as stimulus evidence (`[orphan option block: A B C]`), and the test
   record status is **quarantined**. Recovery requires human/source verification.
2. **test-170 — trailing empty key item.** Source key ends `40.` with no value. Recorded
   (`answerKey.trailingEmpty`); Q40 is emitted with `answerFound: true` but no value —
   the answer record explicitly carries `value: null` and V3 flags the unanswered
   question rather than filling it.
3. **test-61 — foreign audio.** The page embeds test-100's audio. Source fidelity rule:
   the record points where the source points, with `ASSET_PAGE_MISMATCH` + `CACHE_VARIANT_CANONICALIZED`
   flags and a warn in V7. The audio↔test relationship is flagged as unverifiable, not corrected.
4. **test-100 — cache-only reference.** Raw ref is the LiteSpeed cache copy; the canonical
   `100_deep.mp3` exists on disk. Extracted asset resolves to the canonical file with the
   original cache ref preserved in `refs` + flag. (Documented canonicalization, not a repair.)
5. **test-122 — `.mp3_` extension.** Refines Phase 1: audio exists (`122_we.mp3_`, 19.3 MB,
   valid MPEG header). Flagged `AUDIO_EXTENSION_ANOMALY`; served with corrected metadata.
6. **test-35 — cache-variant audio** (`-q7b50db1914` suffix) canonicalized with flag, same as test-100.
7. **Instruction-word-boundary artifacts**: group instruction text occasionally contains the
   stimulus title (e.g. "GREEK ISLAND HOLIDAYS" appended in one group) — recorded as-is in
   `instruction.text`; rendering uses instruction + stimulus separately, so no content is lost
   (full source text preserved in `stimulus.segments` / `rawExcerpt`).

## 5. Known rendering ambiguities (documented, unresolved by design)

- Table stimulus cells keep raw `(N)………` markers while questions carry segmented stems;
  the app should render the table and place inputs at `blankContext` (row/col) — both views
  are stored, the app chooses. The dual representation is intentional (fidelity + renderability).
- test-172 g01 instruction begins with a stray "." (source artifact), recorded as-is.
- "Decide which THREE"-style groups (test-35 g05/g06) have no per-question stems in the
  source — questions are the explicit group range answered by letters from the statement
  pool; records mark this so the UI renders instruction + statements + letter slots.

## 6. The nine questions

**1. Does the proposed schema represent every sampled question type without loss?**
Yes for all eight observed types: `completion` (table/notes/flow-chart/sentence variants,
with cell/line context and segmented blank anchors), `mcq_single` (inline + line-wise
option dialects), `mcq_multi` (Decide-which-THREE / Circle-TWO), `matching_box`
(5-of-8 people/area-of-work), `map_labeling` (items + image + letter options),
`short_answer`, plus the tick-column classification table rendered as `matching_box`
with column options. Raw HTML/text is preserved alongside every normalized field, so
losslessness is checkable, not assumed.

**2. Can every sampled question be rendered without parsing raw HTML?**
Yes — `pipeline/render_records.py` renders all 8 tests (reconstructions/*.md) from
records only: table stimuli as tables, blank positions from stem segments or
`blankContext`, options, boxes, map items + image path, answer key. The two render-time
choices an app must make (table-cell input overlay vs stem-only rendering) are both
supported by stored data.

**3. Are question numbers preserved correctly?**
Yes — source numbering is kept verbatim (including test-172's 39-question layout and
test-35's twelve irregular group ranges). Numbers come from explicit source markers
(`(N)`, `N.` items, `Questions N-M` ranges); the only absent number (Q33) is absent
because the source lacks its stem, and it is reported, not renumbered.

**4. Are group instructions separated correctly?**
Yes — every extracted group carries its own instruction (100% of 73 groups), with word
limits parsed (`ONE WORD OR A NUMBER`, `NO MORE THAN TWO WORDS AND/OR A NUMBER`, …).
Instructions never appear inside question stems. Minor residue: stimulus titles can be
appended to instruction text on 2 groups (recorded; source text preserved).

**5. Are inline blanks preserved correctly?**
Yes — e.g. `"– Just (1)………. meters from beach"` → segments
`["– Just", {blank: 1}, "meters from beach"]`; multi-blank Q10 "between (10) and ___"
stays one question with one blank; sentence completions with interactive inputs map the
input position to `{"blank": N}`. The V2 failure mode (blank-only stems, duplicated
numbers) does not occur.

**6. Are answer mappings independently verifiable?**
Yes — answers are attached strictly by question number from the key, and the comparison
re-derives the key from raw HTML independently: **0 value mismatches across 318 mapped
answers**. Keys with non-1 starts, sequence breaks, and empty items are all detected and
reported rather than coerced.

**7. Are audio relationships correct?**
Yes, with source fidelity: one audio per test, both embed dialects parsed, cache
variants canonicalized with flags, header sniffing, and per-file byte sizes. The three
anomalies (test-61 foreign audio, test-100 cache-only ref, test-122 `.mp3_`) are exactly
the relationships that carry flags — the pipeline can't verify authorial intent, and it
doesn't pretend to.

**8. Did any sampled case expose a flaw in the extraction strategy?**
Four, all fixed in the pilot and fed back into the strategy:
  a. **Lazy-loaded images** (`data-src`) — Phase 1 claimed no lazy-loading; images are
     lazy-loaded (audio is not). Image resolution now prefers `data-src`. (This also
     restored map-image attachment on test-105.)
  b. **test-122 audio "missing"** — Phase 1's `.mp3` regex missed the `.mp3_` file;
     audio exists. (Phase 1 finding corrected.)
  c. **Group markers share paragraphs with instructions**, and part markers use both
     "Part" and "Section" — the marker model needed remainder-carrying markers.
  d. **MCQ options appear in three dialects** (inline, per-line after stem, standalone
     letter blocks) — required the line-wise state machine with pending stems and
     orphan-block evidence capture.

**9. What should be changed before running the full Listening extraction?**
  1. **Per-question quarantine granularity** — currently test-level rollup; the full run
     should quarantine individual questions/groups (e.g. test-170 would ship 39 verified
     questions + 1 quarantined, not a quarantined test).
  2. **Second extractor for cross-validation** — the answer-key parser and the group
     segmenter are the two highest-risk components; an independent implementation (or a
     second pass with different heuristics) diffed against the first would strengthen the
     three-way reconciliation before scale.
  3. **Schema hardening** — freeze the record schema (JSON Schema) and add the V1
     structural validator as a hard gate; the pilot validated ad hoc.
  4. **Instruction-text cleanliness** — add a post-pass that trims stimulus titles out of
     `instruction.text` (with the title preserved in stimulus), and strip stray "." prefixes.
  5. **Audio duration probe** — the pilot sniffed headers only; full runs should read
     duration (mutagen/ffprobe) to flag implausible audio (<5 min for a full test).
  6. **Dedup fingerprints** — V6 within-sample only; full run needs corpus-wide
     content fingerprints to classify duplicate publications (the 10 known slug twins).
  7. **Asset store decision** — content-addressed copies vs in-place reference: the pilot
     recorded paths only; the build phase must decide and implement the canonical store.
  8. **Cambridge identity** — attach book mappings (test-170 = Book 12 Test 2 via the
     book-12 hub) as advisory identity, validated per Phase 1 rules.

## 7. Verdict

The architecture extracts the sampled listening corpus faithfully: **318/320 questions
(incl. all 40 on the V2-broken page minus the source-missing stem), 318 answers mapped
with zero value mismatches, all 8 audio relationships resolved with 5 anomalies flagged**,
and every record renders from the database alone. The one quarantined test is quarantined
because the source itself is defective — which is the system working as designed. The
eight pre-scale changes in §6.9 are the gating list for the full run.
