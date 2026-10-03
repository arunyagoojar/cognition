#!/usr/bin/env python3
"""
Cognition — production Writing validator (independent of the extractor).

This validator shares NO code with pipeline/extract_writing.py (or the shared
extract_listening helpers). It re-derives every Writing test from the raw
source HTML with its own element-level parser and compares the result with
content-db/writing, so an extractor bug cannot hide behind identical code.

Checks, for EVERY record (no sampling):
- identity: id grammar, uniqueness, id == frozen id in content-db/writing/id-map.json
- prompts (shipped records): exact equality with the independent re-extraction;
  no sample answer / model essay / band-score / orphan "TASK n" heading / site
  shell; prompt length cap; single prompt (no fused numbered second question);
  word-limit sentence parsed consistently (150 for Task 1, 250 for Task 2)
- Task 1 visual: exactly one distinct image in the Task 1 region (or an HTML
  table); the recorded asset is that image; sha256/MIME/dimensions re-computed
  from source; R2 key (media.js rule) present in media_manifest.json with the
  same sha256
- HTML tables: rows equal the source table; a heading next to the table is its
  caption (never prompt text)
- quarantine: the set of reason codes on each record equals the set the
  validator derives independently, and writing/quarantine/ mirrors it exactly
- reconciliation from the source mirror on disk (not from the extractor's
  inventory): test pages and every writing-related page are accounted for as
  production + quarantined + duplicates + irrelevant

Read-only by default. `--write` stores the report in content-db/writing/validation.json.
Exit code 1 on any failure. Wired as `npm run validate:production:writing`.
"""
import glob, hashlib, json, os, re, sys
from collections import Counter

from bs4 import BeautifulSoup, Tag
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.environ.get("COGNITION_SRC_ROOT", "/Users/arunyagoojar/Downloads/ielts-website")
DB = os.path.join(REPO, "content-db")
WDB = os.path.join(DB, "writing")

ID_RE = re.compile(r"^writing\.test-\d{4}\.[0-9a-f]{8}$")
VISUAL_TYPES = {"line_graph", "bar_chart", "pie_chart", "table", "process", "map",
                 "mixed_chart", "diagram", "multiple_visual", "other"}
REASON_CODES = {"TASK1_VISUAL_INCOMPLETE", "TASK1_VISUAL_MISSING", "MULTIPLE_PROMPTS_FUSED",
                 "PROMPT_LENGTH_ANOMALY", "SAMPLE_ANSWER_CONTAMINATION", "MALFORMED_HTML",
                 "EMPTY_PROMPT", "TASK2_MISSING"}
MAX_PROMPT_WORDS = {"1": 100, "2": 120}      # corpus max of genuine prompts: T1 67, T2 70
EXPECTED_LIMIT = {"1": 150, "2": 250}

# Anything that marks the start of a model / sample answer. Deliberately broad:
# "BAND 7.5 ANSWER", "Band 8 sample", "Sample answer", "Model essay", …
ANSWER_LEAK = re.compile(r"\bsample\s+(?:answer|essay|response)|\bmodel\s+(?:answer|essay)|"
                         r"\bband\s*(?:score\s*)?\d(?:\.\d)?\b|\bsuggested answer|\bcandidate response|"
                         r"\banswer analysis|\bexaminer comment", re.I)
SAMPLE_BLOCK_START = re.compile(r"(?:\b(?:task|test)\s*[12]\s+)?(?:\bband\s*\d(?:\.\d)?\s+(?:answer|essay|sample|response)"
                                r"|\bsample\s+(?:answer|essay)|\bmodel\s+(?:answer|essay))", re.I)
SITE_SHELL = re.compile(r"leave a reply|recent posts|IELTS MASTER|cambridge ielts tests \d+ to \d+|"
                        r"share this|click here|https?://", re.I)
ORPHAN_HEADING = re.compile(r"\b(?:task|test)\s*[12]\s*:?\s*$", re.I)
FUSED_PROMPT = re.compile(r"[.?!]\s+\d{1,3}\.\s+[A-Z]")
MARKER = re.compile(r"\b(?:Task|Test)\s*([12])\s*:", re.I)
LIMIT_SENTENCE = re.compile(r"at\s+lea(?:st|se)\s+(\d{3})\s+words|minimum\s+(?:of\s+)?(\d{3})\s+words|\b(\d{3})-word\b", re.I)
NAV_PARAGRAPH = re.compile(r"^Cambridge IELTS Tests \d+ to \d+$", re.I)
LITESPEED_VARIANT = re.compile(r"-q[0-9a-f]{10}(?=\.\w+$)")
HEADINGS = ("h1", "h2", "h3", "h4", "h5", "h6", "figcaption")


def clean(text):
    t = (text or "").replace("\xa0", " ").replace("​", "")
    return re.sub(r"\s+", " ", t).strip()


def canon(text):
    t = clean(text).replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return t.lower()


def fail(errors, slug, code, detail=""):
    errors.append({"slug": slug, "code": code, "detail": str(detail)[:240]})


def file_meta(rel):
    p = os.path.join(SRC_ROOT, rel)
    if not os.path.isfile(p):
        return None
    data = open(p, "rb").read()
    head = data[:12]
    mime = ("image/png" if head[:8] == b"\x89PNG\r\n\x1a\n" else
            "image/jpeg" if head[:3] == b"\xff\xd8\xff" else
            "image/webp" if head[:4] == b"RIFF" and head[8:12] == b"WEBP" else
            "image/gif" if head[:3] == b"GIF" else "unknown")
    try:
        with Image.open(p) as im:
            dims = im.size
    except Exception:
        dims = (None, None)
    return {"sha256": hashlib.sha256(data).hexdigest(), "mimeType": mime, "width": dims[0], "height": dims[1]}


def canonical_asset(src):
    """Source-relative asset path for an <img> url (LiteSpeed cache variant → original when present)."""
    rel = re.sub(r"^(?:\.\./)+", "", src.split("?")[0])
    rel = re.sub(r"^https?://[^/]+/", "", rel).lstrip("/")
    base = LITESPEED_VARIANT.sub("", rel)
    if base != rel and os.path.isfile(os.path.join(SRC_ROOT, base)):
        return base
    return rel


def r2_key(source_path):
    """Mirror of src/utils/media.js#resolveMediaUrl for writing images."""
    m = re.match(r"^wp-content/uploads/\d{4}/\d{2}/(.+\.(?:png|webp|jpg|jpeg))$", source_path)
    base = m.group(1) if m else source_path.split("/")[-1]
    return f"cognition/images/writing/{base}"


# ───────────────────────────────────────────── independent source parser
def page_path(slug):
    return slug if slug.endswith(".html") else f"{slug}/index.html"


def read_source(slug):
    """Element-level re-derivation of one Writing test page.

    Collects <p>/<li> paragraphs, headings, tables and <img> elements of the
    entry-content in document order (find_all order), lays the paragraph text
    out as one string with offsets, and slices it at the Task 1 / Task 2
    markers. Images/tables/headings are attributed to a task by offset."""
    raw = open(os.path.join(SRC_ROOT, page_path(slug)), "rb").read()
    soup = BeautifulSoup(raw.decode("utf-8", "replace"), "html.parser")
    ec = soup.find("div", class_="entry-content")
    if ec is None:
        return {"error": "NO_ENTRY_CONTENT"}
    cut = ec.find(id="comments")
    if cut is not None:
        for el in [cut, *cut.find_next_siblings()]:
            el.decompose()
    for el in ec.find_all(["script", "style", "noscript", "ins", "iframe", "form", "button"]):
        el.decompose()

    text, items = "", []            # items: (offset, kind, payload)
    block_start = {}                # id(text block) -> offset of its text in `text`
    for el in ec.find_all(["p", "li", "table", "img", *HEADINGS]):
        if el.find_parent("table") is not None:
            continue
        if el.name == "img":
            src = el.get("data-src") or el.get("src") or ""
            if "wp-content/uploads" in src and not src.startswith("data:"):
                offset = len(text)
                block = el.find_parent(["p", "li", *HEADINGS])
                while block is not None and block.find_parent(["p", "li", *HEADINGS]) is not None:
                    block = block.find_parent(["p", "li", *HEADINGS])
                if block is not None and id(block) in block_start:
                    # image inside a paragraph (both task markers may share one <p>):
                    # position it after the text that precedes it in that paragraph
                    before = []
                    for node in block.descendants:
                        if node is el:
                            break
                        if isinstance(node, str) and not isinstance(node, Tag):
                            before.append(str(node))
                    offset = block_start[id(block)] + len(clean(" ".join(before)))
                items.append((offset, "img", canonical_asset(src)))
            continue
        if el.name == "table":
            rows = [[clean(c.get_text(" ")) for c in tr.find_all(["td", "th"])] for tr in el.find_all("tr")]
            items.append((len(text), "table", [r for r in rows if any(r)]))
            continue
        if el.find_parent(["p", "li", *HEADINGS]) is not None:
            continue                                  # text already counted with its block
        t = clean(el.get_text(" "))
        if not t or NAV_PARAGRAPH.match(t):
            continue
        start = len(text) + (1 if text else 0)
        block_start[id(el)] = start
        text = f"{text} {t}" if text else t
        if el.name in HEADINGS:
            # headings are laid out as text too (a marker may sit in one); a table
            # task removes them from its prompt below
            items.append((start, "heading", t))

    marks = {}
    for m in MARKER.finditer(text):
        marks.setdefault(m.group(1), m)
    if "1" not in marks or "2" not in marks or marks["1"].start() > marks["2"].start():
        return {"error": "NO_TASK_MARKERS", "text": text}
    span = {"1": (marks["1"].end(), marks["2"].start()), "2": (marks["2"].end(), len(text))}

    out = {"page": page_path(slug), "pageSha256": hashlib.sha256(raw).hexdigest()}
    for tn, (a, b) in span.items():
        # an image/table laid out at exactly the next marker's offset precedes that
        # marker in the document, so it still belongs to this region
        region = [(o, k, p) for o, k, p in items if a <= o < b or (o == b and k in ("img", "table"))]
        tables = [p for _, k, p in region if k == "table"]
        heads = [(o, p) for o, k, p in region if k == "heading"]
        body = text[a:b]
        if tables:
            # a heading inside a table task is the table caption/footnote, not prompt text
            for o, h in sorted(heads, reverse=True):
                rel = o - a
                if body[rel:rel + len(h)] == h:
                    body = body[:rel] + body[rel + len(h):]
        sample = SAMPLE_BLOCK_START.search(body)
        prompt = clean(body[:sample.start()] if sample else body)
        images = []
        for _, k, p in region:
            if k == "img" and p not in images:
                images.append(p)
        out[tn] = {"prompt": prompt, "sampleCut": bool(sample), "images": images,
                   "tables": tables, "headings": [h for _, h in heads]}
    return out


def expected_reasons(src):
    """Quarantine reasons the validator derives on its own from the source."""
    reasons = set()
    for tn in ("1", "2"):
        p = src[tn]["prompt"]
        if len(p) < 40:
            reasons.add("EMPTY_PROMPT" if tn == "1" else "TASK2_MISSING")
        if FUSED_PROMPT.search(p):
            reasons.add("MULTIPLE_PROMPTS_FUSED")
        if len(p.split()) > MAX_PROMPT_WORDS[tn]:
            reasons.add("PROMPT_LENGTH_ANOMALY")
    t1 = src["1"]
    if len(t1["images"]) > 1:
        reasons.add("TASK1_VISUAL_INCOMPLETE")
    if not t1["images"] and not t1["tables"]:
        reasons.add("TASK1_VISUAL_MISSING")
    return reasons


# ───────────────────────────────────────────── source-mirror reconciliation
WRITING_PAGE = re.compile(r"^(?:ielts-writing-|ielts-academic-writing|ielts-general-writing|writing-|sample-essay)")


def discover_source():
    """Writing-related pages in the mirror, classified from disk alone."""
    tests, variants, irrelevant = {}, [], []
    for name in sorted(os.listdir(SRC_ROOT)):
        if not WRITING_PAGE.match(name):
            continue
        path = os.path.join(SRC_ROOT, name)
        m = re.match(r"^ielts-writing-test-(\d+)(\.html)?$", name)
        if m:
            n = int(m.group(1))
            if m.group(2):                                   # loose page: canonical only if no dir exists
                if not os.path.isdir(os.path.join(SRC_ROOT, f"ielts-writing-test-{n}")):
                    tests[n] = name
                else:
                    variants.append(name)
                continue
            tests[n] = name
            for extra in sorted(os.listdir(path)):
                if extra != "index.html" and extra.endswith(".html"):
                    variants.append(f"{name}/{extra}")
            continue
        if os.path.isdir(path) or name.endswith(".html"):
            irrelevant.append(name)
    return tests, variants, irrelevant


def entry_text(rel):
    p = os.path.join(SRC_ROOT, rel if rel.endswith(".html") else f"{rel}/index.html")
    soup = BeautifulSoup(open(p, "rb").read().decode("utf-8", "replace"), "html.parser")
    ec = soup.find("div", class_="entry-content")
    return clean(ec.get_text(" ")) if ec else ""


def hub_enumeration():
    p = os.path.join(SRC_ROOT, "ielts-academic-writing-tests", "index.html")
    if not os.path.isfile(p):
        return set()
    html = open(p, "rb").read().decode("utf-8", "replace")
    return {int(n) for n in re.findall(r"ielts-writing-test-(\d+)", html)}


# ───────────────────────────────────────────── main
def main():
    errors, warnings = [], []
    if not os.path.isdir(SRC_ROOT):
        print(f"source mirror not found: {SRC_ROOT}")
        sys.exit(1)
    tests = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(WDB, "tests", "*.json")))]
    id_map_path = os.path.join(WDB, "id-map.json")
    frozen = json.load(open(id_map_path))["ids"] if os.path.exists(id_map_path) else {}
    media = {m["r2Key"]: m for m in json.load(open(os.path.join(DB, "media_manifest.json")))["media"]}
    quarantine_files = {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(WDB, "quarantine", "*.json"))}

    ids = Counter()
    stats = Counter()
    drift = 0
    for r in tests:
        slug = r["slug"]
        status = r.get("status")
        shipped = status == "verified"
        # ── identity ──
        if not ID_RE.match(r.get("id", "")):
            fail(errors, slug, "ID_MALFORMED", r.get("id"))
        ids[r["id"]] += 1
        if slug in frozen and frozen[slug] != r["id"]:
            fail(errors, slug, "ID_NOT_FROZEN", f"{r['id']} != frozen {frozen[slug]}")
        if slug not in frozen:
            warnings.append({"slug": slug, "code": "ID_NOT_IN_MAP", "detail": r["id"]})
        if status not in ("verified", "quarantined", "duplicate"):
            fail(errors, slug, "STATUS_INVALID", status)

        src = read_source(slug)
        if "error" in src:
            if status != "quarantined":
                fail(errors, slug, "SOURCE_UNPARSEABLE_BUT_SHIPPED", src["error"])
            continue
        if r.get("provenance", {}).get("page", {}).get("path") != src["page"]:
            fail(errors, slug, "PROVENANCE_PAGE_MISMATCH", r.get("provenance", {}).get("page", {}).get("path"))
        if r.get("provenance", {}).get("page", {}).get("sha256") != src["pageSha256"]:
            drift += 1                                   # cache stamps; content checked below

        # ── quarantine agreement ──
        derived = expected_reasons(src)
        recorded = {u.get("reasonCode") for u in r.get("quarantinedUnits", [])}
        if recorded - REASON_CODES:
            fail(errors, slug, "QUARANTINE_REASON_UNKNOWN", sorted(recorded - REASON_CODES))
        if derived != recorded:
            fail(errors, slug, "QUARANTINE_DISAGREES", f"recorded={sorted(recorded)} independent={sorted(derived)}")
        if (status == "quarantined") != bool(recorded):
            fail(errors, slug, "QUARANTINE_STATUS_INCONSISTENT", f"status={status} reasons={sorted(recorded)}")
        if (slug in quarantine_files) != bool(recorded):
            fail(errors, slug, "QUARANTINE_FILE_MISMATCH", f"file={slug in quarantine_files} reasons={sorted(recorded)}")
        if shipped and r.get("kind") != "complete_test":
            fail(errors, slug, "SHIPPED_NOT_COMPLETE", r.get("kind"))

        for tn in ("1", "2"):
            task = r.get(f"task{tn}")
            if task is None:
                if shipped:
                    fail(errors, slug, f"TASK{tn}_MISSING", "no task record")
                continue
            stats[f"task{tn}"] += 1
            prompt = task.get("prompt") or ""
            # fidelity is checked for every record (quarantined ones keep exact text too)
            if canon(prompt) != canon(src[tn]["prompt"]):
                fail(errors, slug, f"TASK{tn}_INDEPENDENT_MISMATCH",
                     f"prod tail={prompt[-70:]!r} source tail={src[tn]['prompt'][-70:]!r}")
            if not shipped:
                continue
            if len(prompt) < 40:
                fail(errors, slug, f"TASK{tn}_PROMPT_EMPTY", prompt[:60])
            if ANSWER_LEAK.search(prompt):
                fail(errors, slug, f"TASK{tn}_ANSWER_LEAK", prompt[ANSWER_LEAK.search(prompt).start():][:120])
            if SITE_SHELL.search(prompt):
                fail(errors, slug, f"TASK{tn}_SITE_CONTAMINATION", SITE_SHELL.search(prompt).group(0))
            if ORPHAN_HEADING.search(prompt):
                fail(errors, slug, f"TASK{tn}_ORPHAN_HEADING", prompt[-60:])
            if len(prompt.split()) > MAX_PROMPT_WORDS[tn]:
                fail(errors, slug, f"TASK{tn}_PROMPT_TOO_LONG", f"{len(prompt.split())} words")
            if FUSED_PROMPT.search(prompt):
                fail(errors, slug, f"TASK{tn}_MULTIPLE_PROMPTS", prompt[FUSED_PROMPT.search(prompt).start():][:100])
            if re.search(r"\b(?:write a letter|dear (?:sir|madam|mr|mrs|ms))\b", prompt, re.I):
                fail(errors, slug, f"TASK{tn}_GENERAL_TRAINING_PROMPT", prompt[:80])
            lim = LIMIT_SENTENCE.search(prompt)
            want = int(next(g for g in lim.groups() if g)) if lim else None
            if task.get("wordLimitMin") != want:
                fail(errors, slug, f"TASK{tn}_WORD_LIMIT_MISMATCH", f"recorded={task.get('wordLimitMin')} source={want}")
            if want is not None and want != EXPECTED_LIMIT[tn]:
                fail(errors, slug, f"TASK{tn}_WORD_LIMIT_UNEXPECTED", want)
            if want is None:
                warnings.append({"slug": slug, "code": f"TASK{tn}_NO_WORD_LIMIT_IN_SOURCE", "detail": prompt[-60:]})

            if tn != "1":
                continue
            # ── Task 1 visual ──
            vis, table = task.get("visual"), task.get("table")
            s1 = src["1"]
            if vis and table:
                fail(errors, slug, "VISUAL_AMBIGUOUS", "image and HTML table both recorded")
            if vis:
                stats["images"] += 1
                if len(s1["images"]) != 1:
                    fail(errors, slug, "TASK1_IMAGE_COUNT", f"source Task 1 region has {len(s1['images'])} images")
                elif vis.get("sourcePath") != s1["images"][0]:
                    fail(errors, slug, "TASK1_IMAGE_WRONG", f"{vis.get('sourcePath')} != {s1['images'][0]}")
                if vis.get("visualType") not in VISUAL_TYPES:
                    fail(errors, slug, "VISUAL_TYPE_INVALID", vis.get("visualType"))
                meta = file_meta(vis.get("sourcePath", ""))
                if meta is None:
                    fail(errors, slug, "ASSET_UNRESOLVED", vis.get("sourcePath"))
                else:
                    if meta["sha256"] != vis.get("sha256"):
                        fail(errors, slug, "TASK1_VISUAL_HASH_MISMATCH", vis["sourcePath"])
                    if meta["mimeType"] not in ("image/png", "image/jpeg", "image/webp", "image/gif") \
                            or meta["mimeType"] != vis.get("mimeType"):
                        fail(errors, slug, "VISUAL_MIME_INVALID", f"{meta['mimeType']} vs {vis.get('mimeType')}")
                    if not (meta["width"] and meta["height"]) or (meta["width"], meta["height"]) != (vis.get("width"), vis.get("height")):
                        fail(errors, slug, "VISUAL_DIMENSIONS_INVALID", vis["sourcePath"])
                    key = r2_key(vis["sourcePath"])
                    entry = media.get(key)
                    if entry is None:
                        fail(errors, slug, "TASK1_VISUAL_NOT_IN_MEDIA_MANIFEST", key)
                    elif entry.get("sha256") != meta["sha256"]:
                        fail(errors, slug, "TASK1_VISUAL_R2_HASH_MISMATCH", key)
                    else:
                        stats["imagesInMediaManifest"] += 1
            elif table:
                stats["htmlTables"] += 1
                rows = table.get("rows") or []
                if s1["images"]:
                    fail(errors, slug, "TABLE_BUT_SOURCE_HAS_IMAGE", s1["images"])
                if len(s1["tables"]) != 1 or s1["tables"][0] != rows:
                    fail(errors, slug, "TASK1_TABLE_MISMATCH", f"{len(rows)} rows vs source {[len(t) for t in s1['tables']]}")
                if len(rows) < 2 or any(len(x) != len(rows[0]) for x in rows):
                    fail(errors, slug, "TASK1_TABLE_MALFORMED", f"{len(rows)} rows")
                src_heads = s1["headings"]
                rec_heads = ([table["caption"]] if table.get("caption") else []) + list(table.get("notes") or [])
                if [canon(h) for h in rec_heads] != [canon(h) for h in src_heads]:
                    fail(errors, slug, "TASK1_TABLE_CAPTION_MISMATCH", f"recorded={rec_heads} source={src_heads}")
                if src_heads:
                    stats["tableCaptions"] += 1
                if not re.search(r"\bwords\.?$", prompt):
                    fail(errors, slug, "TASK1_TABLE_TEXT_FUSED", prompt[-60:])
            else:
                fail(errors, slug, "TASK1_VISUAL_MISSING", "no visual and no table")

    for rid, n in ids.items():
        if n > 1:
            fail(errors, "—", "ID_DUPLICATE", f"{rid} x{n}")
    stale = quarantine_files - {r["slug"] for r in tests}
    for s in sorted(stale):
        fail(errors, s, "QUARANTINE_FILE_ORPHAN", "quarantine file without a record")
    if drift:
        warnings.append({"slug": "*", "code": "SOURCE_BYTES_DRIFT",
                         "detail": f"{drift} pages changed bytes since extraction (ids are frozen; prompts re-verified above)"})

    # ── reconciliation from the mirror on disk ──
    src_tests, variants, irrelevant = discover_source()
    by_page = {r["provenance"]["page"]["path"].split("/")[0] if not r["slug"].endswith(".html") else r["slug"]: r
               for r in tests}
    statuses = Counter()
    unaccounted = []
    for n, name in sorted(src_tests.items()):
        r = by_page.get(name)
        if r is None:
            unaccounted.append(name)
        else:
            statuses[r["status"]] += 1
    for name in unaccounted:
        fail(errors, name, "SOURCE_PAGE_UNACCOUNTED", "writing test page has no content-db record")
    for r in tests:
        if r["slug"] not in src_tests.values():
            fail(errors, r["slug"], "RECORD_WITHOUT_SOURCE_PAGE", r["provenance"]["page"]["path"])
    # query-string variants must be byte-for-byte content duplicates of their page
    dup_variants = 0
    for v in variants:
        parent = v.split("/")[0]
        if entry_text(v) == entry_text(parent):
            dup_variants += 1
        else:
            fail(errors, v, "VARIANT_PAGE_DIFFERS", "query-string variant entry-content differs from index.html")
    hub = hub_enumeration()
    missing_hub = sorted(n for n in hub if n not in src_tests)
    if missing_hub:
        fail(errors, "ielts-academic-writing-tests", "HUB_TEST_NOT_IN_MIRROR", missing_hub)
    production = statuses.get("verified", 0)
    quarantined = statuses.get("quarantined", 0)
    duplicates = statuses.get("duplicate", 0)
    tests_recon = {"discovered": len(src_tests), "production": production, "quarantined": quarantined,
                   "duplicates": duplicates, "irrelevant": len(unaccounted)}
    tests_recon["reconciles"] = sum(v for k, v in tests_recon.items() if k != "discovered") == len(src_tests)
    pages_total = len(src_tests) + len(variants) + len(irrelevant)
    corpus_recon = {"writingRelatedSourcePages": pages_total, "production": production, "quarantined": quarantined,
                    "duplicates": duplicates + dup_variants, "irrelevant": len(irrelevant) + len(unaccounted),
                    "duplicatePages": variants, "irrelevantPages": irrelevant,
                    "hubEnumerated": len(hub)}
    corpus_recon["reconciles"] = (production + quarantined + corpus_recon["duplicates"]
                                  + corpus_recon["irrelevant"]) == pages_total
    if not (tests_recon["reconciles"] and corpus_recon["reconciles"]):
        fail(errors, "—", "RECONCILIATION_FAILED", json.dumps(tests_recon))

    report = {
        "validator": "pipeline/validate_writing.py (independent re-derivation)",
        "records": len(tests),
        "shipped": production,
        "task1Records": stats["task1"], "task2Records": stats["task2"],
        "images": {"shippedImages": stats["images"], "inMediaManifest": stats["imagesInMediaManifest"],
                   "htmlTables": stats["htmlTables"], "tableCaptions": stats["tableCaptions"]},
        "quarantine": {r["slug"]: sorted({u["reasonCode"] for u in r["quarantinedUnits"]})
                       for r in tests if r.get("quarantinedUnits")},
        "errors": errors,
        "warnings": warnings,
        "reconciliation": {"testPages": tests_recon, "corpus": corpus_recon},
    }
    if "--write" in sys.argv:
        with open(os.path.join(WDB, "validation.json"), "w") as f:
            json.dump(report, f, indent=1, ensure_ascii=False)
    summary = {k: report[k] for k in ("records", "shipped", "task1Records", "task2Records", "images", "quarantine")}
    summary["reconciliation"] = {"testPages": tests_recon,
                                 "corpus": {k: v for k, v in corpus_recon.items()
                                            if k not in ("duplicatePages", "irrelevantPages")}}
    print(json.dumps(summary, indent=1))
    print("warnings:", Counter(w["code"] for w in warnings))
    print("errors:", len(errors))
    for e in errors[:40]:
        print("  ✗", e["slug"], e["code"], e["detail"][:140])
    if errors:
        print("VALIDATION FAILED")
        sys.exit(1)
    print("WRITING PRODUCTION VALIDATION PASSED" + ("" if "--write" in sys.argv else " (read-only)"))


if __name__ == "__main__":
    main()
