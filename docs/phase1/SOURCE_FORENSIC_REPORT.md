# SOURCE_FORENSIC_REPORT.md — Cognition Phase 1A

**Source:** `/Users/arunyagoojar/Downloads/ielts-website` (read-only; never modified)
**Snapshot identity:** practicepteonline.com — "IELTS MASTER", a WordPress site (theme `bosa`, TablePress index tables, `bg-showmore` answer toggles, `wp-audio-shortcode` embeds).
**Machine-readable companion:** [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json) (per-page SHA-256, template classification, hub + Cambridge-book enumerations).

## 1. Top-level inventory

| Item | Count | Notes |
|---|---|---|
| Total files | 1,915 | |
| HTML pages | 1,096 | 1,091 content directories + 5 loose root files (`index.html` = home; 4 × `*-test-111.html` are the **canonical** pages for test 111 — the hub links point at the loose files, the directories do not exist) |
| Audio (mp3) | 342 + 1 `.mp3_` | 291 in `uploads/audio/` (incl. 84 LiteSpeed cache copies `*-q7b50db1914.mp3`), 52 in `uploads/audio_mcq/` |
| Images | 412 | 360 png + 44 webp + 8 jpg under `uploads/{2019..2026}/` |
| Site framework files | 26 js, 14 css, fonts, svg | wp-includes / theme / plugins — excluded from content |

Every content page is `wp-content`-style permalink: `<slug>/index.html` with a single
`<div class="entry-content">` holding the exam content, followed by WordPress comments
(`id="comments"`) and footer. All 1,091 directories were classified into templates
(§3); zero pages ended up `unknown`.

## 2. What the site is

The site is a **practice-test archive**, not an official Cambridge mirror:

- **Listening / Reading / Writing "tests"** are single-page tests numbered 1..N per module
  (flat, site-local numbering). Most are authentic Cambridge material re-published as HTML
  (many match Cambridge books 9–21 content), some are site-composited practice sets.
- **Cambridge book identity exists partially**: 21 "Official IELTS Tests Book" hub pages
  map Book B Test T → the flat test slugs (e.g. *Listening Test 17.1 → `ielts-listening-test-189`*).
  Coverage is incomplete (books 1–18 have gaps; only books 20–21 map Writing; none map Speaking).
- **Speaking** exists only as ~180 Makkar-style cue-card pages: page title = topic, content =
  a numbered sample answer. There is no Part 1 / Part 3 material and no official speaking tests.
- **Computer-delivered IELTS hub** contains no tests (email-gated offer text). Several hubs
  (tutorials, vocabulary, sample essays, writing-evaluation) are informational → **exclusion zone**.

## 3. Template classification (detail in TEMPLATE_CATALOG.md)

| Template | Pages | Has answer key | Has audio | Has content images |
|---|---|---|---|---|
| `listening_test` | 197 (+10 duplicate-slug variants) | 197/197 | 196/197 | 0 |
| `academic_reading_test` | 317 (+1 dup `reading-test-105-2`) | 317/317 | 0 | 83 pages (72×1, 7×2, 4×3) |
| `general_reading_test` | 125 (+1 `ielts-general-reading-16`) | 124/125 | 0 | 21 pages |
| `academic_writing_test` | 131 | 0 (no answers exist) | 0 | 119 pages (Task-1 visuals) |
| `listening_mcq_test` | 52 | 52/52 | 52/52 | 0 |
| `speaking_cue_card` | 179 | n/a | 0 | 0 |
| hubs / books / essays / info | ~195 | mixed | 0 | decorative |

Duplicate-slug variants (e.g. `listening-15`, `ielts-listening-83`, `reading-test-105-2`)
are **renames of the same test numbers** referenced by the hub tables — the hub
enumeration is the canonical test→slug mapping, including these exceptions
(e.g. *Listening Test 6 → `ielts-listening-6`*).

## 4. How content is represented (verified on every template)

- **Semantic HTML**: `<p>`, `<table>`, `<ul>`, `<strong>/<b>`, `<figure><img>`. Content is
  server-rendered; **JavaScript creates no content** (only the show/hide toggle + ad iframes).
- **Answer keys are hidden DOM**: every L/R page carries exactly one
  `<div id="bg-showmore-hidden-*">` after the questions, containing the full key
  (`1. 300 2. sunshade …` inline for listening, one-per-line for reading).
  Keys are 100% sequentially numbered in listening (194/197 strictly 1..N) and reading (317/317).
- **Blanks** are inline: `(N)……………` text plus the site's interactive
  `<input name="fname" type="text"/>` placed directly after the blank marker —
  a reliable structural signal for blank positions.
- **Audio**: two embed dialects — plain `<audio src="...">` (114 pages) and WordPress
  shortcode `<audio class="wp-audio-shortcode"><source src="...">` (83 pages). Both are plain
  HTML; 1 audio file per test; no lazy-loading, no playlists, no per-section audio splits.
- **Images**: `uploads/YYYY/MM/…` with a strong naming convention (`test-<n>-min-k.png`,
  `<n>-test-aca.png`, `AC<n>.webp`, `G<n>.webp`). 220/220 name-prefixed refs match their
  page's test number — usable as a cross-validation signal.
- **Multiple tests per page**: never. One test page = one test (writing = Task 1 + Task 2
  on the same page; reading = 3 passages; listening = 4 parts).
- **Contamination zones** (must be excluded by the extractor):
  WordPress comments containing user-written "sample essays" (writing pages), "Recent posts"
  widget links, ad `<ins>`/`<iframe>` blocks, SEO/footer text, breadcrumbs.

## 5. Source anomalies found (all verified)

| # | Anomaly | Evidence | Handling proposal |
|---|---|---|---|
| 1 | `ielts-listening-test-122` has **no audio anywhere** | no mp3 ref in HTML; no file | quarantine test-level: extract questions, mark audio MISSING |
| 2 | `ielts-listening-test-61` embeds **test-100's audio** (`100_deep-…mp3`; `61_*.mp3` absent from disk) | audio-prefix cross-check | keep with `audio_mismatch` flag (source fidelity) — usable? decide in validation |
| 3 | 84 LiteSpeed cache copies of audio (`*-q7b50db1914.mp3`) exist on disk and are referenced by 80 pages via the shortcode dialect | asset scan | resolve to the non-cache canonical file (exists for all but test-100's page which references only the cache copy) |
| 4 | 4 loose root `.html` pages are the **only** copy of test-111 pages | hub hrefs point at them | treat as the canonical page for test 111 |
| 5 | 3 missing content images (`2019/02/40.3.png`, `40.4.png`, `46.1.png`) referenced by old reading pages | asset scan | quarantine affected question groups (asset missing) |
| 6 | 339 uploads files referenced by no scanned test page (thumbnails, hub logos, tutorial images, cache dupes) | asset scan | not part of the content DB; leave in source |
| 7 | Test-111 pages exist **only** as loose files; `reading-test-105-2` duplicates test-105 | dir + hub analysis | dedupe via hub enumeration |
| 8 | GT reading answers use short forms `T/F/NG`, academic uses `true/false/not given`/`yes/no` | answer-key comparison | answer normalizer must be module-aware |

## 6. What was verified about completeness (baseline numbers from the forensic scan)

Forensic regex scan (strict, so undercounts groups — the real extractor will be more
complete; numbers establish the *difficulty profile*):

- **Listening**: 166/197 pages yield clean sequential group ranges; 135/197 have
  answer-count == max question number (40); 8 pages end at 39 questions.
- **Academic reading**: all 317 answer keys sequential; clean group ranges detected on 207
  (markup variance on the rest); question counts vary (several tests end at 35–39).
- **GT reading**: 23/125 clean groups with the strict scan (GT uses section text, not
  "Questions N–M" per group) — needs the GT-specific strategy.
- **MCQ**: 52 single-group fragments with site-section numbering (e.g. Q11–14, Q21–27);
  they are **partial tests / drills**, not full 40-question tests.
- **Writing**: 12/131 pages have no Task-1 image (Task-2-only pages or missing visual).

## 7. Conclusions feeding the strategy

1. The source is **deterministically extractable**: server-rendered HTML, explicit answer
   keys in hidden DOM, single audio per page, stable question-group markers.
2. The hard problems are (a) **question-group segmentation** across markup variance,
   (b) **table/grid completion questions** (blanks spread across cells — this is exactly
   where V2 broke), (c) **passage boundary detection** in reading, (d) **contamination
   exclusion** (comments/ads/widgets), (e) **GT section structure**.
3. V2's provenance model (source file + SHA-256) is sound and all V2 audio copies are
   bit-identical to the source — but its extraction is materially defective (§Phase 1D).
4. Nothing requires OCR, browser rendering, or PDF extraction in the main path:
   **all 1,091 pages are static semantic HTML**. OCR/vision is only a fallback candidate
   for the 3 missing images and for *validating* Task-1 visuals, not for text extraction.
