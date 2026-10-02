#!/usr/bin/env python3
"""
Cognition — Phase 6: production Academic Reading extraction.

Corpus: `ielts-reading-test-*` directories + canonical loose `ielts-reading-test-111.html`
(+ duplicate-slug variants classified, GT inventoried separately).

Hierarchy: TEST → PASSAGE → QUESTION GROUP → QUESTION → ANSWER.
Deterministic; raw source read-only; assets COPIED into the project
(public/reading-assets/<sha256>.<ext>) with source-hash provenance.
"""
import json, os, re, hashlib, shutil, sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_listening import (  # noqa: E402
    SRC_ROOT, REPO, MANIFEST, norm, norm_keep_nl, content_hash,
    parse_answer_key, segment_with_blanks, parse_inline_mcq, parse_letter_pairs,
    rich_text, block_texts, INPUT_ROW, QITEM, LITESPEED,
)
from bs4 import BeautifulSoup, NavigableString, Tag  # noqa: E402
from PIL import Image  # noqa: E402

OUT = os.path.join(REPO, "content-db")
PUBLIC_ASSETS = os.path.join(REPO, "public", "reading-assets")
PIPELINE_VERSION = "production-reading-1.0.0"
HUB_READING = MANIFEST["hub_enumerations"]["academic_reading"]
HUB_SLUGS = {e["slug"] for e in HUB_READING}

GROUP_RE = re.compile(r"^\s*Questions?\s+(\d{1,2})(?:\s*[-–‑]\s*(\d{1,2}))?\s*[.:]?\s*(.*)$", re.I | re.S)
TFNG_RE = re.compile(r"(TRUE|FALSE|NOT GIVEN)", re.I)
YNNG_RE = re.compile(r"(YES|NO|NOT GIVEN)", re.I)
HEADINGS_RE = re.compile(r"(list of headings|heading\)?\s+(below|above)|choose the (most )?suitable heading)", re.I)
MATCH_INFO_RE = re.compile(r"(which paragraph contains|paragraph contains the following)", re.I)
MATCH_FEATURES_RE = re.compile(r"(match(each|ing)?.*(statement|feature|person|people|list)|Which of the following)", re.I)
MCQ_RE = re.compile(r"(choose the correct letter|circle the correct letter|Select the correct letter)", re.I)
COMPLETION_RE = re.compile(r"(complete the (sentences|summary|notes|table|form|flow ?chart|diagram|gaps)|using (NO MORE THAN|ONE|TWO|THREE|A WORD)|words? (AND|OR)?/? (A )?NUMBER)", re.I)
MATCH_BOX_RE = re.compile(r"(choose (TWO|THREE|FOUR|FIVE) (letters|answers)|from the box)", re.I)
WORD_LIMIT = re.compile(r"(NO MORE THAN\s+(?:\w+\s+)?(?:THREE|TWO|ONE|FOUR)\s+WORDS(?:\s+AND)?(?:\s*/?\s*OR)?(?:\s+AN?\s+NUMBER)?)|(?:ONE WORD(?:\s+ONLY)?(?:\s+OR\s+A\s+NUMBER)?)|(?:NO MORE THAN\s+.*?NUMBER)|(?:\bONE WORD AND/OR A NUMBER\b)", re.I)

@dataclass
class RQuestion:
    number: int
    qtype: str
    stem_plain: str = ""
    stem_segments: list = field(default_factory=list)
    options: list = field(default_factory=list)
    raw_excerpt: str = ""
    element_path: str = ""

@dataclass
class RGroup:
    group_id: str
    start_q: int
    end_q: int
    instruction_raw: str = ""
    word_limit: str = ""
    qtype: str = "unknown"
    stimulus_segments: list = field(default_factory=list)
    shared_options: list = field(default_factory=list)
    figure_srcs: list = field(default_factory=list)
    questions: list = field(default_factory=list)
    raw_excerpt: str = ""
    element_path: str = ""

@dataclass
class Passage:
    number: int
    title: str = ""
    paragraphs: list = field(default_factory=list)
    groups: list = field(default_factory=list)


def looks_like_instruction(text):
    return bool(re.search(r"Complete (the|your)|Choose (the correct|from|TWO|THREE|FOUR|FIVE)|Label |Write |Look at|next to questions|from the box|Circle the|Answer the following|Decide which|Do the following statements|Which paragraph|questions \d+ (and|[-–])|Tick|match each", text, re.I))


def classify_group(instruction):
    t = instruction.lower()
    if TFNG_RE.search(t) and re.search(r"true\s*/?\s*false|false not given|not given", t):
        return "tfng"
    if YNNG_RE.search(t) and re.search(r"yes\s*/?\s*no|no not given", t):
        return "ynng"
    if HEADINGS_RE.search(t):
        return "matching_headings"
    if MATCH_INFO_RE.search(t):
        return "matching_information"
    if MATCH_BOX_RE.search(t) and not MCQ_RE.search(t):
        return "matching_box"
    if MCQ_RE.search(t):
        return "mcq_single"
    if re.search(r"which of the following|matches", t):
        return "matching_features"
    if COMPLETION_RE.search(t):
        if re.search(r"table", t): return "table_completion"
        if re.search(r"summary", t): return "summary_completion"
        if re.search(r"notes", t): return "note_completion"
        if re.search(r"flow ?chart", t): return "flow_chart_completion"
        if re.search(r"sentence", t): return "sentence_completion"
        return "completion"
    if re.search(r"answer the following|what|why|how", t) and re.search(r"questions?", t):
        return "short_answer"
    return "unknown"


def strip_glyph(s):
    return norm((s or "").replace("\u2426", " "))


def loose_item(line):
    """Reading statements use "N text" (often without the dot). Returns (num, rest).
    Bare option letters ("F" alone or "F " with tiny rest) are NOT questions."""
    m = re.match(r"^\s*(\d{1,2})\s+(.*)$", line)
    if not m:
        m2 = QITEM.match(line)
        if m2: return int(m2.group(1)), m2.group(2)
        return None
    rest = m.group(2).strip()
    if len(rest) < 3:
        return None
    return int(m.group(1)), rest


def extract_groups_and_prose(ec):
    """Single-pass segmentation: prose paragraphs and bold titles open passage
    segments; question-group regions attach to the passage whose prose precedes
    them. A long paragraph (>280 chars) after group content starts the next
    passage. Every finished segment is appended immediately."""
    items = []
    for idx, (el, text) in enumerate(block_texts(ec)):
        path = f"children[{idx}]"
        if text == "__AUDIO__":
            continue
        if text.startswith("__FIGURE__"):
            fig = text.split(" ", 1)[1] if " " in text else ""
            if fig: items.append(("img", fig.replace("../", ""), path, None))
            continue
        if text == "__TABLE__":
            items.append(("table", el, path, None)); continue
        items.append(("text", text, path, el))

    segments = []
    def new_segment(title=""):
        return {"title": title, "paragraphs": [], "groups": []}
    current = new_segment()
    current_group = None


    def start_segment(title=""):
        nonlocal current, current_group
        if current["title"] or current["paragraphs"] or current["groups"]:
            segments.append(current)
        current = new_segment(title)
        current_group = None

    def flush_text_into(buf_text, el, path):
        nonlocal current, current_group
        is_bold = False
        if el is not None:
            if el.name in ("h1", "h2", "h3", "h4", "h5", "h6") and norm(el.get_text()) == buf_text:
                is_bold = True
            else:
                strong = el.find(["b", "strong"])
                if strong and norm(strong.get_text()) == buf_text and len(buf_text) <= 90:
                    is_bold = True
        m = GROUP_RE.match(buf_text)
        if m and (looks_like_instruction(buf_text) or norm(m.group(3) or "") == "" or is_bold):
            g = RGroup(group_id=f"g{sum(len(s['groups']) for s in segments)+len(current['groups'])+1:02d}",
                        start_q=int(m.group(1)), end_q=int(m.group(2) or m.group(1)),
                        instruction_raw=norm(m.group(3) or ""), element_path=path, raw_excerpt=buf_text[:220])
            # classification peeks ahead: YES/NO|TRUE/FALSE|headings lines may follow
            my_idx2 = next(i for i, it in enumerate(items) if it[2] == path)
            peek = " ".join(p for k, p, _, _ in items[my_idx2+1:my_idx2+3] if k == "text")[:400]
            g.qtype = classify_group(g.instruction_raw + " " + (m.group(0) or "") + " " + peek)
            wl = WORD_LIMIT.search(buf_text + " " + peek)
            if wl and wl.group(1): g.word_limit = norm(wl.group(1))
            current["groups"].append(g)
            current_group = g
            return
        if is_bold and current_group is not None:
            # lookahead: a passage title is followed by long prose; a summary/table
            # heading is followed by group content (numbered items, blanks, options)
            my_idx = next(i for i, it in enumerate(items) if it[2] == path)
            lookahead = items[my_idx+1:my_idx+5]
            # prose = substantial text with NO blank markers and NO group marker —
            # distinguishes a passage body from a summary heading with blanks
            followed_by_prose = any(
                k == "text" and len(p) >= 150 and not re.search(r"\(\d{1,2}\)", p)
                and not GROUP_RE.match(p)
                for k, p, _, _ in lookahead)
            if followed_by_prose:
                start_segment(title=buf_text)
                return
            current_group.stimulus_segments.append(buf_text)
            return
        is_long_prose = len(buf_text) > 280
        if current_group is None:
            if not current["title"] and len(buf_text) <= 90 and not current["paragraphs"]:
                current["title"] = buf_text
            else:
                current["paragraphs"].append(buf_text)
            return
        g = current_group
        if not handle_group_content(g, buf_text, path):
            # not group content: long prose = next passage body; short = instruction
            if is_long_prose:
                start_segment()
                current["paragraphs"].append(buf_text)
            else:
                g.instruction_raw = (g.instruction_raw + " " + buf_text).strip()
                g.raw_excerpt = (g.raw_excerpt + " " + buf_text)[:300]

    for kind, payload, path, el in items:
        if kind == "img":
            if current_group is not None:
                current_group.figure_srcs.append(payload)
            else:
                if current is None: current = new_segment()
                current["paragraphs"].append(f"[img:{payload}]")
            continue
        if kind == "table":
            if current_group is not None:
                rows = []
                for tr in payload.find_all("tr"):
                    cells = [norm(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
                    if any(cells): rows.append(cells)
                current_group.stimulus_segments.append("__TABLE__" + json.dumps(rows, ensure_ascii=False))
            else:
                if current is None: current = new_segment()
                current["paragraphs"].append(" ".join(norm(td.get_text(" ")) for tr in payload.find_all("tr") for td in tr.find_all(["td", "th"])))
            continue
        flush_text_into(payload, el, path)

    if current["title"] or current["paragraphs"] or current["groups"]:
        segments.append(current)
    return [g for s in segments for g in s["groups"]], segments


def handle_group_content(g, text, path):
    """Returns True if the block was consumed as group content."""
    t = g.qtype
    # MCQ: inline options or letter lines
    if t == "mcq_single":
        consumed = False
        plain = text.strip()
        if "\n" not in plain and not QITEM.match(plain) and not re.match(r"^[A-J]\s", plain) and len(plain) < 220:
            # singular-question stem (e.g. "What is the writer's purpose…?")
            g.stimulus_segments.append(plain)
            return True
        for line in [l.strip() for l in text.split("\n") if l.strip()]:
            if QITEM.match(line) and not re.match(r"^[A-J]\s", line):
                mcq = parse_inline_mcq(line)
                if mcq:
                    number, stem, options = mcq
                    g.questions.append(RQuestion(number=number, qtype="mcq_single", stem_plain=stem,
                                                  options=options, raw_excerpt=line, element_path=path))
                else:
                    qm = QITEM.match(line)
                    g.questions.append(RQuestion(number=int(qm.group(1)), qtype="mcq_single",
                                                  stem_plain=strip_glyph(qm.group(2)), raw_excerpt=line, element_path=path))
                consumed = True
            elif re.match(r"^[A-J]\s*($|\s+\S)", line) and len(line) < 120:
                lm = re.match(r"^([A-J])\s*(.*)$", line)
                if g.questions and not g.questions[-1].options:
                    g.questions[-1].options.append({"letter": lm.group(1), "text": norm(lm.group(2))})
                consumed = True
        if consumed: return True
    # statements (TFNG / YNNG / matching_information): numbered statement lines
    if t in ("tfng", "ynng", "matching_information"):
        added = False
        for line in text.split("\n"):
            item = loose_item(line.strip())
            if item and item[0] <= g.end_q:
                g.questions.append(RQuestion(number=item[0], qtype=t,
                                              stem_plain=strip_glyph(item[1]), raw_excerpt=line.strip(),
                                              element_path=path))
                added = True
        if added: return True
    # matching headings / features / box: numbered stems + shared options list
    if t in ("matching_headings", "matching_features", "matching_box"):
        pairs = parse_letter_pairs(text) if re.search(r"\b[A-J]\b", text) else None
        if pairs and not QITEM.match(text):
            g.shared_options.extend(pairs)
            return True
        added = False
        for line in text.split("\n"):
            item = loose_item(line.strip())
            if item and item[0] <= g.end_q:
                g.questions.append(RQuestion(number=item[0], qtype=t,
                                              stem_plain=strip_glyph(item[1]), raw_excerpt=line.strip(),
                                              element_path=path))
                added = True
        if added: return True
        # heading list items (roman numerals or lettered headings)
        if re.match(r"^[ivx]+\s", text.strip(), re.I) or re.match(r"^[A-J]\s", text.strip()):
            g.shared_options.append({"letter": text.strip()[:6], "text": strip_glyph(text.strip()[6:] if len(text.strip()) > 6 else text.strip())})
            return True
    # completion / short answer: blanks or numbered lines
    if t in ("summary_completion", "table_completion", "note_completion", "completion",
              "flow_chart_completion", "sentence_completion"):
        # lettered word lists (A xxx / B xxx) after the summary heading
        if not QITEM.match(text) and not re.search(r"\(\d{1,2}\)", text):
            pairs = parse_letter_pairs(text)
            if pairs:
                g.shared_options.extend(pairs)
                return True
    blanks_here = [int(mm.group(1)) for mm in re.finditer(r"\((\d{1,2})\)", text)]
    if blanks_here:
        for line in text.split("\n"):
            line = line.strip()
            lb = [int(mm.group(1)) for mm in re.finditer(r"\((\d{1,2})\)", line)]
            if not lb:
                g.stimulus_segments.append(line)
                continue
            for n in lb:
                if any(x.number == n for x in g.questions): continue
                q = RQuestion(number=n, qtype="completion",
                               raw_excerpt=line, element_path=path)
                q.stem_segments = segment_with_blanks(line)
                q.stem_plain = norm(re.sub(r"[.…·]{2,}", " ______ ", line.replace("\u2426", " ")))
                g.questions.append(q)
        return True
    if QITEM.match(text) and any(int(QITEM.match(l.strip()).group(1)) <= g.end_q
                                  for l in text.split("\n") if QITEM.match(l.strip())):
        added = False
        for line in text.split("\n"):
            qm = QITEM.match(line.strip())
            if qm and g.start_q <= int(qm.group(1)) <= g.end_q:
                if any(x.number == int(qm.group(1)) for x in g.questions): continue
                g.questions.append(RQuestion(number=int(qm.group(1)), qtype="short_answer",
                                              stem_plain=strip_glyph(qm.group(2)), raw_excerpt=line.strip(),
                                              element_path=path))
                added = True
        if added: return True
    # table stimulus for table_completion
    if t in ("table_completion", "summary_completion", "note_completion") and text.startswith("__TABLE__"):
        g.stimulus_segments.append(text)
        return True
    # instruction continuation / stimulus
    if looks_like_instruction(text) or len(text) < 200:
        g.instruction_raw = (g.instruction_raw + " " + text).strip()
        wl = WORD_LIMIT.search(text)
        if wl and not g.word_limit: g.word_limit = norm(wl.group(1))
        g.raw_excerpt = (g.raw_excerpt + " " + text)[:300]
        return True
    g.stimulus_segments.append(text)
    return True


def is_bold_title(block_text, el):
    """A passage title candidate: bold markup, short, not a group marker."""
    if GROUP_RE.match(block_text): return False
    if len(block_text) > 90 or "\n" in block_text: return False
    strong = el.find(["b", "strong"])
    if strong and norm(strong.get_text()) == block_text: return True
    return False


def main():
    import shutil
    for sub in ("reading/tests", "reading/quarantine", "reports"):
        p = os.path.join(OUT, sub)
        if os.path.exists(p): shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)
    os.makedirs(PUBLIC_ASSETS, exist_ok=True)

    slugs = sorted(p["slug"] for p in MANIFEST["page_inventory"]
                    if p.get("template") == "academic_reading_test")
    slugs += ["ielts-reading-test-111.html"]
    records = []
    for slug in slugs:
        try:
            records.append(process(slug))
        except Exception as e:
            records.append({"slug": slug, "status": "quarantined", "kind": "empty",
                             "quarantinedUnits": [{"unit": "test", "reasonCode": "EXTRACTION_CRASH",
                                                    "evidence": repr(e)[:240]}], "error": repr(e)[:240]})
    # duplicates by passage+question fingerprint
    fp_map = {}
    for r in records:
        t1 = json.dumps(r.get("passages", []), sort_keys=True, ensure_ascii=False)
        if not r.get("passages"):
            r["contentFingerprint"] = None; continue
        r["contentFingerprint"] = hashlib.sha256(t1.encode()).hexdigest()
        fp_map.setdefault(r["contentFingerprint"], []).append(r["slug"])
    for fp, sl in fp_map.items():
        if len(sl) > 1:
            canonical = sorted(sl, key=lambda s: (s not in HUB_SLUGS, s))[0]
            for s in sl:
                if s != canonical:
                    rec = next(r for r in records if r["slug"] == s)
                    rec["duplicateOf"] = canonical; rec["status"] = "duplicate"

    tally = {}
    rows = []
    for r in records:
        r.pop("_groups", None)
        json.dump(r, open(os.path.join(OUT, "reading", "tests", f"{r['slug']}.json"), "w"), indent=1, ensure_ascii=False, default=str)
        if r["quarantinedUnits"]:
            json.dump({"slug": r["slug"], "units": r["quarantinedUnits"]},
                       open(os.path.join(OUT, "reading", "quarantine", f"{r['slug']}.json"), "w"), indent=1, ensure_ascii=False)
        tally[r["status"]] = tally.get(r["status"], 0) + 1
        rows.append({"slug": r["slug"], "id": r.get("id"), "status": r["status"], "kind": r.get("kind"),
                      "passages": len(r.get("passages", [])), "duplicateOf": r.get("duplicateOf")})
    json.dump({"pipelineVersion": PIPELINE_VERSION, "tests": rows, "tally": tally},
               open(os.path.join(OUT, "reading", "index.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"tally": tally,
                       "passages_total": sum(r.get("passages") and len(r["passages"]) or 0 for r in records),
                       "groups_total": sum(len(g) for r in records for g in [r.get("_groups", [])]) or "see records",
                       }, indent=1))

def process(slug):
    from extract_listening import load_page as listening_load
    is_loose = slug.endswith(".html")
    if is_loose:
        raw = open(os.path.join(SRC_ROOT, slug), "rb").read()
        page_path = slug
        meta = next((p for p in MANIFEST["page_inventory"] if p["slug"] == slug), {})
    else:
        raw = open(os.path.join(SRC_ROOT, slug, "index.html"), "rb").read()
        page_path = f"{slug}/index.html"
        meta = next((p for p in MANIFEST["page_inventory"] if p["slug"] == slug), {})
    page_sha = hashlib.sha256(raw).hexdigest()
    test_number = int(re.search(r"(\d+)", slug).group(1))
    html = raw.decode("utf-8", "replace")
    soup = BeautifulSoup(html, "html.parser")
    ec = soup.find("div", class_="entry-content")
    rec = {
        "id": f"reading.test-{test_number:04d}.{content_hash(slug, page_sha)}",
        "module": "reading", "sourceNumbers": [test_number], "slug": slug,
        "title": f"IELTS Academic Reading Test {test_number}", "kind": "full_test",
        "pipelineVersion": PIPELINE_VERSION,
        "provenance": {"page": {"path": page_path, "sha256": page_sha,
                                 "manifestHashMatch": page_sha == meta.get("sha256"), "url": meta.get("url_hint")},
                        "extractionMethod": "deterministic_dom_v1.reading"},
        "hubEnumerated": slug in HUB_SLUGS or is_loose,
        "duplicateOf": None,
        "passages": [], "answerKey": {"items": []},
        "quarantinedUnits": [], "validationWarnings": [],
        "status": "verified",
    }
    if ec is None:
        rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "MALFORMED_HTML", "evidence": "entry-content missing"})
        rec["status"] = "quarantined"
        return rec
    comments = ec.find(id="comments")
    if comments is not None:
        for el in [comments, *comments.find_next_siblings()]:
            el.decompose()
    for sel in ["script", "style", "ins", "iframe", "button", "form"]:
        for t in ec.find_all(sel): t.decompose()
    for t in ec.find_all("input", attrs={"type": "hidden"}): t.decompose()

    key = parse_answer_key(BeautifulSoup(html, "html.parser"))
    key_items = (key or {}).get("items") or (key or {}).get("items_so_far") or []
    rec["answerKey"] = {"keyStart": (key or {}).get("keyStart"), "keyEnd": (key or {}).get("keyEnd"),
                         "trailingEmpty": (key or {}).get("trailing_empty"), "error": (key or {}).get("error"),
                         "keyFormat": (key or {}).get("keyFormat", "numbered"),
                         "items": [{"number": n, "value": v} for n, v in key_items]}

    groups, segments = extract_groups_and_prose(ec)
    # Passage assignment by official Academic structure: P1 Q1-13, P2 Q14-26,
    # P3 Q27+. Prose segments attach to the passage of the groups they precede
    # (document order); a segment's prose belongs to the NEXT group's passage
    # when it precedes any group, else to the previous group's passage.
    def passage_of(num):
        return 1 if num <= 13 else 2 if num <= 26 else 3
    passages = [Passage(number=1), Passage(number=2), Passage(number=3)]
    sorted_groups = sorted(groups, key=lambda g: g.start_q)
    # passage of each segment: its own first group's passage; ungrouped segments
    # take the NEXT grouped segment's passage (prose precedes its questions);
    # trailing ungrouped segments take the last grouped segment's passage
    seg_passage = []
    for s in segments:
        seg_passage.append(passage_of(min(g.start_q for g in s["groups"])) if s["groups"] else None)
    first_grouped = next((i for i, v in enumerate(seg_passage) if v is not None), None)
    last_grouped = max((i for i, v in enumerate(seg_passage) if v is not None), default=None)
    for i, v in enumerate(seg_passage):
        if v is None:
            if first_grouped is None or i < first_grouped:
                seg_passage[i] = 1
            elif i > last_grouped:
                seg_passage[i] = seg_passage[last_grouped]
            else:
                nxt = next(j for j in range(i, len(seg_passage)) if seg_passage[j] is not None)
                seg_passage[i] = seg_passage[nxt]
    for s, target in zip(segments, seg_passage):
        if s["title"]:
            passages[target - 1].title = s["title"]
        passages[target - 1].paragraphs.extend(s["paragraphs"])
    for g in sorted_groups:
        passages[passage_of(g.start_q) - 1].groups.append(g)
    rec["segmentCount"] = len(segments)

    # assets: copy images into the project (dedupe by sha), attach per passage
    seen_assets = {}
    for p in passages:
        p.assets = []
        new_paras = []
        for para in p.paragraphs:
            m = re.match(r"\[img:(.+)\]", para)
            if m:
                rel = m.group(1)
                if LITESPEED.search(rel):
                    base = LITESPEED.sub("", rel)
                    if os.path.exists(os.path.join(SRC_ROOT, base)): rel = base
                if rel in seen_assets:
                    new_paras.append(f"[asset:{seen_assets[rel]['assetId']}]")
                    continue
                src_file = os.path.join(SRC_ROOT, rel)
                if not os.path.exists(src_file):
                    rec["quarantinedUnits"].append({"unit": "asset", "reasonCode": "ASSET_MISSING",
                                                     "evidence": rel})
                    new_paras.append(f"[asset-missing:{rel}]")
                    continue
                data = open(src_file, "rb").read()
                sha = hashlib.sha256(data).hexdigest()
                ext = os.path.splitext(rel)[1].lower() or ".png"
                mime = "image/webp" if ext == ".webp" else "image/png" if ext == ".png" else "image/jpeg" if ext in (".jpg", ".jpeg") else "image/gif"
                asset_id = f"asset.{sha[:12]}"
                dest = os.path.join(PUBLIC_ASSETS, f"{sha}{ext}")
                if not os.path.exists(dest):
                    shutil.copyfile(src_file, dest)
                width = height = None
                try:
                    with Image.open(dest) as im: width, height = im.size
                except Exception: pass
                asset = {"assetId": asset_id, "sourcePath": rel, "projectPath": f"/reading-assets/{sha}{ext}",
                          "sha256": sha, "mimeType": mime, "bytes": len(data), "width": width, "height": height,
                          "association": f"image element within passage {p.number} of {page_path}"}
                seen_assets[rel] = asset
                p.assets.append(asset)
                new_paras.append(f"[asset:{asset_id}]")
            else:
                new_paras.append(para)
        p.paragraphs = new_paras

    rec["passages"] = [passage_to_dict(p) for p in passages]
    rec["_groups"] = groups
    # ── recursive reconciliation: dedupe, range-clamp, drop unverifiable groups ──
    seen_nums = set()
    for p in rec["passages"]:
        kept_groups = []
        for g in p["questionGroups"]:
            lo, hi = g["startQ"], g["endQ"]
            dedup, local_seen = [], set()
            for q in g["questions"]:
                n = q["number"]
                if n in seen_nums or n in local_seen or n < lo or n > hi + 2:
                    continue
                local_seen.add(n); seen_nums.add(n)
                dedup.append(q)
            g["questions"] = sorted(dedup, key=lambda q: q["number"])
            expected = hi - lo + 1
            got = len(g["questions"])
            # degenerate stems (bare option letters) are dropped per-question
            before_dedup = got
            g["questions"] = [q for q in g["questions"]
                               if len((q.get("stem") or {}).get("plain") or "") >= 4
                               or (q.get("stem") or {}).get("segments")]
            got = len(g["questions"])
            dropped = before_dedup - got
            if dropped:
                rec["validationWarnings"].append({"unit": "group", "code": "DEGENERATE_STEMS_DROPPED",
                                                   "detail": f"{dropped} bare-letter questions dropped in {g['groupId']}"})
            if got == 0:
                rec["quarantinedUnits"].append({"unit": "group", "reasonCode": "EMPTY_QUESTION",
                                                 "evidence": {"group": g["groupId"], "range": [lo, hi],
                                                               "instruction": g["instruction"][:120]}})
                continue
            if got != expected:
                rec["quarantinedUnits"].append({"unit": "group", "reasonCode": "QUESTION_COUNT_MISMATCH",
                                                 "evidence": {"group": g["groupId"], "range": [lo, hi],
                                                               "extracted": got, "expected": expected}})
                if got < expected * 0.5:
                    continue
            if g["qtype"] in ("unknown",):
                rec["quarantinedUnits"].append({"unit": "group", "reasonCode": "QUESTION_GROUP_AMBIGUOUS",
                                                 "evidence": {"group": g["groupId"], "range": [lo, hi],
                                                               "instruction": g["instruction"][:140]}})
                continue
            kept_groups.append(g)
        p["questionGroups"] = kept_groups

    # answer mapping (after reconciliation)
    key_map = dict((n, v) for n, v in key_items)
    for p in rec["passages"]:
        for g in p["questionGroups"]:
            for q in g["questions"]:
                q["correctAnswer"] = key_map.get(q["number"])
                q["answerFound"] = q["number"] in key_map

    # empty-prose passages = ambiguous passage boundaries → quarantine the test
    for p in rec["passages"]:
        if not p["paragraphs"]:
            rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "PASSAGE_BOUNDARY_AMBIGUOUS",
                                             "evidence": {"passage": p["passageNumber"],
                                                           "title": p["title"],
                                                           "groups": [(g["startQ"], g["endQ"]) for g in p["questionGroups"]]}})
            break

    # status rollup
    if not rec["passages"] or all(not p["paragraphs"] for p in rec["passages"]):
        rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "EMPTY_PASSAGE", "evidence": "no passage text"})
    total_q = sum(len(g["questions"]) for p in rec["passages"] for g in p["questionGroups"])
    if key_items and total_q and abs(total_q - len(key_items)) > 2:
        rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "ANSWER_COUNT_MISMATCH",
                                         "evidence": {"questions": total_q, "answers": len(key_items)}})
    if any(u["reasonCode"] in ("EMPTY_PASSAGE", "MALFORMED_HTML", "PASSAGE_BOUNDARY_AMBIGUOUS") for u in rec["quarantinedUnits"]) or total_q == 0:
        rec["status"] = "quarantined"
    elif rec["quarantinedUnits"]:
        rec["status"] = "flagged"
    total_passages = sum(1 for p in rec["passages"] if p["paragraphs"])
    total_ans = sum(1 for p in rec["passages"] for g in p["questionGroups"] for q in g["questions"] if q["answerFound"])
    if total_q >= 40 and total_ans >= 40 and total_passages >= 3:
        rec["kind"] = "full_test"
    elif total_q >= 5 and total_ans >= total_q * 0.8:
        rec["kind"] = "practice_test"
    else:
        rec["kind"] = "empty"
    return rec


def _next_boundary(passages, groups, p_idx):
    """Approximate question boundary between passages: divide 40ish questions evenly
    across the expected passage count from title signals — overridden by explicit
    group-to-passage assignment checks in validation."""
    remaining = len(passages) - p_idx
    return (p_idx + 1) * 13 + (5 if p_idx >= 1 else 0)


def passage_to_dict(p):
    return {
        "passageNumber": p.number,
        "title": p.title or f"Passage {p.number}",
        "paragraphs": p.paragraphs,
        "assets": p.assets,
        "questionGroups": [{
            "groupId": g.group_id,
            "instruction": g.instruction_raw,
            "wordLimit": g.word_limit,
            "qtype": g.qtype,
            "startQ": g.start_q, "endQ": g.end_q,
            "stimulusSegments": g.stimulus_segments or None,
            "sharedOptions": g.shared_options or None,
            "figures": g.figure_srcs or None,
            "questions": [{
                "number": q.number, "type": q.qtype,
                "stem": {"plain": q.stem_plain, "segments": q.stem_segments or None},
                "options": q.options or None,
                "correctAnswer": None, "answerFound": False,
                "provenance": {"rawExcerpt": q.raw_excerpt[:200], "elementPath": q.element_path},
            } for q in g.questions],
            "provenance": {"elementPath": g.element_path, "rawExcerpt": g.raw_excerpt[:240]},
        } for g in p.groups],
    }


if __name__ == "__main__":
    main()
