# Cognition — Phase 0 Cleanup Report

**Date:** 2026-10-02
**Scope:** Repository cleanup and structural reset only. No content generation, no UI changes, no scoring/exam-behavior changes.

## Git Safety

The pre-cleanup state (including every removed pipeline script and the content-v3
database) was committed as checkpoint `47cd0df` before any deletion, so every
removal in this phase is reversible from Git history. Untracked generated outputs
(`tmp/`) were not committed (regenerable from the raw source) and cannot be
restored from Git.

The raw downloaded IELTS source at `~/Downloads/ielts-website` and the media
library at `~/Downloads/IELTS Media` were **not touched**.

## 1–2. Files & Folders Removed

### Generated databases / competing content stores
| Removed | Why |
|---|---|
| `src/data/content-v3/` (≈3,800 files, 34 MB) | Competing v3 database (quarantine, schema, per-question JSON). Consumed **only** by removed scripts and one removed test — never imported by the app runtime. |
| `src/data/canonical/repository.js` | v1 repository shell: loads from `./packages/` which does not exist → always empty. Sole consumer was the vacuous randomization test. |
| `src/data/canonical/validator.js`, `reconstructor.js`, `sourceEvidence.js`, `types.ts` | v1 support code; after the above removals nothing imports them. `normalizer.js` **kept** (used by the active evaluation engine). |
| `src/data/catalog.json` | Old scaffold catalog pointing at the deleted `cambridge17_test1.json` and a stale GitHub-Releases audio URL. No importers. |

### Content pipeline / extraction tooling (scripts)
| Removed | Purpose |
|---|---|
| `scripts/content_pipeline/` (entire Python package: `extract.py`, `mass_extract.py`, `import_v2.py`, `reconstruct_v2.py`, `audit_v2.py`, `validate_v2.py`, `update_report.py`, `models.py`, `validators.py`, `parsers/`, `test_parser.py`, `test_repository_v2.js`, `__pycache__`) | The old OCR/HTML extraction + v2 reconstruction pipeline. The v2 data it produced is already in the repo and active. |
| `scripts/build_content_v3.js`, `scripts/reconcile_v3.js`, `scripts/reconcile_v3.cjs`, `scripts/validate_content_v3.js`, `scripts/audit_content_inventory.js` | v3 reconstruction, reconciliation, validation, forensic inventory. |
| `scripts/validate_content.js` | v2 validation CLI (wired to the removed `validate:content` npm script). |
| `scripts/verify_listening.js`, `scripts/verify_ui.js` | One-off Puppeteer dev-verification scripts. |
| `analyze_html.py`, `analyze_html2.py`, `analyze_html3.py`, `analyze_html4.py` (repo root) | One-off HTML analysis experiments. |
| `src/data/regression_test.py`, `src/data/writing_regression_test.py` | Python content-era regression tests (asserted Cambridge PDFs/audio in `~/Downloads`, referenced the deleted `writingPool.js`/`writingScorer.js`); unreferenced by any npm script. |

**Kept:** `scripts/generate_v2_bundle.js` — the 32-line packager that regenerates
`src/data/canonical/v2/browser_bundle.js` from the v2 JSON packages. This is the
single remaining content↔application boundary tool, now wired as
`npm run content:bundle`.

### Test/run artifacts and junk
| Removed | Why |
|---|---|
| `tmp/content-extraction-full/`, `tmp/content-extraction-full-v2/`, `tmp/content-extraction-proof/` (100 MB) | Extraction run outputs, forensic/semantic-parser audit reports. |
| `test/content_v3_validation.test.js` | Tests the removed v3 database. |
| `test/randomization.test.js` | Vacuous: exits immediately (“REPOSITORY EMPTY”) because the v1 repository it targets had no data behind it. |
| `dist/` (8.6 GB stale build) | Regenerable build output; contained a 3.6 GB real copy of the videos symlink target. |
| `scratch/` (`test_suite.js`, `test_complete_verification.mjs`) | Dev verification scratch (was gitignored). |
| `docs/content-architecture-audit.md` | Forensic audit of the pre-canonical architecture (removal ordered by Phase 0). |
| `__pycache__/`, `1500` (empty file) | Accidental artifacts. |
| `public/videos` (symlink → `~/Downloads/IELTS Media`) | Redundant second serving mechanism — `vite.config.js` already serves `/videos` via middleware. The symlink caused `vite build` to copy 3.6 GB into `dist/`. |

### Unused application code (verified zero importers)
- `src/components/VideoModal.jsx`
- `src/components/navigation/` (`ContextualNav.jsx`)
- `src/lib/` (`utils.js` — the shadcn `cn()` helper; nothing uses `clsx`/`tailwind-merge`)
- `src/utils/soundEffects.js`, `src/utils/speakingScorer.js`, `src/utils/writingScorer.js`
- `tsconfig.json` + `typescript` devDependency (no `.ts`/`.tsx` files remain)

### Unused assets
- `public/icons.svg`, `public/logo.svg`, `public/favicon.png`, `public/icon-192.png`
  (index.html references only `favicon.svg`, `favicon-32x32.png`, `favicon-16x16.png`,
  `favicon.ico`, `apple-touch-icon.png` — all kept)

## 3–4. package.json Changes

**Scripts removed:** `validate:content`, `validate:canonical:v2`, `test:randomization`
**Scripts added:** `content:bundle`, `test:generation`, `test:contract`
**`test` now runs:** `evaluation.test.js` + `deterministic_generation.test.js` + `content_contract.test.js` (all exercise active code)

**Dependencies removed:** `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` (zero imports), `puppeteer` (verification scripts deleted, incl. its `allowScripts` block), `typescript` (no TS sources)
**Kept:** `react`, `react-dom`, `motion` (9 files), Tailwind v4 toolchain, `oxlint`, `@types/react*` (editor support)

## 5. Files Retained Because They Are Referenced (traced, not guessed)

- `src/data/canonical/v2/` — the **active** content database: `browser_bundle.js` (17 MB) is imported by `v2/repository.js` ← `content/contentRepository.js` ← `data/content/*` ← `data/{listening,reading,speaking,writing}/index.js` + `data/exams/examAssembler.js` ← the five exam modules.
- `src/data/canonical/v2/assets/` (1.6 GB) — listening audio + passage images resolved at runtime via `contentAdapter.formatAudioPath()` → `/src/data/canonical/v2/assets/…` and `HtmlContentRenderer` image paths.
- `public/wp-content/` (5 GB) — active media store: `ListeningModule` rewrites `…/wp-content` audio paths to `/wp-content/...`; verified served by the dev server (HTTP 200).
- `src/data/canonical/normalizer.js` — imported by `utils/evaluation/evaluationEngine.js` (scoring path).

## 6. Suspicious but Intentionally Retained

- `.gitignore` legacy entries for non-existent dirs (`preparation_materials/`, `temp_gre_docs/`, `public/audio/*.mp3`) — harmless, left for future phases.
- `public/favicon.png`/`icon-192.png`-style PWA assets were removed only after confirming no manifest/reference exists.

## 7. Dependencies / Issues Needing Future Cleanup (documented, not fixed now)

1. **Heavy media outside version control** — `src/data/canonical/v2/assets/` and `public/wp-content/` are now gitignored (1.6 GB + 5 GB). They are active runtime assets on this machine; a fresh clone will run without audio/images until the future content pipeline provides them (e.g., via external hosting, as begun in commit `d5b2170`).
2. **`/src/data/...` asset paths are dev-only** — `contentAdapter.js` emits URLs that only Vite's dev server can resolve; production builds need the future content layer to address assets properly.
3. **17 MB `browser_bundle.js` chunk** — build emits a >500 kB chunk warning; the bundle should become a real data layer in the next phase.
4. **1 pre-existing lint error** — `src/components/common/HtmlContentRenderer.jsx:7` conditional `React.useMemo` (rules-of-hooks). Left untouched per cleanup-only mandate (67 warnings remain, down from 1,277).
5. **Serving two media stores** — v2/assets *and* wp-content both serve the app; consolidate when the new content pipeline lands.

## 8. Content Layer Reset Note

The content layer is **intentionally reset**. Broken questions, malformed JSON,
listening mappings, missing speaking prompts, etc. were **not** fixed or
regenerated. The authoritative raw source remains at `~/Downloads/ielts-website`
(untouched). Target architecture for the next phase:

```
RAW SOURCE (outside repo)
   → CONTENT PIPELINE (to be built)
   → VERIFIED CONTENT DATABASE (single, replaces v2 + wp-content mix)
   → APPLICATION DATA ACCESS LAYER (src/data/content/* + generate_v2_bundle)
   → IELTS APPLICATION (src/components, src/utils)
```

## 9. Final Project Structure

```
.
├── index.html                  # Entry HTML (Cognition)
├── vite.config.js              # Vite + React + Tailwind + /videos middleware
├── package.json                # dev / build / lint / preview / content:bundle / test
├── .oxlintrc.json              # Lint config
├── CLEANUP_REPORT.md
├── scripts/
│   └── generate_v2_bundle.js   # Content DB → browser bundle (only pipeline tool kept)
├── test/
│   ├── evaluation.test.js      # Scoring / evaluation engine (52 checks)
│   ├── deterministic_generation.test.js
│   └── content_contract.test.js
├── public/                     # Dev-served static assets + active wp-content media store
└── src/
    ├── App.jsx / main.jsx / index.css
    ├── components/
    │   ├── common/             # Icon, QuestionRenderer, HtmlContentRenderer
    │   ├── dashboard/          # TopNavigation, ScoreSummary, PerformanceOverview, …
    │   ├── modules/            # Listening / Reading / Writing / Speaking / MockExamFlow + exam chrome
    │   └── views/              # PerformancePage, LearningHubPage
    ├── data/
    │   ├── canonical/          # normalizer.js (shared answer normalization)
    │   ├── canonical/v2/       # ACTIVE content database (packages + assets + bundle)
    │   ├── content/            # Data-access layer: adapter, test builder, repository, randomizer
    │   ├── exams/              # examAssembler.js
    │   └── {listening,reading,speaking,writing}/  # Per-skill public API for modules
    └── utils/
        ├── ai/                 # aiConfig, aiProvider
        ├── audio/              # audioStore (IndexedDB recordings)
        ├── evaluation/         # evaluationEngine
        ├── bandCalculator.js, performanceStore.js, storage.js, testQueue.js, geminiEvaluator.js
```

## 10. Verification Results (post-cleanup)

| Check | Result |
|---|---|
| `npm test` (3 suites) | ✅ All passed (52 evaluation checks + deterministic generation + content contract), exit 0 |
| `npm run lint` | 67 warnings, 1 pre-existing error (unchanged from baseline) |
| `npm run build` | ✅ Built in 8.1 s (pre-existing chunk-size warning documented above) |
| Dev-server smoke test | ✅ `/` 200 (title "Cognition"), `/src/main.jsx` 200, `/wp-content/...` media 200 |
| Repo size on disk | ~7 GB (from ~15 GB: removed 8.6 GB stale dist, 100 MB tmp, 34 MB content-v3) |
