#!/usr/bin/env python3
"""
Cognition — production Academic Reading extraction (v2).

Source: WordPress pages under SRC_ROOT (`ielts-reading-test-N/index.html` +
the canonical loose `ielts-reading-test-111.html`). Every page is a flat
`div.entry-content` of <p>/<h*>/<figure>/<table> blocks whose lines are
separated by <br>; structure is carried by bold runs (<strong>/<b>):
passage titles, "Questions N-M" headers, TRUE/FALSE legends and option
letters. The extractor linearises that DOM into annotated lines and parses
each question group against an explicit per-type contract.

Hierarchy: TEST → PASSAGE → QUESTION GROUP → QUESTION → OFFICIAL ANSWER.

Rules (non-negotiable):
  * deterministic — output is a pure function of (source bytes, this file,
    the R2 media manifest); no network, no LLM;
  * never fabricate — a stem, option, blank or answer that is not present in
    the source is never invented; anything that cannot be represented
    unambiguously is QUARANTINED with reason codes and its full parsed
    content + raw source lines are kept for investigation;
  * the answer key is authoritative — a group whose key is missing or is
    incompatible with the group's structure (e.g. a word answer for a
    TRUE/FALSE question, a letter outside the option pool) is quarantined;
  * media must already exist in R2 (content-db/media_manifest.json); a group
    that depends on an image R2 does not hold is quarantined
    (MEDIA_NOT_IN_R2) and the image is listed in media-pending.json.

Outputs (content-db/reading/):
  tests/<slug>.json      one record per source page (all content, statuses)
  quarantine/<slug>.json quarantined units with reason codes + provenance
  quality-audit.json     one record per question group (status, reasons)
  media-pending.json     source images needed by quarantined groups
  index.json             manifest + exact reconciliation tallies
"""
import hashlib
import json
import os
import re
import shutil
import sys
from collections import Counter

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

SRC_ROOT = os.environ.get("COGNITION_SRC_ROOT", "/Users/arunyagoojar/Downloads/ielts-website")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "content-db", "reading")
MANIFEST = json.load(open(os.path.join(REPO, "docs/phase1/SOURCE_MANIFEST.json")))
MEDIA_MANIFEST = json.load(open(os.path.join(REPO, "content-db/media_manifest.json")))
PIPELINE_VERSION = "production-reading-2.0.0"

HUB_SLUGS = {e["slug"] for e in MANIFEST["hub_enumerations"]["academic_reading"]}
PAGE_BY_SLUG = {p["slug"]: p for p in MANIFEST["page_inventory"]}
R2_READING = {m["sha256"]: m for m in MEDIA_MANIFEST["media"] if m["kind"] == "images/reading"}
_ID_MAP_PATH = os.path.join(OUT, "id-map.json")
# Record ids are frozen: stored attempts reference them, and a re-download of
# the source mirror changes page bytes (cache timestamps) without changing content.
FROZEN_IDS = json.load(open(_ID_MAP_PATH))["ids"] if os.path.exists(_ID_MAP_PATH) else {}

# ───────────────────────────────────────────────────────────── vocabulary
# Question types (the runtime contract enumerates exactly these).
QTYPES = (
    "tfng", "ynng", "mcq_single", "mcq_multi",
    "matching_headings", "matching_information", "matching_features", "sentence_endings",
    "summary_completion", "note_completion", "table_completion", "flow_chart_completion",
    "sentence_completion", "diagram_completion", "short_answer",
)
# answerControl → how the candidate answers (renderer dispatches on this).
CONTROL = {
    "tfng": "tfng", "ynng": "ynng", "mcq_single": "single_choice", "mcq_multi": "multi_choice",
    "matching_headings": "pool_select", "matching_information": "pool_select",
    "matching_features": "pool_select", "sentence_endings": "pool_select",
    "short_answer": "text", "sentence_completion": "text", "diagram_completion": "text",
    # completion types: "text" (words from the passage) or "pool_select" (word bank)
}
TFNG_CANON = {"true": "TRUE", "t": "TRUE", "false": "FALSE", "f": "FALSE",
              "not given": "NOT GIVEN", "ng": "NOT GIVEN", "notgiven": "NOT GIVEN", "not-given": "NOT GIVEN"}
YNNG_CANON = {"yes": "YES", "y": "YES", "no": "NO", "n": "NO",
              "not given": "NOT GIVEN", "ng": "NOT GIVEN", "notgiven": "NOT GIVEN", "not-given": "NOT GIVEN"}
COUNT_WORDS = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"]
LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
                "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}

# ───────────────────────────────────────────────────────────── regexes
HEADER_RE = re.compile(
    r"^\s*Questions?\s+(\d{1,2})(?:\s*(?:[-–—‑−]|to|and|&)\s*(\d{1,2}))?\s*[.:]?\s*(.*)$", re.I | re.S)
LEADER = r"(?:[.…·_]\s?){3,}|…+|_{2,}"
LEADER_RE = re.compile(LEADER)
PAREN_BLANK_RE = re.compile(r"\(\s*(\d{1,2})\s*\)\s*(?:" + LEADER + r")?")
NUM_LEADER_RE = re.compile(r"(?<![\d.,])\b(\d{1,2})\s*[.)]?\s*(?:" + LEADER + r")")
LEADER_PAREN_RE = re.compile(r"(?:" + LEADER + r")\s*\(\s*(\d{1,2})\s*\)")
QNUM_RE = re.compile(r"^\s*(\d{1,2})\s*[.):]?\s+(\S.*)$|^\s*(\d{1,2})[.)](\S.*)$", re.S)
LEGEND_RE = re.compile(r"^\s*(TRUE|FALSE|NOT GIVEN|YES|NO)\b\s*[:\-–]?\s*(if|when|=|–|-|:)", re.I)
EXAMPLE_RE = re.compile(r"^\s*(Example|e\.g\.|Answer\s*:)", re.I)
ROMAN_OPT_RE = re.compile(r"^\s*\(?(x{0,1}(?:ix|iv|v?i{0,3}))\)?\s*[.):]?\s+(\S.*)$")
LETTER_OPT_RE = re.compile(r"^\s*\(?([A-Z])\)?\s*[.):]\s*(\S.*)$|^\s*([A-Z])\s+(\S.*)$", re.S)
POOL_TITLE_RE = re.compile(r"^(list of [\w ,/-]{2,40}|[A-Z][\w ’'/-]{1,40})$", re.I)
INSTRUCTION_VERB_RE = re.compile(
    r"^\s*(Write|Choose|Complete|Use|Look at|Match|Classify|Answer|Do the following|In boxes|NB|N\.B|"
    r"You may|Reading Passage|The reading passage|The passage|The text|Which|Label|Decide|Select|Read|"
    r"Find|From the list|Using|For each|Questions? \d|There are more)", re.I)
JUNK_RE = re.compile(
    r"^(Cambridge IELTS\s+(?:Tests?|Books?)?\s*\d+\s*(?:to|-|–)\s*\d+|Show Answers?|Advertisement|"
    r"(?:Also\s+)?Read (?:more|also)\b.*|Click here\b.*|Download\b.*|Join\b.*|Subscribe\b.*)\s*$", re.I)
PASSAGE_MARKER_RE = re.compile(
    r"^\s*(?:(?:READING\s+)?PASSAGE\s*([123]|ONE|TWO|THREE)\s*[:.\-–]?\s*$|SECTION\s*([123])\s*$|"
    r"You should spend about \d+ minutes on Questions? \d+.*?Reading Passage\s*([123]).*)$", re.I | re.S)
PASSAGE_REF_RE = re.compile(r"\bReading Passage\s*([123])\b", re.I)
ARTIFACT_RE = re.compile(r"(Show Answers|Cambridge IELTS Tests?|\[IMG|<[a-z/][^>]*>|&[a-z]+;|␦|�|bg-showmore)", re.I)
# numbered answer blanks — never legitimate inside passage prose
PASSAGE_BLANK_RE = re.compile(r"\(\s*\d{1,2}\s*\)\s*(?:[.…_]\s?){2,}|(?:[.…_]\s?){2,}\s*\(\s*\d{1,2}\s*\)|(?:[.…]\s?){5,}|…{3,}|_{5,}")
WORD_LIMIT_RE = re.compile(
    r"(NO MORE THAN\s+(?:\w+\s+)?(?:ONE|TWO|THREE|FOUR|\d)\s+WORDS?(?:\s*(?:AND|/|OR|AND/OR)+\s*(?:AN?\s+)?NUMBERS?)?"
    r"|ONE WORD(?:\s+ONLY)?(?:\s*(?:AND|/|OR|AND/OR)+\s*(?:AN?\s+)?NUMBERS?)?"
    r"|(?:ONE|TWO|THREE|FOUR) WORDS?(?:\s*(?:AND|/|OR|AND/OR)+\s*(?:AN?\s+)?NUMBERS?)?"
    r"|A NUMBER)", re.I)


def norm(s):
    s = (s or "").replace(" ", " ").replace("​", "").replace("﻿", "")
    return re.sub(r"\s+", " ", s).strip()


def content_hash(*parts):
    return hashlib.sha256("␟".join(parts).encode()).hexdigest()[:8]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# ───────────────────────────────────────────────────────────── S1: answer key
KEY_ITEM_RE = re.compile(r"(?:^|\s)(\d{1,2})\s*[.)]\s*")


def parse_answer_key(soup):
    """The official key lives in the bg-showmore hidden div ("1. yes 2. no …").
    Returns {format, items:[(n, raw)], error}. Items are accepted only while the
    numbering is strictly sequential from 1 — a break is an error, never a guess."""
    hidden = soup.find("div", id=re.compile(r"^bg-showmore-hidden-"))
    text = None
    if hidden is not None:
        text = hidden.get_text("\n")
    if not norm(text or ""):
        button = soup.find("button", class_=re.compile(r"bg-showmore-plg-button"))
        if button is not None:
            parts = []
            for sib in button.find_all_next():
                if sib.get("class") and any("addtoany" in c for c in sib.get("class") or []):
                    break
                if sib.name == "p":
                    parts.append(sib.get_text("\n"))
            text = "\n".join(parts)
    text = (text or "").replace(" ", " ")
    if not norm(text):
        return {"format": None, "items": [], "error": "ANSWER_KEY_MISSING", "raw": ""}
    lines = [norm(line) for line in text.split("\n") if norm(line)]
    flat = " ".join(lines)
    matches = list(KEY_ITEM_RE.finditer(" " + flat))
    items, expect = [], 1
    for i, m in enumerate(matches):
        n = int(m.group(1))
        if n != expect:
            continue  # numbers inside answers ("1990", "3 metres") are not item markers
        end = None
        # value runs to the next sequential marker
        for m2 in matches[i + 1:]:
            if int(m2.group(1)) == expect + 1:
                end = m2.start()
                break
        value = norm((" " + flat)[m.end():end] if end is not None else (" " + flat)[m.end():])
        items.append((n, value))
        expect += 1
    if items:
        return {"format": "numbered", "items": items, "error": None, "raw": flat[:2000]}
    if len(lines) >= 8:
        return {"format": "positional_lines", "items": [(i + 1, v) for i, v in enumerate(lines)],
                "error": None, "raw": flat[:2000]}
    return {"format": None, "items": [], "error": "ANSWER_KEY_UNPARSEABLE", "raw": flat[:2000]}


# ───────────────────────────────────────────────────────────── S2: linearise
BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "figure", "figcaption",
              "blockquote", "section", "article", "header", "footer", "pre", "dl", "dt", "dd", "center"}
SKIP_TAGS = {"script", "style", "ins", "iframe", "noscript", "button", "form", "input", "svg", "select", "textarea"}


class Line:
    __slots__ = ("idx", "block", "tag", "kind", "segs", "text", "bold", "lead", "img", "rows", "role")

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))

    def __repr__(self):
        return f"<L{self.idx} {self.kind} {self.text[:60]!r}>"


def _is_bold_tag(t):
    if t.name in ("strong", "b"):
        return True
    style = (t.get("style") or "").replace(" ", "").lower()
    return "font-weight:bold" in style or "font-weight:700" in style or "font-weight:600" in style


def img_src(tag):
    for attr in ("data-src", "data-lazy-src", "data-orig-file", "src"):
        v = tag.get(attr)
        if v and not v.startswith("data:"):
            return v
    return None


def linearise(ec):
    lines = []
    cur = []
    block_no = [0]
    tag_ctx = ["p"]

    def flush():
        if not cur:
            return
        segs = [(t, b) for t, b in cur]
        cur.clear()
        text = norm("".join(t for t, _ in segs))
        if not text:
            return
        bold_chars = norm("".join(t for t, b in segs if b))
        lead = ""
        first = next(((t, b) for t, b in segs if norm(t)), None)
        if first and first[1]:
            lead = norm(first[0])
        is_heading = tag_ctx[-1] in ("h1", "h2", "h3", "h4", "h5", "h6")
        bold = is_heading or re.sub(r"[\W_]", "", bold_chars) == re.sub(r"[\W_]", "", text)
        lines.append(Line(idx=len(lines), block=block_no[0], tag=tag_ctx[-1], kind="text",
                          segs=segs, text=text, bold=bold, lead=lead))

    def walk(node, bold):
        if isinstance(node, Comment):
            return
        if isinstance(node, NavigableString):
            cur.append((str(node), bold))
            return
        if not isinstance(node, Tag) or node.name in SKIP_TAGS:
            return
        name = node.name
        if name == "br":
            flush()
            return
        if name == "img":
            src = img_src(node)
            if src:
                flush()
                lines.append(Line(idx=len(lines), block=block_no[0], tag=tag_ctx[-1], kind="img",
                                  segs=[], text="", bold=False, lead="", img=src))
            return
        if name == "table":
            flush()
            rows = []
            for tr in node.find_all("tr"):
                cells = [norm(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
                if any(cells):
                    rows.append(cells)
            if rows:
                lines.append(Line(idx=len(lines), block=block_no[0], tag="table", kind="table",
                                  segs=[], text=" | ".join(" ; ".join(r) for r in rows), bold=False,
                                  lead="", rows=rows))
            return
        if name in BLOCK_TAGS:
            flush()
            tag_ctx.append(name)
            for c in node.children:
                walk(c, bold)
            flush()
            tag_ctx.pop()
            return
        b = bold or _is_bold_tag(node)
        for c in node.children:
            walk(c, b)

    for child in ec.children:
        if isinstance(child, Tag):
            block_no[0] += 1
        walk(child, False)
        flush()
    return lines


def isolate_content(soup):
    """entry-content up to (not including) the Show-Answers block."""
    ec = soup.find("div", class_="entry-content")
    if ec is None:
        return None
    comments = ec.find(id="comments")
    if comments is not None:
        comments.decompose()
    cut = ec.find("button", class_=re.compile(r"bg-showmore-plg-button")) \
        or ec.find("div", id=re.compile(r"^bg-showmore-hidden-"))
    if cut is not None:
        top = cut
        while top.parent is not None and top.parent is not ec:
            top = top.parent
        if top.parent is ec:
            for sib in list(top.find_next_siblings()):
                sib.decompose()
            top.decompose()
    return ec


# ───────────────────────────────────────────────────────────── S3: passages + groups
def is_header(line):
    if line.kind != "text":
        return None
    m = HEADER_RE.match(line.text)
    if not m:
        return None
    rest = norm(m.group(3) or "")
    lead_is_header = bool(line.lead) and HEADER_RE.match(line.lead) is not None
    # "Questions 10-14 are statement beginnings…" is prose inside a group, not a header
    if rest and not lead_is_header and not INSTRUCTION_VERB_RE.match(rest) and not line.bold:
        return None
    start, end = int(m.group(1)), int(m.group(2) or m.group(1))
    if end < start or end - start > 15 or start < 1 or end > 45:
        return None
    return start, end, rest


def has_blank(text):
    return bool(LEADER_RE.search(text) or PAREN_BLANK_RE.search(text))


def is_prose(line):
    return (line.kind == "text" and len(line.text) >= 160 and not has_blank(line.text)
            and not HEADER_RE.match(line.text) and not LEGEND_RE.match(line.text))


def is_title_candidate(line):
    if line.kind != "text" or not line.bold or len(line.text) > 120:
        return False
    t = line.text
    if HEADER_RE.match(t) or LEGEND_RE.match(t) or re.match(r"^(TRUE|FALSE|NOT GIVEN|YES|NO)\b", t):
        return False
    if re.match(r"^list of\b", t, re.I) or JUNK_RE.match(t) or EXAMPLE_RE.match(t):
        return False
    if re.match(r"^\(?([A-Z]{1,3}|[ivx]{1,5})\)?[.):]?(\s|$)", t) and len(t) < 4:
        return False
    return True


class Passage:
    def __init__(self, marker=None):
        self.marker = marker
        self.title = ""
        self.paragraphs = []  # Line objects (text or img)
        self.groups = []      # RawGroup


class RawGroup:
    def __init__(self, start, end, rest, line):
        self.start, self.end, self.rest = start, end, rest
        self.header_line = line
        self.lines = []


def segment(lines):
    """Walks the annotated lines and splits them into passages (prose) and raw
    question groups. Passage boundaries: explicit "READING PASSAGE N" markers,
    a bold title followed by prose, or new prose after a group's content."""
    passages = [Passage()]
    junk = []
    group = None

    def cur():
        return passages[-1]

    def new_passage(marker=None):
        nonlocal group
        p = cur()
        if p.paragraphs or p.title:
            passages.append(Passage(marker))
        elif marker:
            p.marker = marker
        group = None

    def next_text(i, n=3):
        out = []
        for ln in lines[i + 1:]:
            if ln.kind == "text" and JUNK_RE.match(ln.text):
                continue
            out.append(ln)
            if len(out) >= n:
                break
        return out

    for i, ln in enumerate(lines):
        if ln.kind == "text" and JUNK_RE.match(ln.text):
            junk.append(ln)
            continue
        if ln.kind == "text":
            pm = PASSAGE_MARKER_RE.match(ln.text)
            if pm and not HEADER_RE.match(ln.text):
                tok = next(g for g in pm.groups() if g)
                new_passage(int(tok) if tok.isdigit() else {"ONE": 1, "TWO": 2, "THREE": 3}[tok.upper()])
                continue
        hdr = is_header(ln)
        if hdr:
            g = RawGroup(*hdr, ln)
            cur().groups.append(g)
            group = g
            continue
        if is_title_candidate(ln):
            ahead = next_text(i, 3)
            ahead = [a for a in ahead if a.kind != "img"][:2]
            if ahead and is_prose(ahead[0]):
                p = cur()
                if p.paragraphs and not p.groups:
                    # a bold line between prose paragraphs of the same passage
                    # ("Section A", "Introduction", "KEY POINT ONE") is a subheading
                    ln.role = "subheading"
                    p.paragraphs.append(ln)
                    continue
                if p.paragraphs:
                    passages.append(Passage())
                group = None  # (questions printed before their passage text keep their passage)
                cur().title = ln.text
                continue
        if group is not None:
            if is_prose(ln) and _group_has_content(group):
                p = cur()
                if p.paragraphs:
                    passages.append(Passage())
                group = None
                cur().paragraphs.append(ln)
                continue
            group.lines.append(ln)
            continue
        cur().paragraphs.append(ln)
    # drop empty leading passage shells
    passages = [p for p in passages if p.paragraphs or p.groups or p.title]
    return passages, junk


def _group_has_content(g):
    for ln in g.lines:
        if ln.kind in ("table", "img"):
            return True
        if QNUM_RE.match(ln.text) or has_blank(ln.text):
            return True
        if ln.lead and re.match(r"^\(?[A-Z]{1,3}\)?[.)]?$|^[ivx]{1,5}[.)]?$", ln.lead):
            return True
    return False


# ───────────────────────────────────────────────────────────── S4: blanks
def blank_segments(text, lo, hi, used=None):
    """Turns a source line into ["text", {"blank": N}, …]. Recognised source
    blanks: "(N) ……", "N ……", "……(N)". Returns (segments, numbers, orphan_leaders)."""
    used = used if used is not None else set()
    spans = []
    for rx in (PAREN_BLANK_RE, LEADER_PAREN_RE, NUM_LEADER_RE):
        for m in rx.finditer(text):
            n = int(m.group(1))
            if not (lo <= n <= hi):
                continue
            if any(not (m.end() <= s or m.start() >= e) for s, e, _ in spans):
                continue
            spans.append((m.start(), m.end(), n))
    spans.sort()
    segs, nums, pos = [], [], 0
    for s, e, n in spans:
        if s > pos:
            segs.append(text[pos:s])
        segs.append({"blank": n})
        nums.append(n)
        pos = e
    if pos < len(text):
        segs.append(text[pos:])
    orphans = 0
    clean = []
    for sg in segs:
        if isinstance(sg, str):
            if LEADER_RE.search(sg):
                orphans += len(LEADER_RE.findall(sg))
            sg = re.sub(r"\s+", " ", sg)
            if sg.strip():
                clean.append(sg)
        else:
            clean.append(sg)
    return clean, nums, orphans


def tidy_segments(segs):
    out = []
    for i, sg in enumerate(segs):
        if isinstance(sg, str):
            s = sg
            if i == 0:
                s = s.lstrip()
            if i == len(segs) - 1:
                s = s.rstrip()
            if s:
                out.append(s)
        else:
            out.append(sg)
    return out


def segments_plain(segs):
    return norm("".join(s if isinstance(s, str) else " ______ " for s in segs))


# ───────────────────────────────────────────────────────────── S5: options
def split_bold_options(line):
    """A single source line may hold a whole option pool:
    "**A** descriptivists **B** language expert …". Splits on bold option tokens."""
    if line.kind != "text" or not line.segs:
        return None
    pieces, curtok, curtext = [], None, []
    for t, b in line.segs:
        tok = norm(t)
        m = re.match(r"^\(?([A-Z]{1,3}|[ivx]{1,5})\)?[.):]?$", tok) if b else None
        if m:
            if curtok is not None:
                pieces.append((curtok, norm("".join(curtext))))
            curtok, curtext = m.group(1), []
        else:
            curtext.append(t)
    if curtok is not None:
        pieces.append((curtok, norm("".join(curtext))))
    lead_txt = norm("".join(t for t, _ in line.segs))
    if len(pieces) >= 2 and lead_txt.startswith(pieces[0][0]):
        return pieces
    return None


def option_of(line):
    """(id, text) if the line is an option entry, else None."""
    if line.kind != "text":
        return None
    t = line.text
    if line.lead:
        m = re.match(r"^\(?([A-Z]{1,3}|[ivx]{1,5}|[IVX]{1,5})\)?[.):]?$", line.lead)
        if m:
            rest = norm(t[len(line.lead):]) if t.startswith(line.lead) else norm(re.sub(r"^\S+", "", t))
            rest = re.sub(r"^[.):]\s*", "", rest)
            return m.group(1), rest
        if line.bold:
            return None  # a fully bold line ("A short history of …") is a heading, not an option
    m = ROMAN_OPT_RE.match(t)
    if m and m.group(1) and m.group(1) in ROMAN:
        return m.group(1), norm(m.group(2))
    m = LETTER_OPT_RE.match(t)
    if m:
        if m.group(1):
            return m.group(1), norm(m.group(2))
        # "A text" without punctuation: only when the following word is not a
        # sentence continuation of the article "A" (handled by caller context)
        return m.group(3), norm(m.group(4))
    return None


def sequential(ids):
    if not ids:
        return False
    if all(i in ROMAN for i in ids):
        return ids == ROMAN[:len(ids)]
    if all(len(i) == 1 and i in LETTERS for i in ids):
        return ids == LETTERS[:len(ids)]
    return len(set(ids)) == len(ids)  # free codes (e.g. MM, LG): distinct


# ───────────────────────────────────────────────────────────── S6: answers
def key_profile(vals):
    lv = [norm(v).lower().rstrip(".") for v in vals]
    if not lv or any(v == "" for v in lv):
        return "incomplete"
    if all(v in TFNG_CANON for v in lv) and any(v in ("true", "false", "t", "f") for v in lv):
        return "tfng"
    if all(v in YNNG_CANON for v in lv) and any(v in ("yes", "no", "y", "n") for v in lv):
        return "ynng"
    if all(v in ("not given", "ng") for v in lv):
        return "ng_only"
    if all(v in ROMAN for v in lv):
        return "roman"
    if all(re.fullmatch(r"[a-z]", v) for v in lv):
        return "letters"
    return "words"


def explicit_alternatives(raw):
    """Accepted answers explicitly encoded in the official key notation:
    "air/ oxygen" → alternatives; "ratio (of fuel)" → the parenthesised words are
    optional ("ratio of fuel", "ratio"). Nothing beyond the key's own notation."""
    out = []
    for part in [norm(p) for p in re.split(r"\s*/\s*", raw) if norm(p)]:
        for v in (norm(re.sub(r"[()]", " ", part)), norm(re.sub(r"\([^)]*\)", " ", part))):
            if v and v not in out:
                out.append(v)
    return out or [norm(raw)]


# British/American spelling pairs (whole-word suffix rules only). Used for one
# purpose: when the official key and the passage spell the SAME word
# differently, the passage's verbatim form is also accepted — the instruction
# tells candidates to copy words from the passage.
_SPELLING_RULES = [
    (r"is(e|ed|es|ing|ation|ations|er|ers)$", r"iz\1"), (r"ys(e|ed|es|ing)$", r"yz\1"),
    (r"our(s|ed|ing|ite|ites|able|ful)?$", r"or\1"), (r"ogue$", "og"), (r"tre(s)?$", r"ter\1"),
    (r"ll(ed|ing|er|ers)$", r"l\1"), (r"ence$", "ense"),
]


def spelling_canon(word):
    w = word.replace("ae", "e")
    for rx, rp in _SPELLING_RULES:
        w2 = re.sub(rx, rp, w)
        if w2 != w:
            return w2
    return w


def passage_tokens(text):
    return re.sub(r"[^\w\s]", " ", text.lower().replace("’", "'")).split()


def word_count(ans):
    a = re.sub(r"\([^)]*\)", " ", ans)
    return len([w for w in re.split(r"\s+", a.strip()) if w])


def word_limit_max(wl):
    if not wl:
        return None
    m = re.search(r"(ONE|TWO|THREE|FOUR|\d)\s+WORDS?", wl, re.I)
    if m:
        v = m.group(1).lower()
        return int(v) if v.isdigit() else NUMBER_WORDS.get(v)
    if re.search(r"ONE WORD", wl, re.I):
        return 1
    if re.fullmatch(r"A NUMBER", wl.strip(), re.I):
        return 1
    return None


# ───────────────────────────────────────────────────────────── S7: group parser
def classify_claim(instr):
    t = instr.lower()
    claims = set()
    if re.search(r"\btrue\b.*\bfalse\b|\bfalse\b.*not given", t):
        claims.add("tfng")
    if re.search(r"\byes\b.*\bno\b|\bno\b.*not given", t):
        claims.add("ynng")
    if re.search(r"heading", t):
        claims.add("headings")
    if re.search(r"which (paragraph|section)|(paragraph|section)s? (contains?|does each)|in which (paragraph|section)", t):
        claims.add("which_paragraph")
    m = re.search(r"\b(?:choose|which|select|pick|circle|write)\s+(two|three|four|five|six)\b", t)
    if m:
        claims.add("choose_n:" + str(COUNT_WORDS[m.group(1)]))
    if re.search(r"correct letter|choose the (best|correct|most suitable) (answer|option)|circle the", t):
        claims.add("mcq")
    if re.search(r"\bending", t):
        claims.add("endings")
    if re.search(r"classify", t):
        claims.add("classify")
    if re.search(r"\bmatch|look at the following|list of (people|researchers|scientists|names|countries|places|writers|experts|dates|statements|findings)", t):
        claims.add("match")
    if re.search(r"from the box|list of (words|phrases|options)|word ?bank|words? (in|from) the (box|list)|using the list", t):
        claims.add("bank")
    for k, rx in (("summary", r"summary"), ("notes", r"\bnotes?\b"), ("table", r"\btable\b"),
                  ("flow", r"flow[ -]?chart"), ("diagram", r"diagram|\blabel\b|figure|map\b|plan\b"),
                  ("sentence", r"sentences?"), ("form", r"\bform\b"),
                  ("answer_q", r"answer the (following )?questions?|short answer")):
        if re.search(rx, t):
            claims.add(k)
    return claims


def completion_subtype(claims, has_table, has_img):
    if "flow" in claims:
        return "flow_chart_completion"
    if "table" in claims or (has_table and not {"summary", "notes"} & claims):
        return "table_completion"
    if "diagram" in claims:
        return "diagram_completion"
    if "notes" in claims or "form" in claims:
        return "note_completion"
    if "summary" in claims:
        return "summary_completion"
    if "sentence" in claims:
        return "sentence_completion"
    return "summary_completion" if not has_img else "diagram_completion"


def parse_group(rg, key, passage_labels, assets_for, gid, ptokens=()):
    lo, hi = rg.start, rg.end
    size = hi - lo + 1
    reasons, warnings = [], []
    instr_parts = [rg.rest] if rg.rest else []
    notes, legend = [], []
    pool_title, pool = None, []
    questions = {}           # n -> dict(stem_segs, options, line)
    q_order = []
    stim_blocks = []         # stimulus blocks with blanks / text / tables / images
    stim_title = None
    figures = []
    seen_content = False
    unconsumed = []
    last_q = None
    dup_numbers = []
    out_of_range = []

    lines = rg.lines
    i = 0
    while i < len(lines):
        ln = lines[i]
        i += 1
        if ln.kind == "img":
            figures.append(ln.img)
            stim_blocks.append({"type": "image", "src": ln.img})
            seen_content = True
            last_q = None
            continue
        if ln.kind == "table":
            stim_blocks.append({"type": "table", "rows": ln.rows})
            seen_content = True
            last_q = None
            continue
        t = ln.text
        if LEGEND_RE.match(t) or (ln.lead and re.match(r"^(TRUE|FALSE|NOT GIVEN|YES|NO)$", ln.lead, re.I)
                                  and len(t) < 160):
            legend.append(t)
            continue
        if EXAMPLE_RE.match(t):
            notes.append(t)
            continue
        if re.match(r"^\s*NB\b|^\s*N\.B\.?", t):
            instr_parts.append(t)
            continue
        # option pool split across bold tokens on one line
        multi = split_bold_options(ln)
        if multi:
            (questions[last_q]["options"] if last_q is not None else pool).extend(multi)
            seen_content = True
            continue
        qm = QNUM_RE.match(t)
        qn = None
        if qm:
            qn = int(qm.group(1) or qm.group(3))
            stem = qm.group(2) if qm.group(1) else qm.group(4)
            # "(12) ……" at line start is a summary blank, not a question number
            if re.match(r"^\s*\(\s*\d{1,2}\s*\)", t):
                qn = None
            elif not (lo <= qn <= hi):
                if 1 <= qn <= 45 and not re.match(r"^\s*\d{1,2}\s*(%|per|years?|metres?|km|kg|million|billion|thousand|hours?|days?|minutes?)\b", t, re.I):
                    out_of_range.append(qn)
                qn = None
        if qn is not None:
            if qn in questions:
                dup_numbers.append(qn)
            segs, nums, orphans = blank_segments(stem, lo, hi)
            # the question's own blank is a bare leader inside its stem
            stem_segs = []
            had_leader = False
            for s in segs:
                if isinstance(s, str) and LEADER_RE.search(s):
                    parts = LEADER_RE.split(s)
                    for k, part in enumerate(parts):
                        if part.strip():
                            stem_segs.append(part)
                        if k < len(parts) - 1:
                            stem_segs.append({"blank": qn})
                            had_leader = True
                else:
                    stem_segs.append(s)
            blank_count = sum(1 for s in stem_segs if isinstance(s, dict))
            questions[qn] = {"segs": tidy_segments(stem_segs), "options": [], "line": ln,
                             "leader": had_leader, "foreign_blanks": [n for n in nums if n != qn],
                             "blank_count": blank_count}
            q_order.append(qn)
            last_q = qn
            seen_content = True
            continue
        opt = option_of(ln)
        if opt and has_blank(t):
            # "i … a dangerous environment." — a sentence ENDING starts with an
            # ellipsis; any other leader inside an option line is a blank
            rest_after = re.sub(r"^\s*(?:" + LEADER + r")\s*", "", opt[1])
            if rest_after == opt[1] or has_blank(rest_after):
                opt = None
        if opt:
            oid, otext = opt
            plain_letter = not ln.lead and not re.match(r"^\s*\(?[A-Z]\)?[.):]", t) and oid in LETTERS
            # an unpunctuated, unbolded "A word…" is only an option inside an
            # option run: it continues one, or it is "A …" immediately followed by "B …"
            in_run = bool(pool) or (last_q is not None and questions[last_q]["options"])
            if plain_letter and not in_run:
                nxt = lines[i] if i < len(lines) else None
                nxt_opt = option_of(nxt) if nxt is not None else None
                if not (oid == "A" and nxt_opt and nxt_opt[0] == "B"):
                    opt = None
            if opt:
                # options directly after a numbered stem belong to that stem;
                # otherwise they form the group's shared pool
                (questions[last_q]["options"] if last_q is not None else pool).append((oid, otext))
                seen_content = True
                continue
        if has_blank(t):
            segs, nums, orphans = blank_segments(t, lo, hi)
            stim_blocks.append({"type": "text", "segments": tidy_segments(segs), "orphans": orphans, "nums": nums})
            seen_content = True
            last_q = None
            continue
        # short bold line before options → pool / stimulus title
        if ln.bold and len(t) <= 60 and POOL_TITLE_RE.match(t):
            nxt = lines[i] if i < len(lines) else None
            if nxt is not None and (option_of(nxt) or split_bold_options(nxt)) and not has_blank(nxt.text):
                pool_title = t
                last_q = None
                continue
            if stim_title is None and not stim_blocks:
                stim_title = t
                continue
            stim_blocks.append({"type": "heading", "text": t})
            continue
        if not seen_content or INSTRUCTION_VERB_RE.match(t):
            instr_parts.append(t)
            continue
        # plain text after content: stimulus prose (e.g. notes without blanks,
        # a summary sentence, a question stem for a single-question MCQ)
        if size == 1 and last_q is None and not questions:
            questions[lo] = {"segs": [t], "options": [], "line": ln, "leader": False,
                             "foreign_blanks": [], "blank_count": 0, "unnumbered": True}
            q_order.append(lo)
            last_q = lo
            continue
        stim_blocks.append({"type": "text", "segments": [t], "orphans": 0, "nums": []})
        unconsumed.append(t)

    # a shared pool printed after the numbered items attaches to the last item
    # while parsing; when it is the only item with options it is the group pool
    with_opts = [n for n in q_order if questions[n]["options"]]
    if len(questions) > 1 and with_opts == [q_order[-1]]:
        pool.extend(questions[q_order[-1]]["options"])
        questions[q_order[-1]]["options"] = []
    # single-question MCQ printed without its number ("Question 13 / Choose the
    # correct letter / What is the writer's purpose…? / A … B …"): the stem is
    # the last non-directive instruction sentence and the pool is its options
    if size == 1 and not questions and pool:
        for k in range(len(instr_parts) - 1, -1, -1):
            part = instr_parts[k]
            if part is rg.rest and k == 0:
                break
            if part.endswith("?") or not INSTRUCTION_VERB_RE.match(part) or re.match(r"^\s*Which\b", part):
                if re.search(r"correct letter|answer sheet|boxes?\s+\d", part, re.I):
                    continue
                questions[lo] = {"segs": [part], "options": list(pool), "line": rg.header_line, "leader": False,
                                 "foreign_blanks": [], "blank_count": 0, "unnumbered": True}
                q_order.append(lo)
                pool = []
                del instr_parts[k]
                break
    mcq_multi_stem = None
    if not questions and pool and size > 1 and re.search(r"\b(TWO|THREE|FOUR|FIVE|SIX)\b", " ".join(instr_parts), re.I):
        for k in range(len(instr_parts) - 1, -1, -1):
            part = instr_parts[k]
            if (k > 0 or part is not rg.rest) and (part.endswith("?") or re.match(r"^\s*(Which|What)\b", part, re.I)) \
                    and not re.search(r"answer sheet|boxes?\s+\d", part, re.I):
                mcq_multi_stem = part
                del instr_parts[k]
                break
    instruction = norm(" ".join(instr_parts))
    claims = classify_claim(instruction + " " + " ".join(legend))
    wl = WORD_LIMIT_RE.search(instruction)
    word_limit = norm(wl.group(1)).upper() if wl else None

    key_vals = [key.get(n) for n in range(lo, hi + 1)]
    # "Choose TWO letters" keys are printed as the SET on every slot ("A, C" / "A, C");
    # the set is explicit, so each slot takes one member (order is irrelevant for scoring)
    answer_set = None
    if size > 1 and all(v is not None for v in key_vals) and len({norm(v) for v in key_vals}) == 1:
        letters_in = [x.strip().upper() for x in re.split(r"\s*(?:,|and|&)\s*", norm(key_vals[0])) if x.strip()]
        if len(letters_in) == size and all(re.fullmatch(r"[A-Z]", x) for x in letters_in) and len(set(letters_in)) == size:
            answer_set = sorted(letters_in)
            key = dict(key)
            for k, n in enumerate(range(lo, hi + 1)):
                key[n] = answer_set[k]
            key_vals = [key.get(n) for n in range(lo, hi + 1)]
    present = [v for v in key_vals if v is not None and norm(v) != ""]
    profile = key_profile([v or "" for v in key_vals])

    # pool normalisation
    pool_ids = [p[0] for p in pool]
    if pool and all(p.lower() in ROMAN for p in pool_ids):
        pool = [(p[0].lower(), p[1]) for p in pool]
        pool_ids = [p[0] for p in pool]

    stim_nums = [n for b in stim_blocks if b["type"] == "text" for n in b["nums"]]
    table_blocks = [b for b in stim_blocks if b["type"] == "table"]
    table_nums = []
    for b in table_blocks:
        rows = []
        for row in b["rows"]:
            cells = []
            for cell in row:
                segs, nums, orphans = blank_segments(cell, lo, hi)
                cells.append(tidy_segments(segs))
                table_nums.extend(nums)
                if orphans:
                    b.setdefault("orphans", 0)
                    b["orphans"] = b.get("orphans", 0) + orphans
            rows.append(cells)
        b["cells"] = rows
    inline_nums = stim_nums + table_nums
    # a lettered word bank laid out as a table ("A aphids | B agricultural | …")
    if not pool:
        for b in list(table_blocks):
            cells = [norm(c) for row in b["rows"] for c in row if norm(c)]
            ms = [re.match(r"^\(?([A-Z])\)?[.):]?\s+(\S.*)$", c) for c in cells]
            if cells and all(ms) and sequential([m.group(1) for m in ms]):
                pool = [(m.group(1), norm(m.group(2))) for m in ms]
                pool_ids = [m.group(1) for m in ms]
                stim_blocks.remove(b)
                table_blocks.remove(b)
                break
    # an unlettered word box ("List of words" rendered as a table of single
    # words) is the option pool of a completion group; option ids are the words
    if not pool and ("bank" in claims or (pool_title or "").lower().startswith("list of")):
        for b in list(table_blocks):
            cells = [c for row in b["rows"] for c in row if norm(c)]
            nums_here = [n for row in b["cells"] for c in row for n in [x["blank"] for x in c if isinstance(x, dict)]]
            if cells and not nums_here and all(len(c.split()) <= 4 for c in cells) \
                    and present and all(norm(v).lower() in {c.lower() for c in cells} for v in present):
                pool = [(c, c) for c in cells]
                pool_ids = [c for c in cells]
                stim_blocks.remove(b)
                table_blocks.remove(b)
                break
    orphan_total = sum(b.get("orphans", 0) for b in stim_blocks)

    # ── decide the type
    qtype = None
    control = None
    select_count = None
    claimed_tf = "tfng" in claims and "ynng" not in claims
    claimed_yn = "ynng" in claims and "tfng" not in claims
    choose_n = next((int(c.split(":")[1]) for c in claims if c.startswith("choose_n:")), None)
    if choose_n is None and not questions and pool and size > 1:
        # "Reading Passage 2 gives FIVE effective changes … Choose these changes from the list"
        m = re.search(r"\b(TWO|THREE|FOUR|FIVE|SIX)\b", instruction)
        if m and COUNT_WORDS[m.group(1).lower()] == size:
            choose_n = size

    if profile in ("tfng", "ynng") or claimed_tf or claimed_yn or (profile == "ng_only" and (claimed_tf or claimed_yn)):
        qtype = profile if profile in ("tfng", "ynng") else ("tfng" if claimed_tf else "ynng")
        if (qtype == "tfng" and claimed_yn) or (qtype == "ynng" and claimed_tf):
            reasons.append("ANSWER_TYPE_MISMATCH")
        if profile in ("roman", "letters", "words"):
            reasons.append("ANSWER_TYPE_MISMATCH")
    elif profile == "roman" or ("headings" in claims and pool and all(p in ROMAN for p in pool_ids)):
        qtype = "matching_headings"
    elif profile == "letters" or (pool and present and all(norm(v).upper() in {p.upper() for p in pool_ids} for v in present)):
        mcq_shape = questions and all(len(questions[n]["options"]) >= 2 for n in questions)
        if "which_paragraph" in claims and not mcq_shape:
            qtype = "matching_information"
        elif mcq_shape and not pool and (choose_n is None or len(questions) == size):
            qtype = "mcq_single"
        elif choose_n and choose_n == size and pool and len(questions) <= 1 and not inline_nums:
            qtype = "mcq_multi"
            select_count = choose_n
        elif (inline_nums or (questions and all(q["leader"] for q in questions.values()) and "endings" not in claims)) and pool:
            qtype = completion_subtype(claims, bool(table_blocks), bool(figures))
            control = "pool_select"
        elif questions and pool and "endings" in claims:
            qtype = "sentence_endings"
        elif questions and pool and "headings" in claims:
            qtype = "matching_headings"
        elif questions and pool:
            qtype = "matching_features"
        elif figures and pool and not questions:
            qtype = "diagram_completion"
            control = "pool_select"
        else:
            reasons.append("AMBIGUOUS_STRUCTURE")
            qtype = "unknown"
    elif profile in ("words", "incomplete", "ng_only"):
        if inline_nums:
            qtype = completion_subtype(claims, bool(table_blocks), bool(figures))
        elif questions and any(q["leader"] for q in questions.values()):
            qtype = "sentence_completion"
        elif questions and ("answer_q" in claims or all(norm(segments_plain(q["segs"])).endswith("?") for q in questions.values())):
            qtype = "short_answer"
        elif questions and "sentence" in claims:
            qtype = "sentence_completion"
        elif questions and ("summary" in claims or "notes" in claims):
            qtype = "sentence_completion"
        elif figures and not questions and ({"diagram", "table", "flow", "notes", "summary"} & claims):
            qtype = completion_subtype(claims | ({"diagram"} if not ({"table", "flow"} & claims) else set()),
                                       False, True)
            if qtype not in ("table_completion", "flow_chart_completion"):
                qtype = "diagram_completion"
        elif questions:
            qtype = "short_answer"
        else:
            reasons.append("EMPTY_QUESTION")
            qtype = "unknown"
    if control is None:
        control = CONTROL.get(qtype, "text")

    # ── build normalized questions
    out_q = []
    expected = list(range(lo, hi + 1))
    pool_opts = [{"id": p[0], "text": p[1]} for p in pool]
    if qtype == "matching_information":
        m = re.search(r"\b([A-Z])\s*(?:[-–—‑]|to)\s*([A-Z])\b", instruction)
        if m and ord(m.group(2)) > ord(m.group(1)):
            pool_opts = [{"id": chr(c), "text": f"Paragraph {chr(c)}"} for c in range(ord(m.group(1)), ord(m.group(2)) + 1)]
        elif passage_labels:
            pool_opts = [{"id": c, "text": f"Paragraph {c}"} for c in passage_labels]
        else:
            pool_opts = []
            reasons.append("MISSING_OPTION_POOL")
        if passage_labels and pool_opts and [o["id"] for o in pool_opts] != passage_labels[:len(pool_opts)] \
                and set(o["id"] for o in pool_opts) - set(passage_labels):
            warnings.append("PARAGRAPH_LABELS_DIFFER")

    stimulus = None
    if qtype in ("summary_completion", "note_completion", "table_completion", "flow_chart_completion",
                 "diagram_completion") or (qtype == "sentence_completion" and inline_nums):
        blocks = []
        for b in stim_blocks:
            if b["type"] == "text":
                blocks.append({"type": "text", "segments": b["segments"]})
            elif b["type"] == "heading":
                blocks.append({"type": "heading", "text": b["text"]})
            elif b["type"] == "table":
                blocks.append({"type": "table", "rows": b["cells"]})
            elif b["type"] == "image":
                blocks.append({"type": "image", "src": b["src"]})
        stimulus = {"title": stim_title, "blocks": blocks}
        if orphan_total:
            reasons.append("MALFORMED_BLANK")
        counts = Counter(inline_nums)
        dup_blanks = [n for n, c in counts.items() if c > 1]
        if dup_blanks:
            reasons.append("DUPLICATE_BLANK")
        figure_only = not inline_nums and figures
        for n in expected:
            if n in counts or figure_only:
                out_q.append({"number": n, "prompt": None, "blankInStimulus": n in counts,
                              "labelInFigure": bool(figure_only)})
            elif n in questions:
                q = questions[n]
                out_q.append({"number": n, "prompt": q["segs"], "blankInStimulus": False})
        if questions and inline_nums:
            for n in questions:
                if n not in counts and n not in expected:
                    out_of_range.append(n)
    elif qtype == "mcq_multi":
        stem = None
        if questions:
            only = next(iter(questions.values()))
            stem = only["segs"]
        else:
            # the stem is the instruction sentence that asks the question ("Which THREE …?")
            stem = [mcq_multi_stem] if mcq_multi_stem else None
        if not stem and not choose_n:
            reasons.append("EMPTY_QUESTION")
        for n in expected:
            out_q.append({"number": n, "prompt": stem if n == lo else None, "slotOf": lo})
        if not stem and choose_n and instruction:
            # the instruction itself states what to choose ("… gives FIVE effective changes …")
            reasons[:] = [r for r in reasons if r != "EMPTY_QUESTION"]
    else:
        for n in expected:
            if n in questions:
                q = questions[n]
                entry = {"number": n, "prompt": q["segs"]}
                if qtype == "mcq_single":
                    entry["options"] = [{"id": o[0], "text": o[1]} for o in q["options"]]
                out_q.append(entry)

    if control == "pool_select" and qtype in ("matching_features", "sentence_endings", "matching_headings",
                                                "matching_information"):
        for q in out_q:
            segs = q.get("prompt") or []
            if segs and isinstance(segs[-1], dict) and segs[-1]["blank"] == q["number"] \
                    and not any(isinstance(x, dict) for x in segs[:-1]):
                q["prompt"] = tidy_segments(segs[:-1] + [" …"])
    numbers = [q["number"] for q in out_q]
    missing = [n for n in expected if n not in numbers]
    if missing:
        reasons.append("MISSING_QUESTION")
    if dup_numbers:
        reasons.append("DUPLICATE_QUESTION")
    if out_of_range:
        reasons.append("NUMBERING_MISMATCH")

    # ── per-type structural validation
    if qtype in ("tfng", "ynng", "matching_headings", "matching_information", "matching_features",
                 "sentence_endings", "short_answer", "mcq_single"):
        for q in out_q:
            p = segments_plain(q.get("prompt") or [])
            if len(re.sub(r"[\W_]", "", p)) < 2:
                reasons.append("EMPTY_QUESTION")
                break
    if qtype in ("tfng", "ynng", "short_answer", "matching_information", "matching_features", "sentence_endings"):
        if any(any(isinstance(s, dict) for s in (q.get("prompt") or [])) for q in out_q) and qtype != "short_answer":
            reasons.append("MALFORMED_BLANK")
    if qtype == "mcq_single":
        for q in out_q:
            ids = [o["id"] for o in q.get("options") or []]
            if len(ids) < 3 or not sequential(ids) or any(not norm(o["text"]) for o in q["options"]):
                reasons.append("INCOMPLETE_OPTIONS")
                break
    if control == "pool_select" or qtype == "mcq_multi":
        ids = [o["id"] for o in pool_opts]
        if len(ids) < 2:
            reasons.append("MISSING_OPTION_POOL")
        elif not sequential(ids) or (qtype != "matching_information" and any(not norm(o["text"]) for o in pool_opts)):
            reasons.append("INCOMPLETE_OPTIONS")
        if qtype == "matching_headings" and ids and not all(i in ROMAN for i in ids) and not all(i in LETTERS for i in ids):
            reasons.append("INCOMPLETE_OPTIONS")
    if qtype == "sentence_completion" and not inline_nums:
        for q in out_q:
            segs = q.get("prompt") or []
            if not any(isinstance(s, dict) for s in segs):
                plain = segments_plain(segs)
                if re.search(r"[.?!]$", plain):
                    reasons.append("MALFORMED_BLANK")  # no visible gap and sentence already complete
                    break
                q["prompt"] = segs + [{"blank": q["number"]}]
            elif sum(1 for s in segs if isinstance(s, dict)) > 1:
                reasons.append("MALFORMED_BLANK")
                break
    if qtype == "short_answer":
        for q in out_q:
            if sum(1 for s in (q.get("prompt") or []) if isinstance(s, dict)) > 1:
                reasons.append("MALFORMED_BLANK")
                break
    for q in out_q:
        p = segments_plain(q.get("prompt") or [])
        opts = " ".join(o["text"] for o in q.get("options") or [])
        if ARTIFACT_RE.search(p) or ARTIFACT_RE.search(opts):
            reasons.append("EXTRACTION_ARTIFACT")
            break
    if any(ARTIFACT_RE.search(o["text"]) for o in pool_opts) or ARTIFACT_RE.search(instruction):
        reasons.append("EXTRACTION_ARTIFACT")
    if not instruction and qtype not in ("tfng", "ynng"):
        reasons.append("MISSING_INSTRUCTION")
    if unconsumed and qtype in ("mcq_single", "tfng", "ynng", "matching_headings", "matching_information",
                                "matching_features", "sentence_endings", "short_answer", "mcq_multi"):
        warnings.append("UNCONSUMED_TEXT")

    # ── media: every figure must already be in R2
    fig_assets = []
    for src in figures:
        a = assets_for(src)
        fig_assets.append(a)
        if a["status"] != "in_r2":
            reasons.append("MEDIA_NOT_IN_R2" if a["status"] == "not_in_r2" else "MEDIA_MISSING")
    if stimulus:
        for b in stimulus["blocks"]:
            if b["type"] == "image":
                a = assets_for(b.pop("src"))
                b["asset"] = a["assetId"]
    if qtype == "diagram_completion" and not figures:
        reasons.append("MEDIA_MISSING")

    # ── answers
    key_ids = {o["id"].upper(): o["id"] for o in pool_opts}
    for q in out_q:
        raw = key.get(q["number"])
        if raw is None or norm(raw) == "":
            reasons.append("MISSING_ANSWER")
            q["answer"] = None
            continue
        raw = norm(raw)
        low = raw.lower().rstrip(".")
        canon, accepted = None, None
        if qtype == "tfng":
            canon = TFNG_CANON.get(low)
        elif qtype == "ynng":
            canon = YNNG_CANON.get(low)
        elif qtype == "mcq_single":
            ids = {o["id"].upper(): o["id"] for o in q.get("options") or []}
            canon = ids.get(raw.upper().rstrip("."))
        elif control == "pool_select" or qtype == "mcq_multi":
            v = raw.rstrip(".")
            canon = key_ids.get(v.upper()) or (v.lower() if v.lower() in [o["id"] for o in pool_opts] else None)
            ids = [o["id"] for o in pool_opts]
            if canon is None and re.fullmatch(r"\d{1,2}", v) and ids and all(x in ROMAN for x in ids) \
                    and 1 <= int(v) <= len(ids):
                # "Write the correct number i-x": the key gives the heading's ordinal as a digit
                canon = ROMAN[int(v) - 1]
                q["answerNotation"] = "digit_for_roman"
        else:
            canon = raw
            accepted = explicit_alternatives(raw)
            lim = word_limit_max(word_limit)
            if lim and all(word_count(a) > lim for a in accepted) and not re.search(r"\d", raw):
                reasons.append("ANSWER_EXCEEDS_WORD_LIMIT")
        if canon is None:
            reasons.append("ANSWER_INVALID_FOR_TYPE")
        q["answer"] = {"raw": raw, "value": canon, "accepted": accepted or ([canon] if canon else [])}
    if qtype == "mcq_multi":
        vals = [q["answer"]["value"] for q in out_q if q.get("answer")]
        if len(set(vals)) != len(vals):
            reasons.append("ANSWER_INVALID_FOR_TYPE")

    # ── cross-checks between structure, instruction and key
    if control == "text":
        # D. options the type never uses are orphans: the candidate would see a
        #    list that the answer control cannot select from
        if pool or any(questions[n]["options"] for n in questions):
            reasons.append("ORPHAN_OPTIONS")
        # E/G. the instruction asks for a letter / a word from a box, but the
        #    group was parsed as typed words
        if re.search(r"correct letters?\b|corresponding letter|letters?\s+[A-Z]\s*[-–—]|numbers? i\s*[-–]", instruction, re.I):
            reasons.append("ANSWER_TYPE_MISMATCH")
        if "bank" in claims:
            reasons.append("MISSING_OPTION_POOL")
        for q in out_q:
            raw = ((q.get("answer") or {}).get("raw") or "").strip().rstrip(".")
            # C. a bare option code / judgement word is never a typed answer
            if re.fullmatch(r"[A-Za-z]|[ivxIVX]{1,4}|(?i:true|false|not given|yes|no|ng)", raw):
                reasons.append("ANSWER_INVALID_FOR_TYPE")
                break
            if re.fullmatch(r"[A-Z](\s*,\s*[A-Z])+", raw):
                reasons.append("ANSWER_INVALID_FOR_TYPE")
                break
        # H. words-from-the-passage answers must occur in the passage
        if ptokens and qtype != "unknown":
            canon_tokens = [spelling_canon(t) for t in ptokens]
            joined = " " + " ".join(ptokens) + " "
            for q in out_q:
                a = q.get("answer")
                if not a or re.search(r"\d", a["raw"]):
                    continue
                variants = a["accepted"]
                if any(" " + " ".join(passage_tokens(v)) + " " in joined for v in variants if passage_tokens(v)):
                    continue
                # same word, British vs American spelling → accept the passage's verbatim form
                found = None
                for v in variants:
                    vt = [spelling_canon(t) for t in passage_tokens(v)]
                    if not vt:
                        continue
                    for k in range(len(canon_tokens) - len(vt) + 1):
                        if canon_tokens[k:k + len(vt)] == vt:
                            found = " ".join(ptokens[k:k + len(vt)])
                            break
                    if found:
                        break
                if found:
                    a["accepted"] = a["accepted"] + [found]
                    a["passageSpellingVariant"] = found
                else:
                    reasons.append("ANSWER_NOT_IN_PASSAGE")
                    q["answerNotInPassage"] = True

    if qtype == "unknown" and "AMBIGUOUS_STRUCTURE" not in reasons and "EMPTY_QUESTION" not in reasons:
        reasons.append("AMBIGUOUS_STRUCTURE")
    reasons = sorted(set(reasons))
    status = "production" if not reasons else "quarantined"
    raw_lines = [{"text": ln.text[:400], "kind": ln.kind, "bold": ln.bold, **({"img": ln.img} if ln.img else {})}
                 for ln in [rg.header_line] + rg.lines]
    return {
        "groupId": gid,
        "startQ": lo, "endQ": hi,
        "type": qtype,
        "answerControl": control,
        "selectCount": select_count,
        "answerSet": (sorted(q["answer"]["value"] for q in out_q if q.get("answer") and q["answer"].get("value"))
                      if qtype == "mcq_multi" else None),
        "answerSetNotation": "set_per_slot" if answer_set else None,
        "instruction": instruction or None,
        "legend": legend or None,
        "notes": notes or None,
        "wordLimit": word_limit,
        "optionPool": {"title": pool_title, "options": pool_opts} if (control == "pool_select" or qtype == "mcq_multi") else None,
        "stimulus": stimulus,
        "figures": fig_assets or None,
        "questions": [{"number": q["number"], "type": qtype, **{k: v for k, v in q.items() if k != "number"}}
                      for q in out_q],
        "status": status,
        "reasonCodes": reasons,
        "warnings": sorted(set(warnings)) or None,
        "provenance": {"headerLine": rg.header_line.idx, "lineRange": [rg.header_line.idx,
                       (rg.lines[-1].idx if rg.lines else rg.header_line.idx)],
                       "sourceLines": raw_lines},
    }


# ───────────────────────────────────────────────────────────── S8: test assembly
def paragraph_labels(lines):
    """Ascending A, B, C… paragraph labels (bold lead letter or bare letter line)."""
    cands = []
    for k, ln in enumerate(lines):
        if ln.kind != "text":
            continue
        m = re.match(r"^\(?([A-Z])\)?[.):]?$", ln.lead or "") if ln.lead else None
        if m and len(ln.text) > 3:
            cands.append((k, m.group(1), "lead"))
            continue
        m = re.match(r"^\s*\(?([A-Z])\)?[.):]?\s*$", ln.text)
        if m:
            cands.append((k, m.group(1), "bare"))
            continue
        m = re.match(r"^\s*([A-Z])[.)]\s+\S", ln.text)
        if m:
            cands.append((k, m.group(1), "punct"))
    seq = []
    for k, letter, how in cands:
        if letter == LETTERS[len(seq)] if len(seq) < 26 else False:
            seq.append((k, letter, how))
    return seq if len(seq) >= 2 else []


def build_passage_paragraphs(p, assets_for, reasons_out):
    labels = paragraph_labels(p.paragraphs)
    label_at = {k: (letter, how) for k, letter, how in labels}
    paras = []
    pending_label = None
    for k, ln in enumerate(p.paragraphs):
        if ln.kind == "img":
            a = assets_for(ln.img)
            paras.append({"type": "image", "asset": a["assetId"]})
            continue
        if ln.kind == "table":
            paras.append({"type": "table", "rows": ln.rows})
            continue
        if ln.role == "subheading":
            paras.append({"type": "subheading", "text": ln.text})
            continue
        text = ln.text
        if k in label_at:
            letter, how = label_at[k]
            if how == "bare":
                pending_label = letter
                continue
            text = re.sub(r"^\s*\(?" + letter + r"\)?[.):]?\s*", "", text)
            paras.append({"type": "text", "label": letter, "text": text})
            continue
        if pending_label:
            paras.append({"type": "text", "label": pending_label, "text": text})
            pending_label = None
            continue
        paras.append({"type": "text", "text": text})
    if any(ARTIFACT_RE.search(x.get("text", "")) or PASSAGE_BLANK_RE.search(x.get("text", "")) for x in paras):
        reasons_out.append("EXTRACTION_ARTIFACT")  # e.g. a question summary's blanks leaked into the passage
    return paras, [x[1] for x in labels]


def process(slug):
    is_loose = slug.endswith(".html")
    page_path = slug if is_loose else f"{slug}/index.html"
    abs_page = os.path.join(SRC_ROOT, page_path)
    raw = open(abs_page, "rb").read()
    page_sha = hashlib.sha256(raw).hexdigest()
    meta = PAGE_BY_SLUG.get(slug, {})
    test_number = int(re.search(r"(\d+)", slug).group(1))
    rec = {
        "id": FROZEN_IDS.get(slug) or f"reading.test-{test_number:04d}.{content_hash(slug, page_sha)}",
        "module": "reading", "slug": slug, "sourceNumbers": [test_number],
        "title": f"IELTS Academic Reading Test {test_number}",
        "pipelineVersion": PIPELINE_VERSION,
        "provenance": {"page": {"path": page_path, "sha256": page_sha,
                                 "manifestHashMatch": page_sha == meta.get("sha256"), "url": meta.get("url_hint")},
                        "extractionMethod": "deterministic_wordpress_lines_v2"},
        "hubEnumerated": slug in HUB_SLUGS,
        "duplicateOf": None,
        "status": None, "fullMockEligible": False,
        "answerKey": None, "passages": [], "testReasonCodes": [], "warnings": [],
    }
    html = raw.decode("utf-8", "replace")
    soup = BeautifulSoup(html, "html.parser")
    key = parse_answer_key(BeautifulSoup(html, "html.parser"))
    rec["answerKey"] = {"format": key["format"], "error": key["error"],
                        "items": [{"number": n, "raw": v} for n, v in key["items"]]}
    key_map = {n: v for n, v in key["items"]}
    if key["error"]:
        rec["testReasonCodes"].append(key["error"])

    ec = isolate_content(soup)
    if ec is None:
        rec["testReasonCodes"].append("MALFORMED_HTML")
        rec["status"] = "quarantined"
        return rec
    lines = linearise(ec)
    passages, junk = segment(lines)
    rec["junkLinesDropped"] = len(junk)

    page_dir = os.path.dirname(abs_page)
    asset_cache = {}

    def assets_for(src):
        if src in asset_cache:
            return asset_cache[src]
        rel = os.path.normpath(os.path.join(os.path.relpath(page_dir, SRC_ROOT), src.split("?")[0]))
        path = os.path.join(SRC_ROOT, rel)
        if not os.path.exists(path):
            a = {"assetId": f"asset.missing.{content_hash(rel)}", "status": "missing", "sourcePath": rel}
        else:
            sha = sha256_file(path)
            r2 = R2_READING.get(sha)
            a = {"assetId": f"asset.{sha[:12]}", "sourcePath": rel, "sha256": sha,
                 "status": "in_r2" if r2 else "not_in_r2",
                 "projectPath": "/reading-assets/" + os.path.basename(r2["r2Key"]) if r2 else None,
                 "r2Key": r2["r2Key"] if r2 else None}
        asset_cache[src] = a
        return a

    # explicit "Reading Passage N" references move a leading group to the passage
    # it belongs to (questions printed before their passage text)
    for k in range(len(passages) - 1):
        p, nxt = passages[k], passages[k + 1]
        while p.groups:
            g = p.groups[-1]
            instr = " ".join([g.rest] + [ln.text for ln in g.lines[:4] if ln.kind == "text"])
            refs = {int(x) for x in PASSAGE_REF_RE.findall(instr)}
            if refs == {k + 2} and k + 2 <= 3:
                nxt.groups.insert(0, p.groups.pop())
            else:
                break

    prose_passages = [p for p in passages if any(ln.kind == "text" and is_prose(ln) for ln in p.paragraphs)]
    if len(prose_passages) != 3 or len(passages) != 3:
        rec["testReasonCodes"].append("PASSAGE_BOUNDARY_AMBIGUOUS")
        rec["warnings"].append({"code": "PASSAGE_COUNT", "detail": {
            "passages": len(passages), "withProse": len(prose_passages),
            "titles": [p.title for p in passages]}})

    all_groups = []
    for pn, p in enumerate(passages, start=1):
        p_reasons = []
        paras, labels = build_passage_paragraphs(p, assets_for, p_reasons)
        ptokens = passage_tokens(" ".join(x.get("text", "") for x in paras))
        missing_media = [a for a in (asset_cache.get(ln.img) for ln in p.paragraphs if ln.kind == "img")
                         if a and a["status"] != "in_r2"]
        groups = []
        for g in p.groups:
            gid = f"p{pn}.q{g.start:02d}-{g.end:02d}"
            pg = parse_group(g, key_map, labels, assets_for, gid, ptokens)
            instr = (pg["instruction"] or "").lower()
            if missing_media and re.search(r"figure|diagram|graph|chart|picture|illustration|\bmap\b|image", instr):
                pg["reasonCodes"] = sorted(set(pg["reasonCodes"] + ["MEDIA_NOT_IN_R2"]))
                pg["status"] = "quarantined"
            groups.append(pg)
        all_groups.extend(groups)
        title = p.title or None
        rec["passages"].append({
            "passageNumber": pn,
            "title": title,
            "paragraphs": paras,
            "paragraphLabels": labels,
            "assets": [a for a in asset_cache.values() if any(x.get("asset") == a["assetId"] for x in paras)],
            "passageReasonCodes": sorted(set(p_reasons)) or None,
            "questionGroups": groups,
        })
        if not title:
            rec["warnings"].append({"code": "PASSAGE_TITLE_MISSING", "detail": {"passage": pn}})

    # cross-group numbering: overlapping ranges are ambiguous for both groups
    owner = {}
    for g in all_groups:
        for n in range(g["startQ"], g["endQ"] + 1):
            owner.setdefault(n, []).append(g)
    for n, gs in owner.items():
        if len(gs) > 1:
            for g in gs:
                g["reasonCodes"] = sorted(set(g["reasonCodes"] + ["DUPLICATE_QUESTION"]))
                g["status"] = "quarantined"
    # passages must own increasing, non-overlapping ranges
    last_max = 0
    for p in rec["passages"]:
        nums = [n for g in p["questionGroups"] for n in range(g["startQ"], g["endQ"] + 1)]
        if nums and min(nums) <= last_max:
            rec["testReasonCodes"].append("NUMBERING_MISMATCH")
        if nums:
            last_max = max(last_max, max(nums))

    # section passage-level artifacts quarantine the whole test (the passage is shown to the user)
    if any(p["passageReasonCodes"] for p in rec["passages"]):
        rec["testReasonCodes"].append("EXTRACTION_ARTIFACT")

    rec["testReasonCodes"] = sorted(set(rec["testReasonCodes"]))
    test_level_block = {"PASSAGE_BOUNDARY_AMBIGUOUS", "MALFORMED_HTML", "ANSWER_KEY_MISSING",
                        "ANSWER_KEY_UNPARSEABLE", "EXTRACTION_ARTIFACT", "NUMBERING_MISMATCH"}
    if set(rec["testReasonCodes"]) & test_level_block:
        for g in all_groups:
            if g["status"] == "production":
                g["status"] = "quarantined"
                g["reasonCodes"] = sorted(set(g["reasonCodes"] + ["TEST_QUARANTINED"]))

    prod_numbers = sorted(n for g in all_groups if g["status"] == "production"
                          for n in range(g["startQ"], g["endQ"] + 1))
    rec["productionQuestionNumbers"] = prod_numbers
    total = sum(g["endQ"] - g["startQ"] + 1 for g in all_groups)
    rec["metrics"] = {
        "passages": len(rec["passages"]), "groups": len(all_groups),
        "questionsInSource": total, "productionQuestions": len(prod_numbers),
        "answerKeyItems": len(key["items"]),
    }
    if not prod_numbers:
        rec["status"] = "quarantined"
    elif prod_numbers == list(range(1, 41)) and len(key["items"]) == 40 and len(rec["passages"]) == 3:
        rec["status"] = "production"
        rec["fullMockEligible"] = True
    else:
        rec["status"] = "practice_only"
    return rec


def fingerprint(rec):
    text = "\n".join(x.get("text", "") for p in rec["passages"] for x in p["paragraphs"])
    return hashlib.sha256(norm(text).lower().encode()).hexdigest() if text.strip() else None


def main():
    for sub in ("tests", "quarantine"):
        d = os.path.join(OUT, sub)
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
    slugs = sorted(p["slug"] for p in MANIFEST["page_inventory"] if p.get("template") == "academic_reading_test")
    slugs += ["ielts-reading-test-111.html"]
    records = []
    for slug in slugs:
        try:
            records.append(process(slug))
        except Exception as e:  # a crash quarantines the page, never the run
            records.append({"slug": slug, "id": None, "status": "quarantined", "passages": [],
                            "testReasonCodes": ["EXTRACTION_CRASH"], "error": repr(e)[:300],
                            "sourceNumbers": [int(re.search(r"(\d+)", slug).group(1))],
                            "metrics": {}, "fullMockEligible": False})

    # duplicates: identical passage text → keep the hub-enumerated / lowest slug
    fps = {}
    for r in records:
        fp = fingerprint(r) if r.get("passages") else None
        r["contentFingerprint"] = fp
        if fp:
            fps.setdefault(fp, []).append(r)
    for fp, rs in fps.items():
        if len(rs) > 1:
            canon = sorted(rs, key=lambda r: (not r.get("hubEnumerated"), r["slug"].endswith(".html"), r["slug"]))[0]
            for r in rs:
                if r is not canon:
                    r["duplicateOf"] = canon["slug"]
                    r["status"] = "duplicate"
                    r["fullMockEligible"] = False

    audit, pending, rows = [], {}, []
    tally, qtally, reason_q, reason_g, type_q = Counter(), Counter(), Counter(), Counter(), Counter()
    for r in records:
        json.dump(r, open(os.path.join(OUT, "tests", f"{r['slug']}.json"), "w"), indent=1, ensure_ascii=False)
        tally[r["status"]] += 1
        q_units = []
        for p in r.get("passages", []):
            for g in p["questionGroups"]:
                n_q = g["endQ"] - g["startQ"] + 1
                effective = g["status"] if r["status"] != "duplicate" else "duplicate"
                audit.append({"slug": r["slug"], "testId": r["id"], "passage": p["passageNumber"],
                              "groupId": g["groupId"], "range": [g["startQ"], g["endQ"]], "type": g["type"],
                              "answerControl": g["answerControl"], "status": effective,
                              "reasonCodes": g["reasonCodes"], "warnings": g["warnings"],
                              "provenance": {"page": r["provenance"]["page"]["path"],
                                             "sha256": r["provenance"]["page"]["sha256"],
                                             "lineRange": g["provenance"]["lineRange"]}})
                qtally[effective] += n_q
                if effective == "production":
                    type_q[g["type"]] += n_q
                if effective == "quarantined":
                    for code in g["reasonCodes"]:
                        reason_q[code] += n_q
                        reason_g[code] += 1
                    q_units.append({"unit": "group", "groupId": g["groupId"], "range": [g["startQ"], g["endQ"]],
                                    "type": g["type"], "reasonCodes": g["reasonCodes"],
                                    "instruction": (g["instruction"] or "")[:200]})
                    for f in g.get("figures") or []:
                        if f["status"] != "in_r2":
                            pending.setdefault(f.get("sha256") or f["sourcePath"], {**f, "neededBy": []})["neededBy"].append(
                                f"{r['slug']}:{g['groupId']}")
        if r.get("testReasonCodes") or q_units:
            json.dump({"slug": r["slug"], "status": r["status"], "testReasonCodes": r.get("testReasonCodes"),
                       "units": q_units}, open(os.path.join(OUT, "quarantine", f"{r['slug']}.json"), "w"),
                      indent=1, ensure_ascii=False)
        rows.append({"slug": r["slug"], "id": r.get("id"), "status": r["status"],
                     "fullMockEligible": r.get("fullMockEligible", False),
                     "productionQuestions": len(r.get("productionQuestionNumbers") or []),
                     "testReasonCodes": r.get("testReasonCodes"), "duplicateOf": r.get("duplicateOf")})

    summary = {
        "pipelineVersion": PIPELINE_VERSION,
        "sourcePages": len(records),
        "tests": dict(tally),
        "fullMockEligible": sum(1 for r in records if r.get("fullMockEligible")),
        "groups": dict(Counter(a["status"] for a in audit)),
        "questions": dict(qtally),
        "productionQuestionsByType": dict(type_q.most_common()),
        "quarantinedQuestionsByReason": dict(reason_q.most_common()),
        "quarantinedGroupsByReason": dict(reason_g.most_common()),
        "testReasonCodes": dict(Counter(c for r in records for c in r.get("testReasonCodes") or []).most_common()),
        "mediaPending": len(pending),
    }
    json.dump({**summary, "tests_index": rows}, open(os.path.join(OUT, "index.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"pipelineVersion": PIPELINE_VERSION, "groups": audit},
              open(os.path.join(OUT, "quality-audit.json"), "w"), indent=1, ensure_ascii=False)
    json.dump({"note": "Source images needed by quarantined Reading groups that are not in R2. "
                       "Upload each to r2Key cognition/images/reading/<sha256>.<ext>, add it to "
                       "content-db/media_manifest.json, and re-run the pipeline.",
               "images": sorted(pending.values(), key=lambda x: x["sourcePath"])},
              open(os.path.join(OUT, "media-pending.json"), "w"), indent=1, ensure_ascii=False)
    for stale in ("validation.json",):
        p = os.path.join(OUT, stale)
        if os.path.exists(p):
            os.remove(p)
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(process(sys.argv[1]), indent=1, ensure_ascii=False, default=str))
    else:
        main()
