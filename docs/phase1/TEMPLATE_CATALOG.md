# TEMPLATE_CATALOG.md — Cognition Phase 1A

Classification of every page template in `/Users/arunyagoojar/Downloads/ielts-website`,
based on inspection of representative pages of **every** distinct template (not extrapolated
from one example). Full per-page classification lives in [SOURCE_MANIFEST.json](SOURCE_MANIFEST.json)
(`page_inventory[].template`).

---

## T1 — `listening_test` (197 pages, + 10 duplicate-slug variants)

**Examples inspected:** `ielts-listening-test-1`, `-170`, `-100` (shortcode dialect), `-122` (no audio), `listening-15`, `ielts-listening-6`.

Structure inside `entry-content`:

```
"Part 1: Questions 1-5"            ← part marker (text, sometimes inside <p>/<strong>)
"Complete the table below. Write ONE WORD OR A NUMBER."   ← group instruction
<table>… blanks as (N)…………… …</table>                     ← shared stimulus
"Questions 6-10"                    ← next group … 4 parts, Q1–40
<audio …> or <audio><source …>      ← exactly ONE audio for the whole test
<div id="bg-showmore-hidden-*">1. 300 2. sunshade …</div>  ← answer key (inline)
```

- Groups per test: 9–15. Question types observed: table/note/summary/sentence completion,
  MCQ (A–C/D), multi-select matching ("Choose FIVE answers from the box… A–H"),
  map/plan labeling (referenced via images in some tests).
- Interactive `<input name="fname">` sits directly after each blank → blank anchor.
- Answer key format: **inline** `1. answer 2. answer …` in one `<p>`.
- Audio dialects: `A` = `<audio src>` (114 pages), `B` = `wp-audio-shortcode` with `<source>` (83 pages).
- Part markers vary: `Part 1:`, `Part
 3:`, `Part  4:` — parser must normalize whitespace/colon.

## T2 — `academic_reading_test` (317 pages + dup `reading-test-105-2`)

**Examples inspected:** `ielts-reading-test-1` (3 passages, 9 groups), `-147`, `-208` (webp images), `-112`, `-121`, `-169` (short tests).

```
<b>Attitudes to Language</b>        ← passage title (real title in <b>/<strong>)
<p>…paragraphs of the passage…</p>  ← full passage text as semantic HTML
"Questions 1-8  Do the following statements agree…Reading Passage 1?"
"Questions 9-12 Complete the summary using the list of words A-l below."
"Question 13  Choose the correct letter A, B, C or D."
<b>The language debate</b>          ← passage 2 … "Reading Passage 3" …
<div id="bg-showmore-hidden-*">1. yes\n2. no\n…40. false</div>
```

- 3 passages, Q1–40 typical; boundaries marked by real-title `<b>` headings +
  "Reading Passage N" references inside instructions (never a clean standalone heading —
  segmentation needs the combination).
- Group types observed: TFNG, YNNG, matching headings/information/features, choosing FIVE
  letters from a box, summary/notes/sentence completion (with/without word list),
  diagram labeling (image + "Label the diagram below…"), MCQ, short answers.
- Answer key format: **one answer per line**; academic spells out `yes/no/not given/true/false`;
  variants appear as `slow (turning)`, `jupiter and saturn` (lowercase, slash alternatives).

## T3 — `general_reading_test` (125 pages + `ielts-general-reading-16`)

**Example inspected:** `ielts-general-reading-test-1`.

- Section-based: "You are advised to spend 20 minutes on Questions 1-14" then lettered
  texts (`A`, `B`, `C`… as paragraph anchors — e.g. Moulex iron manual).
- 3 sections (S1: Q1–14 short texts; S2: work-related; S3: one long passage), Q1–40.
- Fewer images (21 pages). Answer key uses short forms: `T`, `F`, `NG`
  and slash-alternatives `calcium deposits/ furring up`.
- Only 23/125 pages match the strict `Questions N-M` scan → GT needs its own
  section segmentation strategy (§EXTRACTION_STRATEGY).

## T4 — `academic_writing_test` (131 pages)

**Examples inspected:** `ielts-writing-test-1`, `-10` (no image), `-129..-132` (book-21 pages).

```
<strong>Task 1:</strong> The two maps below show road access to a city hospital in 2007 and 2010…
<figure><img src="../wp-content/uploads/2024/09/test-1-min-1.png"></figure>
Write at least 150 words.
<strong>Task 2:</strong> Living in a country where you have to speak a foreign language…
Give reasons for your answer…  Write at least 250 words.
[WordPress comments: user-submitted essays — CONTAMINATION, exclude]
```

- No answer keys. Task markers are `<strong>Task 1:</strong>` / `Task 2:` text (not h2).
- 119 pages have exactly 1 Task-1 visual (chart/map/process/diagram); 3 pages have 2;
  12 have none (Task-2-only or missing visual → completeness check).
- Comments section is heavy (user essays) → hard exclusion boundary at `id="comments"`.

## T5 — `listening_mcq_test` (52 pages)

**Example inspected:** `ielts-listening-mcq-test-1` (audio `audio_mcq/mcq_1.mp3`).

- One audio + 1–3 MCQ groups, question numbers are **site-section numbering** (11–14, 21–27…)
  — these are part-drills / excerpts (e.g. "New city developments" = Cambridge-style MCQ set),
  not 40-question tests. All 52 have answer keys and audio (1:1, `audio_mcq/mcq_<n>.mp3`).
- Model as a distinct `mcq_drill` test class; do not merge into full-test numbering.

## T6 — `speaking_cue_card` (179 pages)

**Examples inspected:** `ielts-speaking-cue-card-an-exciting-book-you-read`, `-describe-a-good-law…`.

```
<h1>An exciting book you read</h1>
<p><a href="../ielts-speaking-latest-makkar-cue-cards/…"><strong>Latest Makkar cue cards with new solutions</strong></a></p>
<p>1. Today's modern life has become very hectic.<br/>2. …</p>   ← numbered sample answer
```

- The "question" is the page topic (title/slug); content is a Makkar sample answer
  (numbered sentences). No Part 1/Part 3, no examiner frames, no audio.
- 179 pages; Makkar hub enumerates 180 (one duplicate slug: two slugs listed for the same
  topic — verify in reconciliation).
- Model: Part 2 cue card (topic + sample answer as supporting material); sample answers
  must be stored as `sample_answer` content, never as question text.

## T7 — Hubs, book pages, info pages (~195 pages)

| Template | Pages | Content |
|---|---|---|
| `official_book_hub` | 21 | Links mapping Cambridge Book B Test T → flat slugs. **Authoritative Cambridge identity source** (partial: no writing for books 1–18, no speaking anywhere). |
| `hub_or_info` | 13 | TablePress enumerations for listening (207 links incl. slug exceptions), academic reading (319), GT reading (126), writing (132); makkar speaking hub (180); plus intro/email-gated pages with no tests. |
| `sample_essay` | 32 | Model essays — study material, **not** exam content. |
| `tutorial_hub`, `vocabulary_hub` | 7 | Tutorials/word lists — excluded. |
| `legal_misc` | 5 | Privacy/terms/etc. — excluded. |
| `home` + loose 111 files | 5 | Home page; the 4 loose files ARE the canonical test-111 pages. |

## Parser-relevant global facts (all templates)

- Single content container: `div.entry-content`; hard end boundary: `id="comments"` / `site-footer`.
- Charset: UTF-8 with typographic quotes/`…` entities; normalize whitespace + Unicode NFC only.
- Ads: `<ins data-ad-client>`, iframes — strip. Nav/footer: outside entry-content — strip.
- Theme `bosa` markup is consistent across all 1,091 pages (single scrape, one theme version).
- No JS-generated content; no lazy-loaded media; no pagination; no login walls.
