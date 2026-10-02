# PHASE 3 REPORT — Production Listening + Speaking Database & App Integration

**Status:** COMPLETE — full corpus extracted, validated, integrated, and running.
**Determinism:** every artifact is a pure function of (raw source bytes, `pipeline/*.py`); re-running the pipeline reproduces the database.
**Immutability:** raw source (`~/Downloads/ielts-website`) untouched; canonical/v2 untouched; raw extraction evidence preserved in every record.

---

## 1. Exact production numbers

### Listening
| Metric | Value |
|---|---|
| Source pages discovered | **211** (207 listening directories + 4 loose root files) |
| Tests extracted | **208** records |
| Tests emitted (verified + flagged) | **207** |
| Test-level quarantines | **0** |
| Duplicates classified | **1** (`ielts-listening-test-105-2` → duplicate of test-105's family) |
| Irrelevant (non-listening loose files) | **3** |
| Question groups | **1,774** (1,681 verified, 80 phantom splits merged, 13 quarantined) |
| Questions (DB) | **8,023** — **7,986 verified (99.5%)** |
| Questions emitted to runtime | **7,946** (all with mapped answers) |
| Mapped answers checked against independent raw re-parse | **7,983 — 0 mismatches, 0 absent** |
| Audio resolved | **208/208** |
| Audio anomalies flagged | **90** (85 LiteSpeed cache canonicalized, 3 generic book-era names, 1 foreign-audio [test-61], 1 `.mp3_` extension [test-122]) |
| Images referenced / missing | **136 / 0** |
| Quarantined units (smallest-unit principle) | **101** (13 groups without instructions — source pages genuinely lack them; 7 questions with missing option boxes; 1 answer-not-in-options; 80 phantom splits recorded, not lost) |

### Speaking
| Metric | Value |
|---|---|
| Pages discovered = genuine packages | **179 / 179** |
| Part 1 count | **0 — `part1.available = false`** (no source material exists corpus-wide) |
| Part 2 count | **179** (cue cards with topic + numbered sample answer) |
| Part 3 count | **0 — `part3.available = false`** |
| Packages with sample answers | **179** (stored separately, `usage: reference_material_not_question`) |
| Bullet prompts | **0 — deliberately empty**: 0 of 179 pages contain "You should say"-style prompts; never invented |
| Status | **178 verified, 1 flagged** |
| Emitted to runtime | **179** |

### Accounting (exact, no unexplained remainder)
```
LISTENING: discovered 211 = verified 207 + quarantined 0 + duplicates 1 + irrelevant 3 ✓
SPEAKING:  discovered 179 = verified 179 + quarantined 0 + duplicates 0 + irrelevant 0 ✓
```

## 2. The eight pre-scale changes (all implemented)
1. **Per-unit quarantine** — a single bad question/group no longer discards a test; 101 units quarantined inside otherwise-emitted tests with full evidence.
2. **Independent cross-validation** — a second answer-key parser (different algorithm) + segmentation evidence counting (marker range ∨ independent key ∨ blank tokens, ≥2 required); every mapped answer was additionally re-derived from raw HTML after emission: 0 mismatches.
3. **Frozen JSON Schema** — draft-2020-12 schemas in `content-db/schema/`, enforced as a hard emission gate (a schema failure quarantines the record).
4. **Instruction cleanup** — stimulus-title residue removed from normalized instructions, original text preserved per record.
5. **Audio duration validation** — `afinfo` probe on all 208 files; implausible durations flagged (`AUDIO_DURATION_*`), nothing discarded.
6. **Corpus-wide fingerprints** — content-addressed duplicate detection (the test-105-2 twin); provenance retained on both sides.
7. **Deterministic asset manifest** — `content-db/assets.json`: 343 referenced assets, sha256-hashed, in-place resolution via `/wp-content` (dev public dir), 0 missing.
8. **Advisory Cambridge identity** — attached only where book hub pages prove it (e.g. test-189 → Cambridge 17 Test 1); never guessed.

## 3. Files created / changed

**Database (`content-db/`)** — 453 files, 9.6 MB:
- `listening/tests/<slug>.json` ×208, `listening/quarantine/*.json`, `listening/index.json`
- `speaking/tests/<slug>.json` ×179, `speaking/quarantine/`, `speaking/index.json`
- `schema/listening-test.schema.json`, `schema/speaking-package.schema.json`
- `assets.json` (343 assets), `index.json` (exact accounting), `reports/reconciliation.json`

**Pipeline (`pipeline/`)**: `extract_listening.py` (pilot core, hardened), `extract_production.py` (full corpus + cross-validation + schema gate), `extract_speaking.py`, `build_runtime.py`, `build_reports.py`, `render_records.py`, `PILOT_REPORT.md` (Phase 2).

**Application (runtime source switch — UI preserved):**
- `src/data/production/productionContent.js` (generated, 8.3 MB) + `adapters.js`
- `src/data/listening/index.js`, `src/data/speaking/index.js` → production DB
- `src/data/exams/examAssembler.js` → production Listening/Speaking (Reading/Writing remain V2 until their phase)
- `src/components/common/HtmlContentRenderer.jsx` → `data-qid` wiring so stimulus inputs share the grading answer keys
- `src/components/modules/ListeningModule.jsx` → **redesigned exam view per feedback: one full-width flowing form** (stimulus + inline blanks + question blocks in sequence; right-hand question panel removed)
- `src/components/modules/SpeakingModule.jsx` → intro meta reflects real coverage ("Part 2 Cue Cards — Part 1/3 unavailable")
- `test/production_content.test.js` + `npm test` wiring

## 4. Application behaviour (verified end-to-end in the running app)
- Listening: select → 4 sections → section audio (served from `/wp-content/...`) → full-width form with inline blanks wired to grading → submit → deterministic band from the verified answer key → canonical performance store. Verified live: 0/37 scored with real answer keys (Keiko, JO6337, …).
- Speaking: production cue card + recording + transcription + response-level AI evaluation; **no overall band** unless all three parts are attempted (engine returns `status: partial`, `overallSpeakingBand: null`).
- No placeholder questions, no invented content, no fake bands anywhere.
- `npm test`: all 4 suites pass (52 evaluation + generation + V2 contract + 207-test production contract).
- `npm run build`: passes. `npm run lint`: 68 warnings + the 1 pre-existing error (unchanged from Phase 0).

## 5. Known limits (documented, not hidden)
- 13 listening groups ship quarantined because their source pages genuinely lack instructions; 7 questions lack option boxes in the source; 1 answer does not appear in its options. All have recovery paths in `content-db/listening/quarantine/`.
- test-61 plays test-100's audio because the source page says so — flagged, not corrected.
- Reading/Writing still run on the V2 content source (explicitly out of Phase 3 scope).
- `flagged` tests (125) are emitted with warnings recorded in `validationWarnings` — warnings never alter content.
