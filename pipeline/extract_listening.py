#!/usr/bin/env python3
"""
Cognition — Listening extraction pilot (Phase 2).

Implements the Phase 1 architecture stages S0–S9 for the listening template,
restricted to a deliberately difficult sample. Deterministic: output is a pure
function of (source bytes, this file). No network, no LLM, no writes outside
pipeline/pilot/.
"""
import json, os, re, hashlib
from dataclasses import dataclass, field
from bs4 import BeautifulSoup, NavigableString, Tag

SRC_ROOT = "/Users/arunyagoojar/Downloads/ielts-website"
REPO = "/Users/arunyagoojar/Documents/cognition"
OUT_DIR = os.path.join(REPO, "pipeline/pilot")
MANIFEST = json.load(open(os.path.join(REPO, "docs/phase1/SOURCE_MANIFEST.json")))
PAGE_BY_SLUG = {p["slug"]: p for p in MANIFEST["page_inventory"]}
PIPELINE_VERSION = "pilot-listening-1.0.1"

SAMPLE = ["ielts-listening-test-1", "ielts-listening-test-170", "ielts-listening-test-105",
          "ielts-listening-test-35", "ielts-listening-test-172", "ielts-listening-test-61",
          "ielts-listening-test-100", "ielts-listening-test-122"]

# ---------------------------------------------------------------- helpers
DOTS = "[.…·]{2,}"
BLANK_TOK = re.compile(r"\((\d{1,2})\)")
WORD_LIMIT = re.compile(r"((?:NO MORE THAN\s+(?:\w+\s+)?(?:THREE|TWO|ONE|FOUR)\s+WORDS(?:\s+AND)?(?:\s*/?\s*OR)?(?:\s+AN?\s+NUMBER)?)|(?:ONE WORD(?:\s+ONLY)?(?:\s+OR\s+A\s+NUMBER)?)|(?:NO MORE THAN\s+.*?NUMBER))", re.I)
PART_RE = re.compile(r"^\s*(?:Part|Section)\s*([1-4])\s*:?\s*(.*)$", re.I | re.S)
GROUP_INLINE = re.compile(r"Questions?\s+(\d{1,2})(?:\s*(?:[-–‑]|and)\s*(\d{1,2}))?", re.I)
KEY_SPLIT = re.compile(r"(\d{1,2})\s*\.\s")
INPUT_ROW = re.compile(r"^(?:\(\d{1,2}\)\s*)+$")
QITEM = re.compile(r"^\s*(\d{1,2})\s*\.\s*(.+)", re.S)
LITESPEED = re.compile(r"-q7b50db1914(?=\.mp3$)")

def norm(s):
    s = s.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", s).strip()

def norm_keep_nl(s):
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" ?\n ?", "\n", s)
    return s.strip()

def content_hash(*parts):
    return hashlib.sha256("\u241f".join(parts).encode()).hexdigest()[:8]

def looks_like_instruction(text):
    return bool(re.search(r"Complete (?:the|your)|Choose (?:the correct|FIVE|FOUR|SIX|SEVEN|TWO|THREE)|Label the|Write |Look at|next to questions|from the box|Circle the|Answer the following|Decide which|Tick", text, re.I))

# ---------------------------------------------------------------- S0: loader
def load_page(slug):
    raw = open(os.path.join(SRC_ROOT, slug, "index.html"), "rb").read()
    meta = PAGE_BY_SLUG.get(slug, {})
    return {"slug": slug, "path": f"{slug}/index.html", "raw": raw, "sha256": hashlib.sha256(raw).hexdigest(),
            "manifest_sha256": meta.get("sha256"), "url": meta.get("url_hint")}

# ---------------------------------------------------------------- S2: decontamination
def decontaminate(soup, keep_key_boundary=False):
    ec = soup.find("div", class_="entry-content")
    assert ec is not None, "entry-content missing"
    for sel in ["script", "style", "ins", "iframe"]:
        for t in ec.find_all(sel):
            t.decompose()
    for t in ec.find_all("input", attrs={"type": "hidden"}):
        t.decompose()
    for t in ec.find_all("button", class_=re.compile(r"bg-showmore-plg-button")):
        if keep_key_boundary:
            t.replace_with(NavigableString("__KEY_BOUNDARY__"))
        else:
            t.decompose()
    return ec

# ---------------------------------------------------------------- S3: answer key
def parse_answer_key(soup):
    hidden = soup.find("div", id=re.compile(r"^bg-showmore-hidden-"))
    button = soup.find("button", class_=re.compile(r"bg-showmore-plg-button"))
    text = None
    if hidden is not None:
        text = norm_keep_nl(hidden.get_text("\n"))
    if not text and button is not None:
        parts = []
        for sib in button.find_all_next():
            if sib.name == "p":
                parts.append(sib.get_text("\n"))
            if sib.get("class") and any("addtoany" in c for c in sib.get("class") or []):
                break
        text = norm_keep_nl("\n".join(parts))
    if not text:
        return None
    matches = list(KEY_SPLIT.finditer(text))
    if not matches:
        # dialect C: unnumbered key — one value per line, positional order
        lines = [re.sub(r"\s+", " ", l).strip() for l in text.split("\n") if l.strip()]
        if len(lines) >= 8:
            return {"items": [(i + 1, l) for i, l in enumerate(lines)],
                    "trailing_empty": False, "keyStart": 1, "keyEnd": len(lines),
                    "keyFormat": "positional_lines", "raw": text}
        return {"raw": text, "error": "no numbered items found"}
    items = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        end = matches[i+1].start() if i + 1 < len(matches) else len(text)
        if i > 0 and n != int(matches[i-1].group(1)) + 1:
            return {"raw": text, "items_so_far": items, "error": f"key sequence breaks at {n}"}
        items.append((n, norm(text[m.end():end])))
    return {"items": items, "trailing_empty": bool(items) and items[-1][1] == "",
            "keyStart": int(matches[0].group(1)), "keyEnd": int(matches[-1].group(1)), "raw": text}

# ---------------------------------------------------------------- S5: assets
def resolve_audio(ec, test_number):
    tags = ec.find_all("audio")
    refs, dialect = [], None
    for a in tags:
        s = a.get("src")
        if not s:
            st = a.find("source", src=True)
            s = st["src"] if st else None
        if s:
            refs.append(norm(s))
    if refs:
        dialect = "A_plain_audio_src" if tags[0].get("src") else "B_wp_audio_shortcode"
    if not refs:
        return {"status": "missing", "flags": ["AUDIO_MISSING"], "refs": [], "dialect": None, "asset": None}
    flags, canon = [], []
    for r in refs:
        rel = r.replace("../", "")
        if LITESPEED.search(rel):
            base = LITESPEED.sub("", rel)
            flags.append("CACHE_VARIANT_CANONICALIZED" if os.path.exists(os.path.join(SRC_ROOT, base)) else "CACHE_VARIANT_ONLY")
            if os.path.exists(os.path.join(SRC_ROOT, base)):
                rel = base
        canon.append(rel)
    uniq = sorted(set(canon))
    chosen = uniq[0]
    exists = os.path.exists(os.path.join(SRC_ROOT, chosen))
    if not exists: flags.append("AUDIO_FILE_MISSING")
    if len(uniq) > 1: flags.append("AUDIO_AMBIGUOUS")
    m = re.match(r"(\d+)_", os.path.basename(chosen))
    if re.match(r"test-\d+", os.path.basename(chosen)):
        flags.append("AUDIO_GENERIC_NAME")
    elif m and int(m.group(1)) != test_number:
        flags.append("ASSET_PAGE_MISMATCH")
    head = open(os.path.join(SRC_ROOT, chosen), "rb").read(4) if exists else b""
    if exists and not (head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)):
        flags.append("AUDIO_HEADER_INVALID")
    if chosen and not chosen.lower().endswith(".mp3"):
        flags.append("AUDIO_EXTENSION_ANOMALY")
    return {"status": "resolved" if exists else "unresolved",
            "asset": {"originalSrc": refs[0], "resolvedPath": chosen,
                      "bytes": os.path.getsize(os.path.join(SRC_ROOT, chosen)) if exists else None,
                      "mime": "audio/mpeg"},
            "flags": sorted(set(flags)), "refs": refs, "dialect": dialect}

def resolve_images(ec):
    out = []
    seen = set()
    for img in ec.find_all("img"):
        s = img.get("data-src") or img.get("src")
        if not s or s.startswith("data:") or "wp-content" not in s: continue
        rel = s.replace("../", "")
        if rel in seen: continue
        seen.add(rel)
        out.append({"originalSrc": img.get("src"), "dataSrc": img.get("data-src"),
                    "resolvedPath": rel, "exists": os.path.exists(os.path.join(SRC_ROOT, rel)),
                    "lazyloaded": bool(img.get("data-src"))})
    return out

# ---------------------------------------------------------------- S4: structure
@dataclass
class Question:
    number: int
    qtype: str = "unknown"
    stem_plain: str = ""
    stem_segments: list = field(default_factory=list)
    options: list = field(default_factory=list)
    blank_context: str = ""
    raw_excerpt: str = ""
    element_path: str = ""
    correct_answer: object = None
    answer_found: bool = False

@dataclass
class Group:
    group_id: str
    part: int
    start_q: int
    end_q: int
    instruction_raw: str = ""
    word_limit: str = ""
    part_explicit: bool = False
    stimulus_kind: str = "none"   # none|table|notes|summary|form|map|diagram|box_match|mcq|figure
    stimulus_table: object = None
    stimulus_segments: list = field(default_factory=list)
    figure_srcs: list = field(default_factory=list)
    # repeated option blocks with no stem between them (a stem is missing in the
    # source); recorded as evidence, never rendered
    orphan_blocks: list = field(default_factory=list)
    # prose that precedes an option pool in the same block (e.g. the "Which TWO
    # …?" question of a multi-select group, or a box title)
    option_preface: list = field(default_factory=list)
    shared_options: list = field(default_factory=list)
    questions: list = field(default_factory=list)
    raw_excerpt: str = ""
    element_path: str = ""

def rich_text(el):
    for br in el.find_all("br"):
        br.replace_with("\n")
    for inp in el.find_all("input", attrs={"name": "fname"}):
        inp.replace_with("\u2426")  # site's interactive answer box = blank position
    return norm_keep_nl(el.get_text(" "))

def block_texts(el):
    out = []
    for child in el.children:
        if isinstance(child, NavigableString):
            txt = norm(str(child))
            if txt: out.append((child, txt))
        elif isinstance(child, Tag):
            if child.name == "table":
                out.append((child, "__TABLE__"))
            elif child.name == "figure":
                img = child.find("img")
                if child.find("table"):
                    out.append((child, "__TABLE__"))
                inner = norm_keep_nl(" ".join(rich_text(p) for p in child.find_all("p")))
                if inner:
                    out.append((child, inner))
                if img is not None:
                    img_url = img.get("data-src") or img.get("src")
                    if img_url and not img_url.startswith("data:"):
                        out.append((child, f"__FIGURE__ {img_url}"))
            elif child.name == "audio":
                out.append((child, "__AUDIO__"))
            elif child.name in ("ul", "ol"):
                items = [norm(li.get_text(" ")) for li in child.find_all("li")]
                out.append((child, "__LIST__ " + " \u2423 ".join(items)))
            else:
                txt = rich_text(child)
                if txt: out.append((child, txt))
                elif child.name == "div":
                    out.extend(block_texts(child))
                for img in child.find_all("img"):
                    img_url = img.get("data-src") or img.get("src")
                    if img_url and "wp-content" in img_url and not img_url.startswith("data:"):
                        out.append((child, f"__FIGURE__ {img_url}"))
    return out

def parse_table(tbl):
    rows = []
    for tr in tbl.find_all("tr"):
        cells = [norm(td.get_text(" ")) for td in tr.find_all(["td", "th"])]
        if any(cells): rows.append(cells)
    return rows

def segment_with_blanks(text):
    text = text.replace("\u2426", " ")
    segs, last = [], 0
    for m in BLANK_TOK.finditer(text):
        before = text[last:m.start()]
        rest = text[m.end():]
        dots = re.match(DOTS + r"\s*", rest)
        end = m.end() + (dots.end() if dots else 0)
        if before.strip(): segs.append(before.strip())
        segs.append({"blank": int(m.group(1))})
        last = end
    if text[last:].strip(): segs.append(text[last:].strip())
    return segs

def strip_placeholder(s):
    """The site's interactive answer-box glyphs must never reach stems/rendered text."""
    return norm((s or "").replace("\u2426", " "))

def segments_to_plain(segs):
    out = []
    for s in segs:
        out.append(" ______ " if isinstance(s, dict) else s)
    return norm(" ".join(out))

def parse_inline_mcq(text):
    """'11. stem A opt B opt C opt' → (number, stem, options)"""
    qm = QITEM.match(text)
    if not qm: return None
    number, rest = int(qm.group(1)), qm.group(2)
    letters = list(re.finditer(r"(?:^|\s)([A-J])\s+(?=\S)", rest))
    if len(letters) < 2: return None
    stem = norm(rest[:letters[0].start()])
    options = []
    for i, lm in enumerate(letters):
        end = letters[i+1].start() if i + 1 < len(letters) else len(rest)
        options.append({"letter": lm.group(1), "text": norm(rest[lm.end():end])})
    return number, stem, options

LETTER_RANGE = re.compile(r"\b([A-Z])\s*[-–‑]\s*([A-Z])\b")

def instruction_letters(instr):
    """Letters an instruction names, with ranges expanded ('A-H' → A..H).
    Standalone capitals only (so 'letter, A, B or C' → {A,B,C})."""
    out = set()
    for a, b in LETTER_RANGE.findall(instr):
        if ord(a) <= ord(b) <= ord(a) + 19:
            out.update(chr(c) for c in range(ord(a), ord(b) + 1))
    out.update(re.findall(r"(?<![A-Za-z’'])([A-T])(?![A-Za-z’'])", LETTER_RANGE.sub(" ", instr)))
    return out

def split_marker_blocks(blocks):
    """A group/part marker sometimes shares one <p> with the group's content
    (instruction + blank rows / numbered items). Split such blocks so the
    content lines are parsed as content instead of being swallowed into the
    instruction."""
    out = []
    for el, text in blocks:
        if "\n" in text and (PART_RE.match(text) or GROUP_INLINE.match(text)):
            lines = text.split("\n")
            # first line that is unambiguously question content
            cut = next((i for i, l in enumerate(lines[1:], start=1)
                        if BLANK_TOK.search(l) or "␦" in l or QITEM.match(l.strip())
                        or re.match(r"^\s*[A-J]\s+\S", l)), None)
            # keep an unpunctuated stimulus title directly above the content with the content
            while cut is not None and cut - 1 >= 2 and lines[cut - 1].strip() and \
                    not re.search(r"[.?:]", lines[cut - 1]) and not looks_like_instruction(lines[cut - 1]):
                cut -= 1
            if cut is not None and cut >= 1 and any(l.strip() for l in lines[cut:]):
                out.append((el, "\n".join(lines[:cut]).strip()))
                out.append((el, "\n".join(lines[cut:]).strip()))
                continue
        out.append((el, text))
    return out

def letter_pool_preface(text, allowed=None):
    """Prose before the first letter of the option pool parse_letter_pairs finds."""
    pairs = parse_letter_pairs(text, allowed, _with_start=True)
    if not pairs: return ""
    return norm(text[:pairs[0]["_start"]])

def parse_letter_pairs(text, allowed=None, _with_start=False):
    letter_cls = "A-J" if not allowed else "".join(sorted(allowed)).replace("-", "")
    letters = list(re.finditer(r"(?:^|\s)([" + letter_cls + r"])\s+(?=\S)", text))
    if len(letters) < 2: return None
    pairs = []
    for i, lm in enumerate(letters):
        end = letters[i+1].start() if i + 1 < len(letters) else len(text)
        pair = {"letter": lm.group(1), "text": norm(text[lm.end():end])}
        if _with_start: pair["_start"] = lm.start(1)
        pairs.append(pair)
    # an option pool lists its letters in strictly ascending order; anything else
    # (articles, initials, letters inside prose) is not a pool
    seq = [p["letter"] for p in pairs]
    for i in range(len(seq)):
        tail = seq[i:]
        if len(tail) >= 2 and all(ord(b) > ord(a) for a, b in zip(tail, tail[1:])) \
           and (not allowed or tail[0] == min(allowed)):
            return pairs[i:]
    return None

def extract(slug, page, key):
    soup = BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")
    ec = decontaminate(soup, keep_key_boundary=True)
    blocks = split_marker_blocks(block_texts(ec))
    groups, unparsed = [], []
    cur_part = 0
    g = None
    pending = {"mcq": None}
    pending_figures = []
    key_map = dict((n, v) for n, v in ((key or {}).get("items") or (key or {}).get("items_so_far") or []))

    def close_group():
        nonlocal g
        pending["mcq"] = None
        if g is not None:
            # "Decide which THREE … write the appropriate letters" groups: questions are
            # the explicit group range, answered by letters from the statement pool
            if re.search(r"Decide which|write the appropriate letters|Circle the (?:TWO|THREE) correct|Choose (?:TWO|THREE) (?:letters|answers)", g.instruction_raw, re.I) \
               and g.shared_options and not g.questions:
                for n in range(g.start_q, g.end_q + 1):
                    g.questions.append(Question(number=n, qtype="mcq_multi", stem_plain="",
                                                raw_excerpt=g.instruction_raw, element_path=g.element_path))
            for q in g.questions:
                q.correct_answer = key_map.get(q.number)
                q.answer_found = q.number in key_map
            groups.append(g)
        g = None

    def new_group(part, start, end, instruction, path, raw, part_explicit=False):
        gnew = Group(group_id=f"g{len(groups)+1:02d}", part=part, start_q=start, end_q=end,
                     instruction_raw=instruction, raw_excerpt=raw, element_path=path,
                     part_explicit=part_explicit)
        if pending_figures:
            gnew.figure_srcs.extend(pending_figures)
            pending_figures.clear()
        return gnew

    for idx, (el, text) in enumerate(blocks):
        path = f"entry-content.children[{idx}]"
        if text == "__KEY_BOUNDARY__":
            break
        if text == "__AUDIO__":
            continue
        if text.startswith("__FIGURE__"):
            fig = text.split(" ", 1)[1] if " " in text else ""
            if fig:
                fig = fig.replace("../", "")
                if g is not None:
                    if fig not in g.figure_srcs:
                        g.figure_srcs.append(fig)
                elif fig not in pending_figures:
                    pending_figures.append(fig)
            continue
        if text == "__TABLE__":
            if g is None: continue
            rows = parse_table(el)
            g.stimulus_kind = "table"
            g.stimulus_table = {"rows": rows}
            if rows and re.search(r"Tick Column|Which group", g.instruction_raw, re.I):
                g.shared_options = [{"letter": c, "text": ""} for c in rows[0][1:] if c in list("ABC")]
            for r_i, row in enumerate(rows):
                for c_i, cell in enumerate(row):
                    if re.match(r"^Example", cell, re.I): continue
                    qm = QITEM.match(cell)
                    if qm and not BLANK_TOK.search(cell) and c_i == 0 \
                       and re.search(r"Tick Column|Which group", g.instruction_raw, re.I):
                        n = int(qm.group(1))
                        if any(x.number == n for x in g.questions): continue
                        g.questions.append(Question(number=n, qtype="matching_box",
                                                    stem_plain=strip_placeholder(qm.group(2)), raw_excerpt=cell,
                                                    element_path=path))
                        continue
                    for mm in BLANK_TOK.finditer(cell):
                        n = int(mm.group(1))
                        if any(x.number == n for x in g.questions): continue
                        q = Question(number=n, qtype="completion", blank_context=f"table row {r_i+1} col {c_i+1}",
                                     raw_excerpt=cell, element_path=path)
                        q.stem_segments = segment_with_blanks(cell)
                        q.stem_plain = segments_to_plain(q.stem_segments)
                        g.questions.append(q)
            continue
        if g is not None and INPUT_ROW.match(text):
            # interactive input rows duplicate blanks already captured in tables
            if g.stimulus_table is None:
                g.stimulus_segments.append(text)
            continue
        # a part marker can share a block with input rows (site formatting); if the
        # block starts with input rows and contains a marker line, treat the marker
        m_inline = re.search(r"Part\s*([1-4])\s*:?\s*(Questions?\s+\d{1,2}(?:\s*(?:[-–‑]|and)\s*\d{1,2})?)", text)
        if m_inline and text[:6].startswith("("):
            g.stimulus_segments.append(text[:m_inline.start()].strip())
            close_group()
            cur_part = int(m_inline.group(1))
            gm = GROUP_INLINE.search(m_inline.group(2))
            start, end = int(gm.group(1)), int(gm.group(2) or gm.group(1))
            g = new_group(cur_part, start, end, "", path, text, part_explicit=True)
            continue
        # part marker opening the block (optionally with group range + instruction)
        m = PART_RE.match(text)
        if m and GROUP_INLINE.search(m.group(2) or ""):
            close_group()
            cur_part = int(m.group(1))
            rest = (m.group(2) or "").strip()
            gm = GROUP_INLINE.search(rest)
            start, end = int(gm.group(1)), int(gm.group(2) or gm.group(1))
            g = new_group(cur_part, start, end, norm(rest[gm.end():]), path, text, part_explicit=True)
            continue
        if m and norm(m.group(2) or "") == "":
            close_group()
            cur_part = int(m.group(1))
            continue
        # standalone/combined group marker with optional instruction remainder
        gm = GROUP_INLINE.match(text)
        if gm and len(gm.group(0)) > 8 and (gm.group(0).startswith("Question")):
            close_group()
            start, end = int(gm.group(1)), int(gm.group(2) or gm.group(1))
            g = new_group(cur_part, start, end, norm(text[gm.end():]), path, text)
            continue
        if g is None:
            unparsed.append({"idx": idx, "text": text[:120]})
            continue
        # ---- inside a group ----
        letters_ctx = re.search(r"choose the correct letter|circle the correct letter", g.instruction_raw, re.I)
        # non-standard letter sets (e.g. "letter G, N or E") are matching-style groups
        instr_letters = sorted(instruction_letters(g.instruction_raw))
        nonstandard_letters = bool(instr_letters) and "A" not in instr_letters
        if letters_ctx and nonstandard_letters:
            if not QITEM.match(text):
                pairs = parse_letter_pairs(text, set(instr_letters))
                if pairs:
                    g.shared_options.extend(pairs)
                    g.stimulus_kind = "box_match"
                    continue
        if letters_ctx and not nonstandard_letters:
            # line-wise state machine: stems (inline options or pending) and option
            # lines attaching to the most recently opened stem
            consumed = False
            for line in [l.strip() for l in text.split("\n") if l.strip()]:
                if QITEM.match(line) and not re.match(r"^[A-J]\s", line):
                    mcq = parse_inline_mcq(line)
                    if mcq:
                        number, stem, options = mcq
                        q = Question(number=number, qtype="mcq_single", stem_plain=strip_placeholder(stem),
                                     options=options, raw_excerpt=line, element_path=path)
                    else:
                        qm = QITEM.match(line)
                        q = Question(number=int(qm.group(1)), qtype="mcq_single",
                                     stem_plain=strip_placeholder(qm.group(2)), raw_excerpt=line,
                                     element_path=path)
                    g.questions.append(q)
                    pending["mcq"] = q
                    g.stimulus_kind = "mcq"
                    consumed = True
                elif re.match(r"^[A-J]\s*($|\s+\S)", line) and len(line) < 80:
                    lm = re.match(r"^([A-J])\s*(.*)$", line)
                    if pending["mcq"] is not None and \
                       lm.group(1) not in [o["letter"] for o in pending["mcq"].options]:
                        pending["mcq"].options.append({"letter": lm.group(1), "text": norm(lm.group(2))})
                    elif pending["mcq"] is not None:
                        # repeated option block with no stem between → stem missing in source
                        if text[:80] not in g.orphan_blocks:
                            g.orphan_blocks.append(text[:80])
                    elif text[:80] not in g.orphan_blocks:
                        g.orphan_blocks.append(text[:80])
                    consumed = True
            if consumed: continue
        if re.search(r"from the box|Choose (?:FIVE|FOUR|SIX|SEVEN|TWO|THREE)|the correct letter [A-Z](,|\s|or)", g.instruction_raw, re.I):
            if not QITEM.match(text) and not BLANK_TOK.search(text) and "\u2426" not in text:
                allowed = {c for c in instruction_letters(g.instruction_raw) if c in "ABCDEFGHIJKLMNOPQRST"}
                pairs = parse_letter_pairs(text, allowed or None)
                if pairs:
                    pre = letter_pool_preface(text, allowed or None)
                    if pre: g.option_preface.append(pre)
                    g.shared_options.extend(pairs)
                    g.stimulus_kind = "box_match"
                    continue
            added = False
            for line in text.split("\n"):
                qm = QITEM.match(line.strip())
                if qm and len(line.strip()) < 80:
                    g.questions.append(Question(number=int(qm.group(1)), qtype="matching_box",
                                                stem_plain=strip_placeholder(qm.group(2)),
                                                raw_excerpt=line.strip(),
                                                element_path=path))
                    g.stimulus_kind = "box_match"
                    added = True
            if added: continue
        if re.search(r"Label the (?:map|plan|diagram)|next to questions \d+", g.instruction_raw, re.I):
            added = False
            for line in text.split("\n"):
                qm = QITEM.match(line.strip())
                if qm and len(line.strip()) < 90:
                    kind = "map_labeling" if re.search(r"map", g.instruction_raw, re.I) else "diagram_labeling"
                    g.questions.append(Question(number=int(qm.group(1)), qtype=kind,
                                                stem_plain=strip_placeholder(qm.group(2)), raw_excerpt=line.strip(),
                                                element_path=path))
                    g.stimulus_kind = "map" if kind == "map_labeling" else "diagram"
                    added = True
            if added: continue
        if re.search(r"Decide which|write the appropriate letters|Circle the (?:TWO|THREE) correct|Choose (?:TWO|THREE) (?:letters|answers)", g.instruction_raw, re.I):
            pairs = parse_letter_pairs(text)
            if pairs:
                pre = letter_pool_preface(text)
                if pre: g.option_preface.append(pre)
                g.shared_options.extend(pairs)
                g.stimulus_kind = "box_match"
                continue
        # generic numbered-line items (short answers / sentence completion with
        # input placeholders); scan every line — blocks often open with a title
        if any(QITEM.match(l.strip()) for l in text.split("\n")):
            added = False
            for line in text.split("\n"):
                line = line.strip()
                qm = QITEM.match(line)
                if not qm:
                    if line and not looks_like_instruction(line):
                        g.stimulus_segments.append(line)
                    continue
                n = int(qm.group(1))
                if not (g.start_q <= n <= g.end_q): continue
                if any(x.number == n for x in g.questions): continue
                rest = norm(qm.group(2))
                if "\u2426" in line:
                    segs = []
                    for part in re.split(r"\u2426", rest):
                        part = part.strip()
                        if part: segs.append(part)
                        segs.append({"blank": n})
                    segs = segs[:-1] if segs and segs[-1] == {"blank": n} and rest.endswith("\u2426") is False else segs
                    segs = [s for s in segs if s]
                    q = Question(number=n, qtype="completion", blank_context=f"line: {line[:70]}",
                                 raw_excerpt=line, element_path=path)
                    q.stem_segments = segs
                    q.stem_plain = norm(rest.replace("\u2426", " ______ "))
                    q.blank_context = q.blank_context + " (input box in source)"
                else:
                    q = Question(number=n, qtype="short_answer", stem_plain=strip_placeholder(rest),
                                 raw_excerpt=line, element_path=path)
                g.questions.append(q)
                if g.stimulus_kind == "none": g.stimulus_kind = "sentences"
                added = True
            if added:
                g.stimulus_segments.append(text)
                continue
        blanks_here = [int(mm.group(1)) for mm in BLANK_TOK.finditer(text)]
        if blanks_here:
            if g.stimulus_kind == "none":
                g.stimulus_kind = "notes"
            for line in text.split("\n"):
                line = line.strip()
                if not line: continue
                line_blanks = [int(mm.group(1)) for mm in BLANK_TOK.finditer(line)]
                if not line_blanks:
                    g.stimulus_segments.append(line)
                    continue
                for n in line_blanks:
                    if any(x.number == n for x in g.questions): continue
                    q = Question(number=n, qtype="completion", blank_context=f"line: {line[:70]}",
                                 raw_excerpt=line, element_path=path)
                    q.stem_segments = segment_with_blanks(line)
                    q.stem_plain = segments_to_plain(q.stem_segments)
                    g.questions.append(q)
                # keep the complete form line in the stimulus (inline-blank rendering)
                g.stimulus_segments.append(line)
            continue
        # instruction accumulation (before content starts): instruction-like text,
        # or short prose lines; ALL-CAPS lines and unpunctuated lines are stimulus titles
        is_title = (text.upper() == text and len(text) > 8) or not re.search(r"[.?:]|\d", text)
        if looks_like_instruction(text) or \
          (not g.questions and g.stimulus_kind == "none" and
           len(text) < 140 and not re.search(r"\d", text) and not is_title):
            g.instruction_raw = (g.instruction_raw + " " + text).strip()
            wl = WORD_LIMIT.search(text)
            if wl and not g.word_limit: g.word_limit = norm(wl.group(1))
            continue
        g.stimulus_segments.append(text)
        if g.stimulus_kind == "none":
            g.stimulus_kind = "notes"
    close_group()
    return groups, unparsed, ec

# ---------------------------------------------------------------- independent blank anchors
def count_blank_anchors(ec):
    text = norm_keep_nl(ec.get_text("\n"))
    tokens = sorted({int(m.group(1)) for m in BLANK_TOK.finditer(text)})
    inputs = len(ec.find_all("input", attrs={"name": "fname"}))
    return {"blankTokens": tokens, "blankTokenCount": len(tokens), "fnameInputs": inputs}

# ---------------------------------------------------------------- S8: validation
def validate(rec, page_text):
    v = {"V1_structural": [], "V2_semantic": [], "V3_relational": [], "V4_source": [],
         "V5_completeness": [], "V6_duplicate": [], "V7_asset": []}
    def add(layer, code, detail, level="fail"):
        v[layer].append({"code": code, "level": level, "detail": detail})
    groups = rec["questionGroups"]
    qs = [q for g in groups for q in g["questions"]]
    nums = sorted(q["number"] for q in qs)
    if nums and nums != list(range(1, max(nums) + 1)):
        add("V3_relational", "NUMBERING_GAP", f"missing: {sorted(set(range(1, max(nums)+1)) - set(nums))}")
    if len(nums) != len(set(nums)):
        add("V3_relational", "NUMBERING_DUPLICATE", "duplicate question numbers")
    for g in groups:
        if g["questions"]:
            lo = min(q["number"] for q in g["questions"]); hi = max(q["number"] for q in g["questions"])
            if (lo, hi) != (g["startQ"], g["endQ"]):
                add("V3_relational", "GROUP_RANGE_MISMATCH",
                    f"{g['groupId']}: marker {g['startQ']}-{g['endQ']} vs actual {lo}-{hi}", level="warn")
            if len(g["questions"]) != g["endQ"] - g["startQ"] + 1:
                add("V3_relational", "GROUP_COUNT_MISMATCH",
                    f"{g['groupId']}: range implies {g['endQ']-g['startQ']+1}, found {len(g['questions'])}")
            if not g["instruction"]["text"]:
                add("V3_relational", "INSTRUCTION_MISSING", g["groupId"])
    key = rec["answerKey"]
    key_nums = [a["number"] for a in key["answers"]]
    unmapped = [n for n in nums if n not in key_nums]
    extra = [n for n in key_nums if n not in nums]
    if unmapped: add("V3_relational", "ANSWER_MISSING_FOR_QUESTION", f"no key item for {unmapped}")
    if extra: add("V3_relational", "ANSWER_WITHOUT_QUESTION", f"key items without question: {extra}")
    if key.get("error"): add("V3_relational", "KEY_SEQUENCE_BREAK", key["error"])
    for g in groups:
        t = g["instruction"]["text"].lower()
        for q in g["questions"]:
            if q["type"] == "mcq_single":
                letters = [o["letter"] for o in (q["options"] or [])]
                if letters and letters != [chr(ord('A') + i) for i in range(len(letters))]:
                    add("V2_semantic", "OPTION_LETTERS_NONSEQUENTIAL", f"Q{q['number']}: {letters}", level="warn")
                val = (q.get("correctAnswer") or "").strip()
                if val and letters and val.upper() not in [l.upper() for l in letters]:
                    add("V2_semantic", "ANSWER_NOT_IN_OPTIONS", f"Q{q['number']} answer {val!r}")
    anchors = rec["counts"]
    if anchors["blankTokenCount"] and nums and anchors["blankTokens"] != nums:
        add("V5_completeness", "BLANK_TOKEN_MISMATCH",
            f"page blank tokens {anchors['blankTokens']} vs question numbers {nums}", level="warn")
    if key_nums and nums and key_nums != nums:
        add("V5_completeness", "KEY_QUESTION_COUNT_MISMATCH",
            f"key {len(key_nums)} items vs {len(nums)} questions (missing {sorted(set(nums)-set(key_nums))}, extra {sorted(set(key_nums)-set(nums))})")
    for f in rec["audio"]["flags"]:
        add("V7_asset", f, "audio flag", level="warn" if f != "AUDIO_MISSING" else "fail")
    for img in rec["images"]:
        if not img["exists"]:
            add("V7_asset", "IMAGE_FILE_MISSING", img["resolvedPath"])
    raw_norm = norm(page_text)
    for g in groups:
        ex = norm(g["provenance"]["rawExcerpt"])[:60]
        if ex and ex not in raw_norm:
            add("V4_source", "EXCERPT_NOT_FOUND", g["groupId"], level="warn")
    return v

def rollup(validation):
    fails = [f"{l}:{c['code']}" for l, items in validation.items() for c in items if c["level"] == "fail"]
    warns = [f"{l}:{c['code']}" for l, items in validation.items() for c in items if c["level"] == "warn"]
    return {"status": "quarantined" if fails else ("flagged" if warns else "verified"),
            "fails": fails, "warns": warns}

# ---------------------------------------------------------------- S9: emit
def run(slug):
    page = load_page(slug)
    test_number = int(re.search(r"(\d+)$", slug).group(1))
    key_soup = BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")
    key = parse_answer_key(key_soup)
    audio = resolve_audio(decontaminate(BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")), test_number)
    images = resolve_images(decontaminate(BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")))
    anchors = count_blank_anchors(decontaminate(BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")))
    groups, unparsed, ec = extract(slug, page, key)
    key_items = (key or {}).get("items") or (key or {}).get("items_so_far") or []
    key_map = dict(key_items)
    groups_json = [{
        "groupId": g.group_id, "part": g.part, "startQ": g.start_q, "endQ": g.end_q,
        "instruction": {"text": g.instruction_raw, "wordLimit": g.word_limit},
        "stimulus": {"kind": g.stimulus_kind, "table": g.stimulus_table,
                     "segments": g.stimulus_segments or None,
                     "figures": g.figure_srcs or None,
                     "sharedOptions": g.shared_options or None},
        "questions": [{
            "number": q.number, "type": q.qtype,
            "stem": {"plain": q.stem_plain, "segments": q.stem_segments or None},
            "options": q.options or None,
            "blankContext": q.blank_context or None,
            "correctAnswer": q.correct_answer, "answerFound": q.answer_found,
        } for q in g.questions],
        "provenance": {"elementPath": g.element_path, "rawExcerpt": (g.raw_excerpt or g.instruction_raw)[:200]},
    } for g in groups]
    rec = {
        "id": f"listening.test-{test_number:04d}.{content_hash(slug, page['sha256'])}",
        "module": "listening", "sourceNumbers": [test_number], "slug": slug,
        "title": f"IELTS Listening Test {test_number}", "kind": "full_test",
        "pipelineVersion": PIPELINE_VERSION,
        "provenance": {"page": {"path": page["path"], "sha256": page["sha256"],
                                 "manifestHashMatch": page["sha256"] == page["manifest_sha256"],
                                 "url": page["url"]},
                        "extractionMethod": "deterministic_dom_v1.listening"},
        "audio": audio, "images": images,
        "answerKey": {"keyStart": (key or {}).get("keyStart"), "keyEnd": (key or {}).get("keyEnd"),
                       "trailingEmpty": (key or {}).get("trailing_empty"), "error": (key or {}).get("error"),
                       "items": [{"number": n, "value": v} for n, v in key_items],
                       "answers": [{"number": n, "value": key_map.get(n)} for n in
                                   sorted({q["number"] for g in groups_json for q in g["questions"]})]},
        "questionGroups": groups_json,
        "counts": anchors,
        "unparsed": unparsed[:20],
    }
    rec["validation"] = validate(rec, ec.get_text("\n"))
    rec["status"] = rollup(rec["validation"])
    return rec

def main():
    os.makedirs(os.path.join(OUT_DIR, "records"), exist_ok=True)
    summary = []
    for slug in SAMPLE:
        rec = run(slug)
        json.dump(rec, open(os.path.join(OUT_DIR, "records", f"{slug}.json"), "w"), indent=1, ensure_ascii=False)
        qn = len({q["number"] for g in rec["questionGroups"] for q in g["questions"]})
        row = {"slug": slug, "status": rec["status"]["status"], "groups": len(rec["questionGroups"]),
               "questions": qn, "keyItems": len(rec["answerKey"]["items"]),
               "blankTokens": rec["counts"]["blankTokenCount"], "fnameInputs": rec["counts"]["fnameInputs"],
               "audio": rec["audio"]["status"], "audioFlags": rec["audio"]["flags"],
               "audioDialect": rec["audio"]["dialect"],
               "fails": rec["status"]["fails"], "warns": rec["status"]["warns"]}
        summary.append(row)
        print(f"{slug}: {row['status']} groups={row['groups']} q={qn} key={row['keyItems']} "
              f"anchors={row['blankTokens']}/{row['fnameInputs']} audio={row['audio']}{row['audioFlags']}")
        if row["fails"]: print("   FAILS:", row["fails"])
        if row["warns"]: print("   WARNS:", row["warns"])
    json.dump(summary, open(os.path.join(OUT_DIR, "summary.json"), "w"), indent=1)

if __name__ == "__main__":
    main()
