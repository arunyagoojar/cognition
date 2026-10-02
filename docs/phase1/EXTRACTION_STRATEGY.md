# EXTRACTION_STRATEGY.md — Cognition Phase 1

## 1. Chosen approach: layered deterministic DOM extraction, no ML in the main path

**Primary method: a real DOM parser (BeautifulSoup/lxml or cheerio-equivalent) over the
single `div.entry-content` of each of the 1,091 static pages**, driven by per-template
strategies. The forensic evidence justifies this:

- Content is server-rendered semantic HTML; JS creates nothing (only show/hide toggles).
- Answer keys are explicit hidden DOM (`div#bg-showmore-hidden-*`) — 100% presence on
  L/R/MCQ pages.
- Blanks have two independent structural signals: `(N)…` text markers and
  `<input name="fname">` anchors.
- One audio per page with two well-defined embed dialects.
- Image naming (`test-<n>-min-k`, `<n>-test-aca`, `AC<n>`, `G<n>`) cross-validates
  page↔asset mapping (220/220 matches).

**Rejected methods and why:**

| Method | Verdict | Reason |
|---|---|---|
| Regex over raw HTML | rejected as primary | group/table structure is nested; regex caused V2's number-duplication bugs. Allowed only for micro-patterns (blank markers, key items) inside DOM-extracted text. |
| PyMuPDF / OCR | rejected for extraction | there are no PDFs in scope and no image-only questions (reading passages are real text). OCR allowed *only* as a validation fallback for the 3 missing images (§VALIDATION). |
| Browser rendering (Playwright) | rejected | adds nondeterminism for zero gain; nothing is JS-rendered. |
| LLM extraction as primary | rejected | deterministic structure already yields the facts; LLM paraphrase risks the "invented content" failure mode, and 1,091 pages × LLM cost buys nothing determinism can't. |
| LLM/vision as *assistant* | allowed, isolated (§5) | only for typed classification of Task-1 visuals and cross-checking ambiguous segmentation — never to author content. |
| Re-running V2/V3 pipeline | rejected | materially defective (see below). |

**What V2 got wrong (measured, all while marked `VERIFIED`):** reading packages have
100% `type: unknown` and 53% missing answers; 16% of listening groups have duplicated
question numbers (`[3,3,5,5,7,7,9]` for Q3–9 — table cells flattened as one "question"
per row); instructions leaked into question text (`question_text === group instruction`);
passage titles degraded to "Reading Passage 1"; speaking topics mis-assigned on ~121/179
records (cross-link contamination); writing tasks captured nav links as prompts. The
extraction below is designed specifically against these failure modes.

## 2. Pipeline architecture (deterministic stages)

```
RAW SOURCE (read-only)
  └─ S0  Source loader & manifest diff        (page set, hashes vs SOURCE_MANIFEST)
  └─ S1  Page classifier                      (template from slug + h1/title; verbatim from manifest)
  └─ S2  Decontamination                      (strip comments, ads, nav, widgets; keep entry-content)
  └─ S3  Answer-key parser                    (hidden div → numbered answers; module-aware normalizer)
  └─ S4  Per-template structural extractor    (T1–T6 strategies below)
  └─ S5  Asset resolver                       (audio/image refs → content-addressed assets; cache dedupe)
  └─ S6  Identity resolver                    (hub + Cambridge book mappings → sourceNumbers, cambridgeIdentity)
  └─ S7  Relational builder                   (groups↔questions↔answers↔assets linking)
  └─ S8  Validators (all layers)              (§VALIDATION_STRATEGY)
  └─ S9  Emitters                             (verified → content-db; else → quarantine)
  └─ S10 Reconciliation report                (§RECONCILIATION_PLAN)
```

Every stage is pure (in: parsed page + records; out: records), logs its decisions, and
is re-runnable → identical output (no timestamps inside content IDs; run IDs only in
the run manifest). Determinism guarantee: **IDs, content, relationships, classifications
and counts are functions of (source bytes, pipeline version)**.

## 3. Per-template handling (the core strategies)

### T1 Listening (`listening_test`)
1. Split content at normalized `Part\s*N\s*:` markers → 4 sections (accept `Part N` without colon; if a marker is missing, section boundary = first group whose min-question crosses 11/21/31 — validated later).
2. Inside a section, split at `Questions?\s+A\s*[-–]\s*B` / `Question N` markers → groups.
3. For each group: instruction = text between marker and stimulus; classify stimulus (`table|notes|summary|form|sentence|map|box-match`) by following element (`<table>`, bullet list, inline paragraph, image, letter box).
4. **Table/grid completion (the V2 killer):** walk the DOM table; blanks are `(N)…` tokens inside cells; each blank becomes one question whose `stem.segments` = that cell's text (with row/column context from the table headers). Never one question per row. The `<input name="fname">` anchors provide a second count to cross-check (blank-token count == input count for the group).
5. Matching groups ("Choose FIVE answers from the box…"): items list → `sharedOptions`; numbered items (14. Simon…) → questions.
6. MCQ groups: stem + lettered options from consecutive block elements.
7. Section audio: single `<audio>`/`<source>` → resolve; cache-variant preference rules (§5).

### T2 Academic reading (`academic_reading_test`)
1. Segment passages: real-title `<b>/<strong>` headings + "Reading Passage N" references + question-number discontinuities (Q13→Q14 boundary). A passage boundary must satisfy ≥2 of 3 signals, else the ambiguous region goes to quarantine.
2. Groups as in T1 (marker scan). Word-box groups: lettered list after instruction → `sharedOptions` (letters A–I/J with items).
3. TFNG/YNNG: statements as questions; instruction sentence sets the type; **module-aware answer normalization** (academic spells out yes/no; keep both value and normalized flag).
4. Diagram labeling: group's image + blanks; asset linked at group level.
5. Passage text: paragraphs preserved as ordered segments; paragraph letter labels (A–F) captured when present (needed by matching-questions rendering).

### T3 GT reading (`general_reading_test`)
1. Sections delimited by "You are advised to spend 20 minutes on Questions A–B" markers.
2. Lettered sub-texts (`A`, `B`, `C` anchors) → passage segments with labels.
3. Same group machinery; answer keys use `T/F/NG` short forms → normalizer maps to canonical TFNG.

### T4 Writing (`academic_writing_test`)
1. Content cut at `id="comments"` (hard boundary — user essays must never leak).
2. Tasks split at `<strong>Task 1:</strong>` / `Task 2:` markers.
3. Prompt = task text up to "Write at least"; wordLimit parsed from the boilerplate.
4. Task 1 visual: the page's content image(s); `visualKind` determined deterministically from prompt keywords (map/graph/chart/process/diagram/table), with LLM-vision assist only as a flagged secondary opinion (§5).
5. 12 pages without images → task1 with `visual: null` + `visual_expected: true` → completeness check decides verify/quarantine.

### T5 MCQ drills (`listening_mcq_test`)
Extracted like T1 MCQ groups but emitted as `kind: "mcq_drill"` with the site's section
numbering preserved (`questionNumbers: [11,14]`); never renumbered into 1–40 space.

### T6 Speaking (`speaking_cue_card`)
1. Topic from h1 (strip site suffix "– IELTS MASTER"); slug cross-check (slug words ⊆ topic words, else quarantine `TOPIC_SLUG_MISMATCH`).
2. Body = numbered sample answer → stored as `sampleAnswer` with `usage: reference_material_not_question`.
3. Makkar hub provides the canonical numbering (1–180) → `sourceNumber`; reconcile the 179-vs-180 delta.

## 4. Question segmentation & answer mapping (cross-cutting rules)

- **Segmentation invariant:** for every group, `len(questions) == end_q − start_q + 1`
  after deduplication of multi-blank constructs; violation → quarantine `NUMBERING_AMBIGUOUS`.
- **Blank↔answer mapping is positional**, in two independent ways that must agree:
  (a) blank marker numbers `(N)`; (b) group's question-number range order.
  Disagreement → quarantine `ANSWER_MAP_UNPROVEN`. No silent off-by-one repair.
- **Answer parser:** strict `N. value` itemization; multi-line (reading) and inline
  (listening) dialects; validate the key is sequential 1..max; trailing empty values
  (source bug in test-170: "40.") → answer missing → question quarantined, not repaired.
- **Alternatives** (`slow (turning)`, `calcium deposits/ furring up`): parsed into
  `variants[]` with parenthetical-optionality rules; never merged into one string.

## 5. Where AI/vision is (and is not) used

| Use | Allowed? | Controls |
|---|---|---|
| Extract question text/answers | **No** | deterministic DOM only |
| Classify Task-1 visual kind (map/chart/process…) | Yes, secondary | deterministic keyword classifier runs first; model output recorded as `visualKindConfidence: "model_opinion"`, never overwrites a deterministic match; image bytes never altered |
| Ambiguous group-boundary arbitration | Yes, advisory only | model output becomes a *suggestion*; record stays quarantined unless a deterministic rule can confirm it afterwards |
| Everything else | No | — |

No generative step can mint question content: emitters accept content only from
records that carry a `provenance.rawExcerpt` matching the source (post-normalization
equality check).

## 6. Completeness measurement

Per module, against SOURCE_MANIFEST enumerations:
- tests discovered (hub links) vs extracted vs quarantined;
- questions: Σ group ranges vs answer-key item count vs `<input>` blank-anchor count
  (three independent counts must reconcile);
- assets: referenced vs resolved vs missing;
- writing: pages with expected-but-missing visuals; speaking: hub cards vs pages.

## 7. Reproducibility guarantees

- Content IDs = f(source path, source SHA-256, pipeline version) — no timestamps/randomness.
- Byte-identical re-run ⇒ byte-identical DB (diff-checked in CI-style self-test with a
  sample of pages from every template).
- Pipeline version stamped in every provenance block; `extractionMethod` names the exact
  strategy version (e.g. `dom_v1.listening.tables`).
- Model-assisted outputs (if any) are stored as separate advisory fields, never mixed
  into deterministic content, so their presence never changes re-run determinism of the
  verified layer.
