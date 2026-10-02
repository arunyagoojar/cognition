# VALIDATION_STRATEGY.md — Cognition Phase 1

Layered validation, every record must pass **all** applicable layers to be emitted as
`verified`. Failures route to quarantine with a reason code — never silently dropped,
never silently repaired. (V2's lesson: a `validation_state: VERIFIED` field with no
enforced invariants is worse than none — 275 reading packages shipped 53% unanswered
while all said VERIFIED.)

## V1 — Structural validation (schema)
- Every record conforms to the content model: required fields, enums closed
  (question types, reason codes, roles), ID grammar `module.source.hash.unit`.
- JSON-schema-style checks at emit time; schema version stamped in every file.

## V2 — Semantic validation (is it the IELTS thing it claims to be?)
- Instruction→type consistency: "Choose the correct letter" ⇒ `mcq_single` with options;
  "Complete the …" ⇒ completion with ≥1 blank; "Which paragraph" ⇒ matching_information
  with paragraph options; TFNG/YNNG ⇒ 3-way choice. Mismatch ⇒ quarantine `SEMANTIC_MISMATCH`.
- Option-letter continuity (A,B,C… no gaps) for MCQ/word boxes.
- Word-limit constraints parsed from instruction present on completion/short-answer questions.
- Answer shape matches type: letters for MCQ/matching; `true/false/not given` or
  `yes/no` for TFNG/YNNG; text ≤ word-limit for completion.

## V3 — Relational validation (does everything belong together?)
- Group internal: `len(questions) == end_q − start_q + 1`; question numbers unique,
  ascending, within group range. (Kills V2's `[3,3,5,5,7,7,9]` class of bug.)
- Test internal: group ranges tile the question space without overlaps; listening Q1–40
  / reading Q1–40 / GT Q1–40 expected; MCQ drills exempt (site numbering kept).
- Section/passage membership: every question's group belongs to exactly one
  section/passage; no group without parent.
- Answer↔question: exactly one answer per question number within the test; answer
  itemization order matches the group layout (positional cross-check, §EXTRACTION 4).
- Audio: exactly one full-test audio for listening tests (0 ⇒ `AUDIO_MISSING`,
  >1 ⇒ `AUDIO_AMBIGUOUS`).
- Cambridge identity: `cambridgeIdentity` only from book-page mappings; a claim must
  match the page's own title/test number, else advisory flag, not verified identity.

## V4 — Source validation (traceability)
- Every record carries `provenance.page.sha256` equal to the current file's SHA-256
  (manifest cross-check) — extraction refuses to run against a mutated source.
- Every question stores a `rawExcerpt` whose normalized text must appear in the page's
  entry-content text (post-normalization containment check). No excerpt ⇒ no record.
- Transformations applied to each field are enumerated (`whitespace`, `unicode_nfc`,
  `blank_normalization`) so any field can be diffed against raw evidence.

## V5 — Completeness validation (are we losing valid content?)
Three independent per-test question counts must reconcile:
1. Σ group ranges (`end−start+1`),
2. blank-anchor count (`(N)` tokens + `<input name="fname">` occurrences),
3. answer-key item count.
Any pair disagreeing ⇒ affected groups quarantined with the evidence (counts included).
Test-level: expected max question number (40 full tests) and missing key items
(e.g. test-170's empty `40.` answer) flagged.

## V6 — Duplicate validation
- Content fingerprints (normalized text of stimulus + stems) across tests detect
  duplicate republication (e.g. `reading-test-105-2` vs test-105; shared audio pages).
- Duplicates are not dropped: the canonical record (hub enumeration membership)
  is emitted; the twin is emitted as duplicate-classified with a `sameContentAs` link.
- Asset-level dedupe by SHA-256 (cache variants resolve to one asset).

## V7 — Asset validation
- Every referenced asset exists, resolves to one content-addressed copy, and its
  naming convention cross-checks (`test-<n>-…` vs page test number; audio prefix vs
  test number — 192/196 pass; failures like test-61 → `ASSET_PAGE_MISMATCH` flag).
- Images decode (PIL), audio has an audio/mpeg header and plausible duration (>1 min
  for full-test audio; shorter ⇒ flag `AUDIO_TOO_SHORT` for human review).
- Missing files (known: `2019/02/40.3.png`, `40.4.png`, `46.1.png`) ⇒ owning groups
  quarantined, never emitted with dangling references.

## V8 — Render validation (can the app actually use it?)
- Contract tests against the application's data-access layer: every question type maps
  to a renderer; `stem.segments` reproduce the original line with blanks;
  instruction + stimulus + options render without HTML-in-content surprises.
- Sample render harness: one record per type × template is rendered to HTML snapshots
  and diffed (the Phase-0 `content_contract.test.js` is the seed of this suite).
- The 17 MB bundle problem (Phase 0 finding) is explicitly a non-goal of extraction:
  the DB is storage-neutral; bundling strategy is an application-phase decision.

## Enforcement & reporting
- Each validator returns `pass | warn | fail` with structured evidence; `warn` items are
  emitted with flags (e.g. `ASSET_PAGE_MISMATCH`), `fail` items are quarantined.
- Validation matrix (per module: counts passing/failing/warning per layer) is part of the
  reconciliation report — numbers must reconcile mathematically (§RECONCILIATION_PLAN).
- A validation self-test re-runs the whole pipeline on a pinned sample and asserts
  identical output (reproducibility check).
