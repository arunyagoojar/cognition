# CONTENT_MODEL_PROPOSAL.md — Cognition Phase 1E

A content database model designed from what the source actually contains
(see [SOURCE_FORENSIC_REPORT.md](SOURCE_FORENSIC_REPORT.md) and
[TEMPLATE_CATALOG.md](TEMPLATE_CATALOG.md)). It optimizes for **both** data integrity
(provenance, validation, quarantine) and **application rendering** (the UI never
reverse-engineers HTML).

Design decisions and the reasons behind them:

1. **Everything is addressed by stable IDs derived from the source** — `testId = <module>.<sourceNumber>` plus a `sourceHash8` content fingerprint. Re-running extraction on an unchanged page yields identical IDs (reproducibility); a changed page gets a new fingerprint instead of silently overwriting (traceability).
2. **Question groups are first-class records.** Instructions, shared word-boxes/tables and options belong to the group; questions reference their group (the exact failure V2 avoided on some packages and failed on others).
3. **Completion questions carry segmented text with explicit blank anchors** — never a lone `"_____"` string, never the group instruction pasted into the question.
4. **Answers are separate, keyed records** (not embedded in questions) so answer→question mapping can be validated independently and quarantined without discarding the question.
5. **Provenance is per-record** (test, group, question, asset, answer) with source path + SHA-256 + extraction method + source-region descriptor.
6. **Render hints are explicit** (`interaction`, `layout`) so the UI maps a question to a component without type-guessing, but raw source text/HTML is preserved alongside for auditability.

## Entity graph

```
Test (listening|reading|writing|speaking|mcq_drill)
 ├── identity: sourceNumbers[], cambridgeIdentity[], title
 ├── provenance: page {path, sha256}, extraction run
 ├── Listening: sections[4] → audio[asset] → questionGroups[] → questions[]
 ├── Reading:   passages[3] → content (segments) + assets[] → questionGroups[] → questions[]
 ├── Writing:   task1 {prompt, visual[asset], wordLimit} / task2 {prompt, wordLimit}
 └── Speaking:  part2 {cueCard topic, prompts[]} (+sampleAnswer ref, stored separately)
QuestionGroup: {instruction, stimulus?, sharedOptions?, questionNumbers[], questions[]}
Question:      {number, type, interaction, stem(s), blanks[], options?, choices?, answerRef}
Answer:        {questionNumber, value, variants[], normalized, keyProvenance}
Asset:         {id, sha256, bytes, mime, originalPath, role, usedBy[]}
Quarantine:    {record, reasonCode, evidence, sourceRegion}
```

## Question types discovered in the source (closed enum, extensible)

`mcq_single`, `mcq_multi` (choose FIVE letters A–H), `matching_box` (map items→letters),
`matching_headings`, `matching_information`, `matching_features`, `tfng`, `ynng`,
`completion` (form/note/table/summary/sentence/flow-chart — differentiated by
`stimulus.kind`), `short_answer`, `map_labeling`, `diagram_labeling`.

Interaction mapping: `mcq_*`→radio/checkbox; `completion*`/`short_answer`→text input
(with word-limit constraint from the instruction); `matching*`→letter select;
`tfng`/`ynng`→3-way choice; `map_labeling`/`diagram_labeling`→blank-on-asset.

---

## Example objects (grounded in real source content)

### 1. Listening test
```json
{
  "id": "listening.test-0001.3f9c2a11",
  "module": "listening",
  "sourceNumbers": [1],
  "slug": "ielts-listening-test-1",
  "title": "IELTS Listening Test 1",
  "cambridgeIdentity": [],
  "kind": "full_test",
  "sections": ["listening.test-0001.3f9c2a11.s1", ".s2", ".s3", ".s4"],
  "audio": ["asset.a2f4…"],
  "provenance": {
    "page": { "path": "ielts-listening-test-1/index.html", "sha256": "3f9c2a11…" },
    "extractionRun": "run-2026-10-02T14-11"
  }
}
```

### 2. Listening section
```json
{
  "id": "listening.test-0001.3f9c2a11.s1",
  "sectionNumber": 1,
  "speakerContext": "Travel agency conversation",
  "audio": { "assetId": "asset.a2f4…", "role": "full_test_audio",
             "sourceRef": { "element": "audio[src]", "originalSrc": "../wp-content/uploads/audio/1_we.mp3" } },
  "questionNumbers": [1, 10],
  "questionGroups": ["listening.test-0001.3f9c2a11.s1.g1", ".s1.g2"]
}
```
(Source: test-1 has one audio for all four parts; parts are delimited by `Part N:` markers.)

### 3. Listening question group
```json
{
  "id": "listening.test-0001.3f9c2a11.s1.g1",
  "questionNumbers": [1, 5],
  "instruction": {
    "text": "Complete the table below. Write ONE WORD OR A NUMBER.",
    "wordLimit": { "max": 1, "acceptNumbers": true },
    "sourceRef": { "element": "p", "textHash": "…" }
  },
  "stimulus": {
    "kind": "table",
    "headers": ["Apartments", "Facilities", "Other Information", "Cost"],
    "html": "<table>…</table>",
    "textSegments": [ "Rose Garden Apartments | Studio Flat | Entertainment programme: Greek dancing | £219",
                      "Blue Bay Apartments | Large salt water swimming pool | – Just {b1} meters from beach – Near shops | £275" ]
  },
  "sharedOptions": null
}
```

### 4. Listening completion question (inline blank, table cell)
```json
{
  "number": 1,
  "type": "completion",
  "interaction": "text_input",
  "wordLimit": { "max": 1, "acceptNumbers": true },
  "stem": {
    "segments": ["Blue Bay Apartments row – Just ", { "blank": 1 }, " meters from beach"],
    "plain": "Blue Bay Apartments row – Just ______ meters from beach"
  },
  "blankContext": { "stimulusId": "…s1.g1", "cell": "Other Information", "row": 2 },
  "answerRef": "listening.test-0001.3f9c2a11.s1.g1.a1"
}
```
(Source: `– Just (1)…………. .meters from beach`, key: `1. 300`.)

### 5. Listening multiple choice question
```json
{
  "number": 11,
  "type": "mcq_single",
  "interaction": "radio",
  "stem": { "plain": "Simon's idea for a theme park came from" },
  "options": [
    { "letter": "A", "text": "his childhood hobby" },
    { "letter": "B", "text": "his interest in landscape design" },
    { "letter": "C", "text": "his visit to another park" }
  ],
  "answerRef": "listening.test-0001.3f9c2a11.s2.g1.a11"
}
```
(Source: WINRIDGE FOREST RAILWAY PARK, Questions 11–13, key `11. C`.)

### 6. Listening map/plan labeling question
```json
{
  "number": 17,
  "type": "map_labeling",
  "interaction": "blank_on_asset",
  "instruction": { "text": "Label the map below. Write the correct letter A–I." },
  "assetRef": "asset.9d13…",
  "stem": { "segments": [{ "blank": 17 }, " — Guest lounge"], "plain": "______ — Guest lounge" },
  "sharedOptions": { "kind": "letters_box", "items": ["A","B","C","D","E","F","G","H","I"] },
  "answerRef": "…s2.g3.a17"
}
```
(Modeled from the map-labeling groups present in the listening corpus; asset = the page's
map image; options may be names or letters depending on the page — `layout` records which.)

### 7. Reading test
```json
{
  "id": "reading.test-0001.7c1e9b04",
  "module": "reading",
  "sourceNumbers": [1],
  "slug": "ielts-reading-test-1",
  "title": "IELTS Reading Test 1",
  "cambridgeIdentity": [],
  "kind": "full_test",
  "passages": ["reading.test-0001.7c1e9b04.p1", ".p2", ".p3"],
  "provenance": { "page": { "path": "ielts-reading-test-1/index.html", "sha256": "7c1e…" } }
}
```

### 8. Reading passage
```json
{
  "id": "reading.test-0001.7c1e9b04.p1",
  "passageNumber": 1,
  "title": "Attitudes to Language",
  "content": {
    "paragraphs": [
      { "label": null, "text": "It is not easy to be systematic and objective about language study. …" },
      { "label": null, "text": "Language, moreover, is a very public behaviour, so it is easy …" },
      { "label": null, "text": "In its most general sense, prescriptivism is the view that …" }
    ],
    "html": "<p>…</p>…"
  },
  "assets": [],
  "questionGroups": ["…p1.g1", "…p1.g2", "…p1.g3"]
}
```
(Passages with paragraph letters A–F — required by matching-questions — store `label`.)

### 9. Reading question group
```json
{
  "id": "reading.test-0001.7c1e9b04.p1.g2",
  "questionNumbers": [9, 12],
  "instruction": { "text": "Complete the summary using the list of words, A-I, below." },
  "stimulus": {
    "kind": "summary",
    "html": "<p>The dominance of the 'standard' language has led to … {b9} …</p>",
    "textSegments": ["The standard variety is treated as {b9} by prescriptivists, and deviations are labelled {b10} …"]
  },
  "sharedOptions": { "kind": "word_box", "items": ["A superior","B correct","C chaos","…","I writing"] },
  "questions": ["…q9","…q10","…q11","…q12"]
}
```

### 10. Reading question (TFNG + matching variants)
```json
{
  "number": 1,
  "type": "tfng",
  "interaction": "choice3",
  "stem": { "plain": "Popular linguistic debate regularly deteriorates into invective and polemic." },
  "answerRef": "reading.test-0001.7c1e9b04.p1.g1.a1"
}
```
```json
{
  "number": 14,
  "type": "matching_information",
  "interaction": "letter_select",
  "stem": { "plain": "an example of a situation where linguistic prejudice can affect employment" },
  "sharedOptions": { "kind": "paragraphs", "items": ["A","B","C","D","E","F"] },
  "instructionGroup": "Reading Passage 2 has six paragraphs, A-F. Which paragraph contains the following information? NB You may use any letter more than once.",
  "answerRef": "…p2.g1.a14"
}
```
(Source: reading-test-1 Q1 key `yes`, Q14 key `H`.)

### 11. Writing Task 1
```json
{
  "id": "writing.test-0001.5e2a8c31.task1",
  "taskNumber": 1,
  "type": "task1_visual",
  "prompt": "The two maps below show road access to a city hospital in 2007 and 2010. Summarize the information by selecting and reporting the main features and make comparisons wherever relevant.",
  "visual": { "assetId": "asset.77b1…", "role": "task1_visual",
              "sourceRef": { "originalSrc": "wp-content/uploads/2024/09/test-1-min-1.png" },
              "visualKind": "map", "visualKindConfidence": "deterministic_title_match" },
  "wordLimit": { "min": 150 },
  "provenance": { "page": { "path": "ielts-writing-test-1/index.html", "sha256": "5e2a…" } }
}
```

### 12. Writing Task 2
```json
{
  "id": "writing.test-0001.5e2a8c31.task2",
  "taskNumber": 2,
  "type": "task2_essay",
  "prompt": "Living in a country where you have to speak a foreign language can cause serious social problems, as well as practical problems.",
  "subPrompts": ["To what extent do you agree or disagree with this statement?"],
  "boilerplate": ["Give reasons for your answer and include any relevant examples from your own knowledge or experience."],
  "wordLimit": { "min": 250 },
  "visual": null
}
```

### 13. Speaking Part 1 (generic, site-derived — see caveat)
```json
{
  "id": "speaking.makkar.part1.framework",
  "kind": "framework",
  "note": "Source contains no Part 1 material; this object type exists so the schema is complete. Never synthesized — omitted from the DB until a source exists."
}
```
(Explicit non-record: the source has **no** Part 1/Part 3 content; the pipeline must not
invent it. The DB will contain only what the source has.)

### 14. Speaking Part 2 (cue card)
```json
{
  "id": "speaking.makkar.card-0002.e4a1b0c2",
  "part": 2,
  "sourceNumber": 2,
  "cueCard": {
    "topic": "An exciting book you read",
    "title": "Describe an exciting book you read",
    "bullets": [],
    "bulletsNote": "Source page (Makkar sample-answer page) does not carry the card's bullet prompts; bullets stay empty rather than invented."
  },
  "sampleAnswer": {
    "kind": "numbered_speech",
    "sentences": ["Today's modern life has become very hectic.", "But there are sporadic moments …"],
    "sourceRef": { "element": "entry-content > p[2]" },
    "usage": "reference_material_not_question"
  },
  "provenance": { "page": { "path": "ielts-speaking-cue-card-an-exciting-book-you-read/index.html", "sha256": "…" } }
}
```

### 15. Speaking Part 3
Same as 13 — no source material exists; schema placeholder only, no records.

### 16. Asset
```json
{
  "id": "asset.77b16e0d",
  "sha256": "77b16e0d…",
  "bytes": 184213,
  "mime": "image/png",
  "originalPath": "wp-content/uploads/2024/09/test-1-min-1.png",
  "role": "task1_visual",
  "usedBy": ["writing.test-0001.5e2a8c31.task1"],
  "copies": [{ "kind": "original" }, { "kind": "litespeed_cache", "path": "…", "excluded": true }]
}
```
Canonical asset strategy: **one content-addressed copy** (sha256-keyed) per unique file;
LiteSpeed cache variants (`*-q7b50db1914.mp3`) are recognized duplicates and are not
re-copied; the manifest keeps the original path for provenance.

### 17. Provenance (per record)
```json
{
  "provenance": {
    "page": { "path": "ielts-listening-test-170/index.html", "sha256": "9ab7…" },
    "url": "https://practicepteonline.com/ielts-listening-test-170/",
    "region": { "element": "div.entry-content", "charRange": [4211, 11204] },
    "extractionMethod": "deterministic_dom_v1",
    "transformations": ["whitespace", "unicode_nfc", "blank_normalization"],
    "rawExcerpt": "Address: Apartment 2, (1) … , Newton",
    "confidence": 1.0,
    "status": "verified"
  }
}
```

### 18. Quarantined record
```json
{
  "quarantineId": "qz-000042",
  "recordType": "question",
  "record": { "testId": "listening.test-0189.f10c3d22", "sectionNumber": 1,
              "proposedQuestion": { "number": 3, "type": "completion", "stem": { "plain": "…" } } },
  "reasonCode": "ANSWER_MAP_UNPROVEN",
  "reason": "Answer key item 3 exists but group segmentation could not prove Q3 belongs to this group (ambiguous numbering after embedded image).",
  "evidence": { "keyExcerpt": "1. test-2 …", "groupRange": [1, 8], "htmlFragment": "…" },
  "source": { "path": "ielts-listening-test-189/index.html", "sha256": "f10c…" },
  "recoveryPath": "re-run with widened group context or manual mapping decision"
}
```

---

## Storage layout (boundary between app and content)

```
content-db/
├── tests/listening/test-0001.<hash8>.json … (one file per test)
├── tests/reading/…  tests/writing/…  tests/speaking/…  tests/mcq/…
├── answers/<same-id-as-test>.answers.json
├── assets/<sha256[0:2]>/<sha256>.<ext>   ← content-addressed, no duplicates
├── quarantine/<reason-code>/<id>.json
└── index/manifest.json                    ← counts, coverage, run info
```

The application consumes only `tests/` + `answers/` + `assets/` through a data-access
layer; `quarantine/` and `index/` are pipeline-owned. This keeps the Phase 0 boundary
(app ↔ content) while making every record independently addressable and validatable.
