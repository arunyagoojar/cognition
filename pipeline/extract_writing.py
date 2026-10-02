#!/usr/bin/env python3
"""
Cognition — Phase 5: production Writing extraction.

Corpus: 131 `ielts-writing-test-*` directories + the loose canonical
`ielts-writing-test-111.html` (hub-linked) = 132 Academic Writing pages.
GT letter prompts live on one separate page and are inventoried only — never
imported into the Academic runtime.

Rules (Phase 5 spec):
- exact prompt wording; only whitespace/entity normalization
- Task 1 visual = the exact source asset (data-src preferred over lazy src,
  LiteSpeed cache variants canonicalized), sha256 + MIME + dimensions recorded
- genuine HTML tables preserved as structured data (never images, never flattened)
- sample answers / comments / site shell excluded; ambiguous boundary → quarantine
- deterministic IDs; per-record provenance; no generated content
"""
import json, os, re, hashlib, sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_listening import SRC_ROOT, REPO, MANIFEST, norm, norm_keep_nl, content_hash  # noqa: E402
from bs4 import BeautifulSoup, NavigableString, Tag  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(REPO, "content-db")
PIPELINE_VERSION = "production-writing-1.0.0"
HUB_WRITING = MANIFEST["hub_enumerations"]["academic_writing"]
HUB_SLUGS = {e["slug"] for e in HUB_WRITING}
BOOK_MAPS = MANIFEST["cambridge_book_mappings"]

SAMPLE_MARKERS = re.compile(
    r"(sample answer|model answer|band [6-9]\s*(answer|essay)|suggested answer|candidate response|answer analysis)", re.I)
NAV_LINE = re.compile(r"^(Cambridge IELTS Tests 1 to 1[37]|IELTS MASTER|Recent posts)$", re.I)
TASK_MARKER_SCAN = re.compile(r"\b(Task|Test)\s*([12])\s*:\s*", re.I)
WORD_LIMIT = re.compile(r"(?:at least|minimum(?: of)?)\s*(\d{3})\s*words?", re.I)
LITESPEED = re.compile(r"-q7b50db1914(?=\.\w+$)")

# visual type classification from PROMPT evidence (never filename-only)
VISUAL_PATTERNS = [
    ("process", r"\b(process|how .* (is|are) (produced|made|manufactured|works)|stages|life cycle)\b"),
    ("map", r"\bmaps?\b"),
    ("mixed_chart", r"\b(graphs? and (charts?|tables?)|charts? and (graphs?|tables?)|table and (a )?(graph|chart)|two charts|both charts)\b"),
    ("table", r"\btable\b"),
    ("pie_chart", r"\bpie charts?\b"),
    ("line_graph", r"\bline graphs?\b|\bgraph shows\b|\bgraph below\b"),
    ("bar_chart", r"\bbar charts?\b"),
    ("diagram", r"\b(diagram|illustration|plan|figures?)\b"),
]


def classify_visual(prompt):
    p = prompt.lower()
    for vtype, pat in VISUAL_PATTERNS:
        if re.search(pat, p, re.I):
            return vtype
    return "other"


def rich_text(el):
    for br in el.find_all("br"):
        br.replace_with("\n")
    for inp in el.find_all("input"):
        inp.decompose()
    return norm_keep_nl(el.get_text(" "))


SKIP_TAGS = {"ins", "iframe", "script", "style", "button", "form", "input", "noscript", "svg"}

def block_sequence(el):
    """(kind, payload) blocks in TRUE document order (deep walk): text pieces,
    table elements and image urls appear exactly where they sit in the source,
    so task-region attribution follows the actual page layout."""
    out = []
    def walk(node):
        for child in node.children:
            if isinstance(child, NavigableString):
                txt = norm(str(child))
                if txt: out.append(("text", txt))
            elif isinstance(child, Tag):
                name = child.name
                if name in SKIP_TAGS: continue
                if name == "table":
                    out.append(("table", child)); continue
                if name == "img":
                    url = child.get("data-src") or child.get("src")
                    if url and not url.startswith("data:") and "wp-content" in url:
                        out.append(("img", url))
                    continue
                if name in ("ul", "ol"):
                    items = [norm(li.get_text(" ")) for li in child.find_all("li")]
                    out.append(("text", " \u2022 ".join(items)))
                    continue
                walk(child)
    walk(el)
    return out


def parse_table(tbl):
    rows = []
    for tr in tbl.find_all("tr"):
        cells = [norm(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
        if any(cells): rows.append(cells)
    return rows


def asset_meta(rel_path):
    """sha256, MIME (magic), dimensions for a source asset."""
    p = os.path.join(SRC_ROOT, rel_path)
    if not os.path.exists(p):
        return {"exists": False}
    data = open(p, "rb").read()
    sha = hashlib.sha256(data).hexdigest()
    mime = "unknown"
    if data[:8] == b"\x89PNG\r\n\x1a\n": mime = "image/png"
    elif data[:3] == b"\xff\xd8\xff": mime = "image/jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP": mime = "image/webp"
    elif data[:3] == b"GIF": mime = "image/gif"
    width = height = None
    try:
        with Image.open(p) as im:
            width, height = im.size
    except Exception:
        pass
    return {"exists": True, "path": rel_path, "sha256": sha, "bytes": len(data),
             "mimeType": mime, "width": width, "height": height}


def split_tasks(blocks):
    """Split the content block stream into task regions at Task 1 / Task 2 markers.
    Both tasks may share a single <p> (site formatting) — text blocks are
    pre-split at every inline marker. Source variant "Test 1/2" is accepted."""
    flat = []
    BARE_MARKER = re.compile(r"^(?:Task|Test)\s*([12])\s*:?\s*$", re.I)
    for kind, payload in blocks:
        if kind != "text":
            flat.append((kind, payload))
            continue
        matches = list(TASK_MARKER_SCAN.finditer(payload))
        if not matches:
            flat.append((kind, payload))
            continue
        last = 0
        for m in matches:
            pre = payload[last:m.start()]
            if pre.strip(): flat.append(("text", pre))
            flat.append(("marker", m.group(2)))
            last = m.end()
        tail = payload[last:]
        if tail.strip(): flat.append(("text", tail))
    # tolerate markers split across text nodes: "<strong>Task 2</strong>" + ": People…"
    merged, pending_bare = [], None
    for kind, payload in flat:
        if kind == "text":
            if BARE_MARKER.match(payload.strip()):
                pending_bare = payload.strip()
                merged.append(("marker", BARE_MARKER.match(payload.strip()).group(1)))
                continue
            if pending_bare and payload.lstrip().startswith(":"):
                payload = payload.lstrip()[1:].lstrip()
            pending_bare = None
        merged.append((kind, payload))
    regions = {"1": [], "2": []}
    current = None
    for kind, payload in merged:
        if kind == "marker":
            current = payload
            continue
        if current:
            regions[current].append((kind, payload))
    return regions, {"1": bool(regions["1"]), "2": bool(regions["2"])}


def extract_prompt_and_visual(region_blocks):
    """Prompt = region text cut at the first sample-answer marker (joined-text
    matching, since the marker phrase can span separate text nodes)."""
    visual = None
    table = None
    extra_imgs = []
    text_pieces = []
    for kind, payload in region_blocks:
        if kind == "img":
            if visual is None:
                visual = payload
            elif payload != visual:
                extra_imgs.append(payload)
            continue
        if kind == "table":
            if table is None:
                table = parse_table(payload)
            continue
        if NAV_LINE.match(payload):
            continue
        text_pieces.append(payload)
    joined = norm(" ".join(text_pieces))
    sample_excluded = False
    truncated = False
    sm = SAMPLE_MARKERS.search(joined)
    if sm:
        pre = joined[:sm.start()].strip()
        if len(pre) >= 60:
            joined = pre
            sample_excluded = True
        else:
            joined = pre
            truncated = True
    return [{"text": joined}], visual, table, extra_imgs, sample_excluded, truncated


def load_page(slug_or_file):
    if slug_or_file.endswith(".html"):
        raw = open(os.path.join(SRC_ROOT, slug_or_file), "rb").read()
        path = slug_or_file
    else:
        raw = open(os.path.join(SRC_ROOT, slug_or_file, "index.html"), "rb").read()
        path = f"{slug_or_file}/index.html"
    return {"raw": raw, "path": path, "sha256": hashlib.sha256(raw).hexdigest()}


def page_inventory():
    """Every eligible Academic Writing source record with discovery metadata."""
    items = []
    for p in MANIFEST["page_inventory"]:
        if p.get("template") == "academic_writing_test":
            items.append({"slug": p["slug"], "loose": False, "hubEnumerated": p["slug"] in HUB_SLUGS,
                           "url": p.get("url_hint"), "manifestSha": p.get("sha256")})
    for p in MANIFEST["page_inventory"]:
        if p.get("template") == "test_page_loose_html" and p["slug"].startswith("ielts-writing-test-111"):
            items.append({"slug": p["slug"], "loose": True, "hubEnumerated": True,
                           "url": p.get("url_hint"), "manifestSha": p.get("sha256")})
    return sorted(items, key=lambda x: x["slug"])


def gt_inventory():
    """General Training letters page — inventoried only, never runtime."""
    path = os.path.join(SRC_ROOT, "ielts-general-writing-tasks-1-letters/index.html")
    soup = BeautifulSoup(open(path, encoding="utf-8", errors="replace").read(), "html.parser")
    ec = soup.find("div", class_="entry-content")
    text = norm_keep_nl(ec.get_text("\n"))
    prompts = re.split(r"\n(?=\d{1,3}\.\s)", text)
    prompts = [norm(p) for p in prompts if norm(p) and re.match(r"^\d{1,3}\.", norm(p))]
    return {"page": "ielts-general-writing-tasks-1-letters/index.html",
             "kind": "general_training_task1_letters",
             "promptCount": len(prompts),
             "prompts": prompts,
             "note": "GT Task 1 letters listed on a single page; excluded from the Academic runtime by design."}


def process(item):
    slug = item["slug"]
    test_number = int(re.search(r"(\d+)", slug).group(1))
    page = load_page(slug)
    raw_html = page["raw"].decode("utf-8", "replace")
    soup = BeautifulSoup(raw_html, "html.parser")
    ec = soup.find("div", class_="entry-content")
    rec = {
        "id": f"writing.test-{test_number:04d}.{content_hash(slug, page['sha256'])}",
        "module": "writing",
        "sourceNumbers": [test_number],
        "slug": slug,
        "title": f"IELTS Academic Writing Test {test_number}",
        "pipelineVersion": PIPELINE_VERSION,
        "provenance": {
            "page": {"path": page["path"], "sha256": page["sha256"],
                      "manifestHashMatch": page["sha256"] == item.get("manifestSha"), "url": item.get("url")},
            "extractionMethod": "deterministic_dom_v1.writing",
            "sourceRoot": SRC_ROOT,
        },
        "hubEnumerated": item["hubEnumerated"],
        "duplicateOf": None,
        "task1": None, "task2": None,
        "quarantinedUnits": [], "validationWarnings": [],
        "status": "verified",
    }
    if ec is None:
        rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "MALFORMED_HTML",
                                         "evidence": "entry-content missing"})
        rec["status"] = "quarantined"
        return rec

    # hard boundary at comments
    comments = ec.find(id="comments")
    if comments is not None:
        for el in [comments, *comments.find_next_siblings()]:
            el.decompose()
    for sel in ["script", "style", "ins", "iframe", "button", "form"]:
        for t in ec.find_all(sel):
            t.decompose()
    for t in ec.find_all("input", attrs={"type": "hidden"}):
        t.decompose()

    blocks = block_sequence(ec)
    regions, found = split_tasks(blocks)

    for task_num in ("1", "2"):
        if not found[task_num] or not regions[task_num]:
            rec["quarantinedUnits"].append({"unit": f"task{task_num}", "reasonCode": "TASK2_MISSING" if task_num == "2" else "EMPTY_PROMPT",
                                             "evidence": "no task marker/content found"})
            continue
        lines, img_url, table, extra_imgs, sample_excluded, truncated = \
            extract_prompt_and_visual(regions[task_num])
        if extra_imgs:
            rec["validationWarnings"].append({"unit": f"task{task_num}", "code": "EXTRA_IMGS_IGNORED",
                                               "detail": f"additional distinct images after the first were recorded, not used: {extra_imgs}"})
        prompt_text = norm(lines[0]["text"])
        if truncated and len(prompt_text) < 60:
            # the marker destroyed the prompt — ambiguous boundary
            rec["quarantinedUnits"].append({"unit": f"task{task_num}", "reasonCode": "SAMPLE_ANSWER_CONTAMINATION",
                                             "evidence": {"excerpt": prompt_text[:200]}})
        elif sample_excluded or truncated:
            rec["validationWarnings"].append({"unit": f"task{task_num}", "code": "SAMPLE_ANSWER_EXCLUDED",
                                               "detail": "A sample answer after the prompt was detected and excluded; the prompt itself is unaffected."})
        wl = WORD_LIMIT.search(prompt_text)
        word_limit = int(wl.group(1)) if wl else None
        task = {
            "taskNumber": int(task_num),
            "prompt": prompt_text,
            "wordLimitMin": word_limit,
            "provenance": {
                "rawExcerpt": prompt_text[:240],
                "regionBlocks": len(regions[task_num]),
            },
        }
        if task_num == "1":
            if img_url:
                rel = img_url.replace("../", "")
                if LITESPEED.search(rel):
                    base = LITESPEED.sub("", rel)
                    if os.path.exists(os.path.join(SRC_ROOT, base)):
                        rel = base
                meta = asset_meta(rel)
                task["visual"] = {
                    "assetId": f"asset.{meta['sha256'][:12]}" if meta.get("sha256") else None,
                    "sourcePath": rel,
                    "originalSrc": img_url,
                    **meta,
                    "sourceElementEvidence": f"img element within Task 1 region of {page['path']}",
                    "visualType": classify_visual(prompt_text),
                }
            elif table:
                task["table"] = {"rows": table,
                                  "visualType": "table"}
            # neither image nor table → missing visual (quarantine this task)
        rec[f"task{task_num}"] = task

    # status rollup
    if any(u["reasonCode"] in ("SAMPLE_ANSWER_CONTAMINATION", "MALFORMED_HTML") for u in rec["quarantinedUnits"]):
        rec["status"] = "quarantined"
    elif rec["quarantinedUnits"]:
        rec["status"] = "flagged"
    # completeness
    rec["completeness"] = {
        "task1": bool(rec.get("task1")) and not any(u["unit"] == "task1" for u in rec["quarantinedUnits"]),
        "task2": bool(rec.get("task2")) and not any(u["unit"] == "task2" for u in rec["quarantinedUnits"]),
    }
    rec["kind"] = "complete_test" if rec["completeness"]["task1"] and rec["completeness"]["task2"] else \
                  "task1_only" if rec["completeness"]["task1"] else \
                  "task2_only" if rec["completeness"]["task2"] else "empty"
    return rec


def main():
    import shutil
    for sub in ("writing/tests", "writing/quarantine", "reports"):
        p = os.path.join(OUT, sub)
        if os.path.exists(p): shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)

    items = page_inventory()
    records = [process(item) for item in items]

    # GT inventory (separate, never runtime)
    gt = gt_inventory()
    os.makedirs(os.path.join(OUT, "writing"), exist_ok=True)
    json.dump(gt, open(os.path.join(OUT, "writing", "gt_inventory.json"), "w"), indent=1, ensure_ascii=False)

    # duplicate detection by normalized prompt fingerprint
    import hashlib as _h
    fp_map = {}
    for r in records:
        t1 = norm(r["task1"]["prompt"]) if r.get("task1") else ""
        t2 = norm(r["task2"]["prompt"]) if r.get("task2") else ""
        if not t1 and not t2:
            r["contentFingerprint"] = None
            continue
        r["contentFingerprint"] = _h.sha256(f"{t1}\u241f{t2}".encode()).hexdigest()
        fp_map.setdefault(r["contentFingerprint"], []).append(r["slug"])
    for fp, slugs in fp_map.items():
        if len(slugs) > 1:
            canonical = sorted(slugs, key=lambda s: (s not in HUB_SLUGS, s))[0]
            for s in slugs:
                if s != canonical:
                    rec = next(r for r in records if r["slug"] == s)
                    rec["duplicateOf"] = canonical
                    rec["status"] = "duplicate"

    # emit
    from collections import Counter
    tally = Counter()
    visual_rows = []
    for r in records:
        with open(os.path.join(OUT, "writing", "tests", f"{r['slug']}.json"), "w") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
        if r["quarantinedUnits"]:
            with open(os.path.join(OUT, "writing", "quarantine", f"{r['slug']}.json"), "w") as f:
                json.dump({"slug": r["slug"], "units": r["quarantinedUnits"]}, f, indent=1, ensure_ascii=False)
        tally[r["status"]] += 1
        t1 = r.get("task1")
        if t1 and t1.get("visual"):
            visual_rows.append({"taskId": f"{r['id']}.task1", "prompt": t1["prompt"][:120],
                                 "visualType": t1["visual"]["visualType"], "sourcePath": t1["visual"]["sourcePath"],
                                 "sha256": t1["visual"].get("sha256"), "mimeType": t1["visual"].get("mimeType"),
                                 "width": t1["visual"].get("width"), "height": t1["visual"].get("height")})
    json.dump({"visuals": visual_rows}, open(os.path.join(OUT, "writing", "visuals.json"), "w"), indent=1, ensure_ascii=False)
    kind_tally = Counter(r["kind"] for r in records if r["status"] not in ("duplicate",))
    index = {
        "pipelineVersion": PIPELINE_VERSION,
        "tests": [{"slug": r["slug"], "id": r["id"], "status": r["status"], "kind": r["kind"],
                    "duplicateOf": r.get("duplicateOf")} for r in records],
        "tally": dict(tally), "kinds": dict(kind_tally),
        "gtInventory": {"promptCount": gt["promptCount"], "note": gt["note"]},
    }
    json.dump(index, open(os.path.join(OUT, "writing", "index.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"tally": dict(tally), "kinds": dict(kind_tally),
                       "visuals": len(visual_rows), "gt_prompts": gt["promptCount"]}, indent=1))

if __name__ == "__main__":
    main()
