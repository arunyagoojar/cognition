#!/usr/bin/env python3
"""
Cognition — Phase 3: production Listening extraction.

Foundation: pipeline/extract_listening.py (Phase 2 pilot, reused verbatim where proven).
Hardening per PILOT_REPORT §6.9:
  1. per-question/per-group quarantine granularity
  2. independent second cross-validation pass (answer key + segmentation evidence)
  3. frozen JSON Schema (draft 2020-12) enforced as a hard emission gate
  4. instruction-text cleanup (stimulus-title residue), original preserved
  5. audio duration validation (afinfo)
  6. corpus-wide content fingerprints + duplicate classification
  7. deterministic asset manifest (content-addressed identity, in-place resolution)
  8. Cambridge/book identity as advisory metadata (only where the source maps it)

Deterministic: output is a pure function of (source bytes, pipeline files).
"""
import json, os, re, hashlib, subprocess, sys
from collections import defaultdict
from jsonschema import Draft202012Validator

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_listening import (  # noqa: E402  (pilot core, reused)
    SRC_ROOT, REPO, MANIFEST, PAGE_BY_SLUG, load_page, parse_answer_key,
    resolve_audio, resolve_images, extract, count_blank_anchors,
    segment_with_blanks, decontaminate, content_hash, norm, parse_letter_pairs,
)

OUT = os.path.join(REPO, "content-db")
PIPELINE_VERSION = "production-listening-2.0.0"

from build_runtime import build_listening_runtime, listening_runtime_defects  # noqa: E402

# Source pages that are not standard 4-section, 40-question IELTS tests.
NON_STANDARD_TESTS = {
    "ielts-listening-test-171": ("NON_STANDARD_TEST", "section boundaries are not 10/10/10/10; 16 source questions are not extractable"),
    "ielts-listening-test-172": ("SOURCE_INCOMPLETE", "the source page has 39 questions (no Q40)"),
    "ielts-listening-test-174": ("NON_STANDARD_TEST", "old 42-question format (Q1-42)"),
}

# The same Cambridge test published twice under two slugs and two recordings,
# with key items that disagree. One record per pair is canonical; the other is
# classified duplicate with its conflicting key items kept for owner review.
# Keys are never merged.
NEAR_DUPLICATE_PAIRS = [
    ("ielts-listening-test-4", "ielts-listening-test-152"),
    ("ielts-listening-test-2", "ielts-listening-test-146"),
    ("ielts-listening-test-8", "ielts-listening-test-156"),
    ("ielts-listening-test-9", "ielts-listening-test-155"),
    ("ielts-listening-test-1", "ielts-listening-test-147"),
    ("ielts-listening-test-5", "ielts-listening-test-151"),
    ("ielts-listening-test-3", "ielts-listening-test-145"),
    ("ielts-listening-6", "ielts-listening-test-133"),
    ("ielts-listening-test-7", "ielts-listening-test-149"),
]

HUB_LISTENING = MANIFEST["hub_enumerations"]["listening"]          # authoritative enumeration
HUB_SLUGS = {e["slug"] for e in HUB_LISTENING}
BOOK_MAPS = MANIFEST["cambridge_book_mappings"]

# ---------------------------------------------------------------- eligibility
def load_loose_page(fname):
    raw = open(os.path.join(SRC_ROOT, fname), "rb").read()
    return {"slug": fname, "path": fname, "raw": raw, "sha256": hashlib.sha256(raw).hexdigest(),
            "manifest_sha256": PAGE_BY_SLUG.get(fname, {}).get("sha256"),
            "url": PAGE_BY_SLUG.get(fname, {}).get("url_hint")}

def listening_slug_list():
    """Every directory classified listening_test + the 4 loose test-111 pages."""
    slugs = set()
    for p in MANIFEST["page_inventory"]:
        if p.get("template") == "listening_test":
            slugs.add(p["slug"])
    loose = ["ielts-listening-test-111.html"]
    return sorted(slugs), loose

LOAD_LOOSE = ["ielts-listening-test-111.html"]

# ---------------------------------------------------------------- 2nd key parser (independent)
def parse_key_independent(text):
    """Different algorithm: split on item boundaries using a positional scan of
    'N.' tokens, requiring strict +1 ascent, values trimmed. Falls back to a
    line-positional parse for unnumbered key dialects. Must agree with
    parse_answer_key on every item."""
    matches = list(re.finditer(r"(?:^|\s)(\d{1,2})\.\s+", text))
    items = []
    for k, m in enumerate(matches):
        n = int(m.group(1))
        if items and n != items[-1][0] + 1:
            break
        if not items and n != 1:
            break
        end = matches[k+1].start() if k + 1 < len(matches) else len(text)
        items.append((n, norm(text[m.end():end])))
    if not items:
        lines = [norm(l) for l in text.split("\n") if l.strip()]
        if len(lines) >= 8:
            items = [(i + 1, l) for i, l in enumerate(lines)]
    return items

# ---------------------------------------------------------------- 5. audio duration
def audio_duration(path_abs):
    try:
        out = subprocess.run(["afinfo", path_abs], capture_output=True, text=True, timeout=30).stdout
        m = re.search(r"estimated duration:\s*([\d.]+)\s*sec", out)
        return float(m.group(1)) if m else None
    except Exception:
        return None

# ---------------------------------------------------------------- 8. cambridge identity
def build_identity_map():
    ident = defaultdict(list)
    for book_slug, links in BOOK_MAPS.items():
        mb = re.search(r"book-(\d+)$", book_slug)
        if not mb: continue
        book = int(mb.group(1))
        for link in links:
            label, slug = link["label"], link["slug"]
            if not re.search(r"listening", label, re.I): continue
            m1 = re.search(r"listening\s*test\s*(\d+)\.(\d+)", label, re.I)
            m2 = re.search(r"listening\s*test\s*(\d+)\s*$", label, re.I)
            if m1:
                ident[slug].append({"book": book, "test": int(m1.group(2)),
                                    "source": book_slug, "label": label})
            elif m2:
                ident[slug].append({"book": book, "test": int(m2.group(1)),
                                    "source": book_slug, "label": label})
    return ident

# ---------------------------------------------------------------- 4. instruction cleanup
def clean_instruction(instr, segments):
    """Remove stimulus-title residue from the normalized instruction while keeping
    the original in the record."""
    cleaned = instr
    removed = []
    for seg in segments or []:
        s = seg.strip()
        if s and len(s) < 80 and s in cleaned:
            cleaned = cleaned.replace(s, " ").strip()
            removed.append(s)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned, removed

# ---------------------------------------------------------------- 6. fingerprints
def content_fingerprint(groups_json, key_items):
    norm_units = []
    for g in groups_json:
        for q in g["questions"]:
            norm_units.append(f"{q['number']}|{q['type']}|{norm(q['stem'].get('plain') or '')}|{norm(str(q.get('correctAnswer') or ''))}")
    return hashlib.sha256(("\u241f".join(sorted(norm_units)) + "\u241f" + norm(str(sorted(key_items)))).encode()).hexdigest()

# ---------------------------------------------------------------- selection modelling
# Every answer control is fixed here, from source evidence only:
#   * the option pool a selection question is answered from (own options, the
#     group box, an option list printed as stimulus lines or inside the
#     instruction, or the letters printed on the group's figure);
#   * "Choose TWO/THREE letters" groups as ONE unordered selection whose slots
#     carry the source key letters (scored order-independently at runtime);
#   * free-text blanks keyed with a box letter become selection questions when
#     their pool is recoverable, otherwise they are quarantined.
# Nothing is inferred beyond what the page and its answer key state.
COUNT_WORDS = {"TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5, "SIX": 6}
SELECTION_TYPES = ("mcq_single", "mcq_multi", "matching_box", "map_labeling", "diagram_labeling")
POOL_TYPES = ("matching_box", "map_labeling", "diagram_labeling")
TEXT_TYPES = ("completion", "short_answer")
SINGLE_LETTER = re.compile(r"^[A-Z]$")
OPTION_LINE = re.compile(r"^([A-Z])(?:\s+|\s*[.):]\s*)(\S.*)$")
ORDER_NOTE = re.compile(r"\(?\b(?:in\s+)?(?:any|either)\s+order\b\)?", re.I)
BLANK_ANY = re.compile(r"\(\d{1,2}\)|␦")
INSTR_RANGE = re.compile(r"\b([A-Z])\s*[-–‑]\s*([A-Z])\b")
VISUAL_WORDS = re.compile(r"\b(?:map|plan|diagram|label|picture|floor|chart|illustration)\b", re.I)
BOX_WORDS = re.compile(r"\b(?:box|list|options)\b", re.I)


def contiguous_from_a(letters):
    return bool(letters) and letters == [chr(ord("A") + i) for i in range(len(letters))]


def segment_pool(segments):
    """Option list printed as stimulus lines ("A Louise Bagshaw" / "B Tony Denby"),
    optionally preceded by a heading line. Letters must run A, B, C… → (index,
    title, pool) or None."""
    for i, seg in enumerate(segments or []):
        lines = [l.strip() for l in seg.split("\n") if l.strip()]
        title, opts = [], []
        ok = True
        for l in lines:
            m = OPTION_LINE.match(l)
            if m and not BLANK_ANY.search(l) and len(l) < 160:
                opts.append({"letter": m.group(1), "text": norm(m.group(2))})
            elif not opts and not BLANK_ANY.search(l) and len(title) < 2:
                title.append(l)
            else:
                ok = False
                break
        if ok and len(opts) >= 2 and contiguous_from_a([o["letter"] for o in opts]):
            return i, " ".join(title), opts
    return None


def instruction_pool(instr):
    """Option list run into the instruction text ("…next to questions 21-24.
    A read other students' writing B …") → (instruction without the list, pool)."""
    m = re.search(r"(?<=[.:?])\s+A\s+(?=\S)", instr)
    if not m:
        return None
    head, tail = instr[:m.start()].strip(), instr[m.start():]
    pairs = parse_letter_pairs(tail)
    if not pairs or not contiguous_from_a([p["letter"] for p in pairs]) or len(pairs) < 2:
        return None
    rng = INSTR_RANGE.search(head)
    if rng and rng.group(1) == "A" and ord(rng.group(2)) - ord("A") + 1 != len(pairs):
        return None
    return head, [{"letter": p["letter"], "text": p["text"]} for p in pairs]


def figure_pool(g):
    """Letters printed on the group's own figure (map/plan/diagram labelling):
    'Write the correct letter A-I next to questions 16-20.'"""
    instr = g["instruction"]["text"] or ""
    if not g["stimulus"].get("figures") or not VISUAL_WORDS.search(instr):
        return None
    # an option box named in the instruction must be printed as text
    if BOX_WORDS.search(instr):
        return None
    rng = INSTR_RANGE.search(instr)
    if not rng or rng.group(1) != "A" or not (1 <= ord(rng.group(2)) - ord("A") <= 19):
        return None
    return [{"letter": chr(c), "text": ""} for c in range(ord("A"), ord(rng.group(2)) + 1)]


def find_pool(g):
    """(pool, source) for a group's shared selection pool, or (None, None)."""
    shared = g["stimulus"].get("sharedOptions") or []
    if len(shared) >= 2 and contiguous_from_a([o["letter"] for o in shared]) \
       and all(norm(o.get("text") or "") for o in shared):
        title = " ".join(g["stimulus"].get("optionPreface") or [])
        return {"source": "box", "title": title or None, "options": shared}, "box"
    sp = segment_pool(g["stimulus"].get("segments"))
    if sp:
        idx, title, opts = sp
        return {"source": "stimulus_lines", "segmentIndex": idx, "title": title or None, "options": opts}, "stimulus_lines"
    ip = instruction_pool(g["instruction"]["text"] or "")
    if ip:
        head, opts = ip
        return {"source": "instruction", "instructionText": head, "title": None, "options": opts}, "instruction"
    fp = figure_pool(g)
    if fp:
        return {"source": "figure", "title": None, "options": fp}, "figure"
    return None, None


def blank_has_context(n, g):
    """The blank (n) sits in readable stimulus text (a prose line or a table cell
    with words besides the blank), so a selection control below it is
    unambiguous."""
    texts = []
    for seg in g["stimulus"].get("segments") or []:
        texts.extend(seg.split("\n"))
    for row in (g["stimulus"].get("table") or {}).get("rows", []):
        texts.append(" ".join(row))          # the row is the blank's context
    for t in texts:
        if f"({n})" in t:
            rest = re.sub(r"\(\d{1,2}\)|␦|[.…·_]+", " ", t)
            if len(re.findall(r"[A-Za-z]{3,}", rest)) >= 1:
                return True
    return False


def plain_without_blanks(q):
    segs = q["stem"].get("segments") or []
    if segs:
        return norm(" ".join(s for s in segs if isinstance(s, str)))
    return norm(re.sub(r"_{3,}", " ", q["stem"].get("plain") or ""))


def selection_kind(g, source):
    instr = g["instruction"]["text"] or ""
    if source == "figure" or (g["stimulus"].get("figures") and VISUAL_WORDS.search(instr)):
        return "map_labeling" if re.search(r"\bmap\b", instr, re.I) else "diagram_labeling"
    return "matching_box"


def multi_letters(value):
    """Letters of one source key value for a multi-select slot: 'C', 'C, E',
    'A or D', 'C (in any order)'. None when the value is not a letter list."""
    v = ORDER_NOTE.sub(" ", value or "").strip()
    toks = [t for t in re.split(r"\s*(?:,|/|&|\band\b|\bor\b|\s)\s*", v) if t]
    if toks and all(SINGLE_LETTER.match(t) for t in toks):
        return toks
    return None


def multi_prompt(g):
    """The question a multi-select group asks: the instruction minus its
    'Choose TWO letters, A-E.' sentence, else the prose printed above the pool."""
    instr = g["instruction"]["text"] or ""
    rest = re.sub(r"^.*?\b(?:letters?|answers?)\b[^.?]*?(?:[A-Z]\s*[-–‑]\s*[A-Z]|[A-Z](?:\s*,\s*[A-Z])*(?:\s*,?\s*(?:or|and)\s+[A-Z])?)?\s*[.:]\s*",
                  "", instr, count=1, flags=re.S).strip()
    if rest != instr and len(re.findall(r"[A-Za-z]{2,}", rest)) >= 3:
        return instr[:len(instr) - len(rest)].strip(), rest
    pre = " ".join(g["stimulus"].get("optionPreface") or []).strip()
    if len(re.findall(r"[A-Za-z]{2,}", pre)) >= 3:
        return instr, pre
    return instr, None


def model_group(g):
    """Fix the answer control of every question in the group. Returns a list of
    group-level reason codes (empty when the group is usable)."""
    g_reasons = []
    qs = g["questions"]
    if g.get("orphanOptionBlocks"):
        g_reasons.append("ORPHAN_OPTION_BLOCK")
    for q in qs:
        q["_pre"] = []
        q["keyRaw"] = q.get("correctAnswer")

    # ---- "Choose TWO/THREE letters": one unordered selection over the group's slots
    multi = [q for q in qs if q["type"] == "mcq_multi"]
    if multi:
        reasons = []
        if len(multi) != len(qs):
            reasons.append("MULTI_GROUP_MIXED_TYPES")
        nums = sorted(q["number"] for q in multi)
        instr_head, prompt = multi_prompt(g)
        cw = re.search(r"\b(TWO|THREE|FOUR|FIVE|SIX)\b", g["instruction"]["text"] or "")
        count = COUNT_WORDS.get(cw.group(1)) if cw else None
        if count != len(nums):
            reasons.append("MULTI_COUNT_MISMATCH")
        if nums != list(range(nums[0], nums[0] + len(nums))):
            reasons.append("MULTI_SLOTS_NOT_CONSECUTIVE")
        pool = g["stimulus"].get("sharedOptions") or []
        letters = [o["letter"] for o in pool]
        if len(pool) <= len(nums) or not contiguous_from_a(letters):
            reasons.append("OPTIONS_MISSING")
        elif any(not norm(o.get("text") or "") for o in pool):
            reasons.append("OPTION_TEXT_EMPTY")
        if not prompt and not (g["stimulus"].get("segments")):
            reasons.append("MULTI_PROMPT_MISSING")
        per_slot = [multi_letters(q["keyRaw"]) for q in sorted(multi, key=lambda x: x["number"])]
        answer_set = None
        if all(p and len(p) == 1 for p in per_slot):
            answer_set = [p[0] for p in per_slot]                        # one letter per number
        elif per_slot and all(p == per_slot[0] for p in per_slot) and per_slot[0] and len(per_slot[0]) == len(nums):
            answer_set = list(per_slot[0])                                # the set repeated on each number
        if answer_set is None:
            reasons.append("MULTI_KEY_UNRESOLVED")
        else:
            if len(set(answer_set)) != len(answer_set):
                reasons.append("MULTI_KEY_DUPLICATE_LETTERS")
            if letters and any(a not in letters for a in answer_set):
                reasons.append("ANSWER_NOT_IN_OPTIONS")
        if reasons:
            for q in multi:
                q["_pre"].extend(reasons)
        else:
            for q, letter in zip(sorted(multi, key=lambda x: x["number"]), answer_set):
                q["correctAnswer"] = letter
            g["selection"] = {"mode": "multi", "selectCount": len(nums),
                              "unorderedGroup": f"{g['groupId']}:{nums[0]}-{nums[-1]}",
                              "answerSet": sorted(answer_set), "prompt": prompt,
                              "instructionText": instr_head}
            g["optionPool"] = {"source": "box", "title": None, "options": pool}
        return g_reasons

    # ---- single selections answered from a shared pool, including free-text
    # blanks whose source key is a box letter
    letter_text = [q for q in qs if q["type"] in TEXT_TYPES and SINGLE_LETTER.match((q["keyRaw"] or "").strip())]
    pooled = [q for q in qs if q["type"] in POOL_TYPES and not q.get("options")]
    if letter_text or pooled:
        pool, source = find_pool(g)
        if pool is None:
            for q in letter_text:
                q["_pre"].append("LETTER_KEY_ON_TEXT_QUESTION")
            for q in pooled:
                q["_pre"].append("OPTIONS_MISSING")
        else:
            g["optionPool"] = pool
            kind = selection_kind(g, source)
            for q in letter_text:
                q["convertedFrom"] = q["type"]
                q["type"] = kind
                stem = plain_without_blanks(q)
                q["stem"] = {"plain": stem, "segments": None}
                if not stem and not blank_has_context(q["number"], g) and source != "figure" \
                   and not g["stimulus"].get("figures"):
                    q["_pre"].append("STEM_MISSING_IN_SOURCE")
    return g_reasons


# ---------------------------------------------------------------- 1+2. per-unit validation
ARTIFACT = re.compile(r"\[orphan|Show Answers?|<[a-zA-Z/][^>]*>|␦")


def selection_pool_for(q, g):
    if q.get("options"):
        return q["options"]
    return (g.get("optionPool") or {}).get("options") or []


def validate_units(record, page_text, key2_items):
    """Returns (quarantined_units, warnings). Unit = question, group or test.
    The smallest possible unit is quarantined; whether the TEST ships is decided
    afterwards by the full-test gate (40/40 verified questions, 1–40 in 4 parts)."""
    quar = []
    warns = []
    groups = record["questionGroups"]
    key2 = dict(key2_items)
    anchors = set(record["counts"]["blankTokens"])
    ranges = [(g["startQ"], g["endQ"]) for g in groups]

    def evidence_count(n, g):
        ev = 0
        if any(a <= n <= b for a, b in ranges): ev += 1          # marker range
        if n in key2: ev += 1                                     # independent key
        if n in anchors: ev += 1                                  # blank token
        return ev

    for g in groups:
        g_reasons = list(g.pop("_groupReasons", []))
        if not g["instruction"]["text"]:
            g_reasons.insert(0, "INSTRUCTION_MISSING")
        if g_reasons:
            quar.append({"unit": "group", "groupId": g["groupId"], "questionNumbers": [q["number"] for q in g["questions"]],
                         "reasonCode": g_reasons[0], "reasonCodes": g_reasons,
                         "evidence": {"instructionRaw": g["provenance"]["rawExcerpt"][:200],
                                      "orphanOptionBlocks": g.get("orphanOptionBlocks")}})
            g["status"] = "quarantined"
            for q in g["questions"]:
                q.pop("_pre", None)
                q["status"] = "quarantined"
            continue
        g["status"] = "verified"
        for q in g["questions"]:
            q_reasons = list(q.pop("_pre", []))
            ans = q.get("correctAnswer")
            raw = q.get("keyRaw", ans)
            a = (ans or "").strip()
            if not q.get("answerFound"):
                q_reasons.append("ANSWER_MISSING")
            elif ans is None or a == "":
                q_reasons.append("ANSWER_EMPTY_IN_KEY")
            if q["type"] in SELECTION_TYPES and a:
                pool = selection_pool_for(q, g)
                letters = [o["letter"] for o in pool]
                if len(pool) < 2:
                    q_reasons.append("OPTIONS_MISSING")
                if len(letters) != len(set(letters)):
                    q_reasons.append("OPTION_LETTERS_DUPLICATED")
                if q["type"] == "mcq_single" and any(not norm(o.get("text") or "") for o in pool):
                    q_reasons.append("OPTION_TEXT_EMPTY")
                if not SINGLE_LETTER.match(a):
                    q_reasons.append("MULTI_LETTER_KEY_ON_SINGLE_SELECT" if multi_letters(a) else "KEY_NOT_A_LETTER")
                elif pool and a not in letters:
                    q_reasons.append("ANSWER_NOT_IN_OPTIONS")
                if q["type"] == "mcq_single" and not norm(q["stem"].get("plain") or ""):
                    q_reasons.append("STEM_MISSING_IN_SOURCE")
            if q["type"] in TEXT_TYPES and a:
                if multi_letters(a):
                    q_reasons.append("LETTER_KEY_ON_TEXT_QUESTION")
                elif re.search(r"[A-Za-z]\s*,\s*\S|\d\s*,\s+\S", a):
                    q_reasons.append("KEY_LIST_AMBIGUOUS")       # "stone, copper": order/completeness unstated
                elif re.search(r"\s(?:or|OR)\s", a):
                    q_reasons.append("KEY_OR_AMBIGUOUS")
            if evidence_count(q["number"], g) < 2:
                q_reasons.append("SEGMENTATION_UNPROVEN")
            if q["type"] in TEXT_TYPES and not norm(q["stem"].get("plain") or "") and not q["stem"].get("segments"):
                q_reasons.append("STEM_MISSING_IN_SOURCE")
            texts = [q["stem"].get("plain") or ""] + [o.get("text") or "" for o in (q.get("options") or [])]
            if any(ARTIFACT.search(t) for t in texts):
                q_reasons.append("TEXT_ARTIFACT")
            # independent key value equality
            if raw and key2.get(q["number"]) is not None and norm(str(raw)).lower() != norm(key2[q["number"]]).lower():
                q_reasons.append("KEY_PARSE_DISAGREEMENT")
            if q_reasons:
                q_reasons = list(dict.fromkeys(q_reasons))
                q["status"] = "quarantined"
                g["status"] = "flagged"
                quar.append({"unit": "question", "groupId": g["groupId"], "questionNumber": q["number"],
                             "reasonCode": q_reasons[0], "reasonCodes": q_reasons,
                             "evidence": {"stem": q["stem"].get("plain"), "answer": raw,
                                          "rawExcerpt": (q.get("provenance") or {}).get("rawExcerpt", "")[:160],
                                          "options": q.get("options") or (g.get("optionPool") or {}).get("options")}})
            else:
                q["status"] = "verified"
        # a multi-select group scores as one unit: every slot verified or none
        if g.get("selection") and any(q["status"] != "verified" for q in g["questions"]):
            for q in g["questions"]:
                if q["status"] == "verified":
                    q["status"] = "quarantined"
                    quar.append({"unit": "question", "groupId": g["groupId"], "questionNumber": q["number"],
                                 "reasonCode": "MULTI_GROUP_INCOMPLETE", "reasonCodes": ["MULTI_GROUP_INCOMPLETE"],
                                 "evidence": {"answer": q.get("keyRaw")}})
    # source questions that no group extracted are quarantined explicitly, never dropped
    have = {q["number"] for g in groups for q in g["questions"]}
    key_values = dict((i["number"], i["value"]) for i in record["answerKey"]["items"])
    for n in sorted(set(key_values) - have):
        quar.append({"unit": "question", "groupId": None, "questionNumber": n,
                     "reasonCode": "QUESTION_NOT_EXTRACTED", "reasonCodes": ["QUESTION_NOT_EXTRACTED"],
                     "evidence": {"keyValue": key_values.get(n)}})
    # a full IELTS listening test is exactly 1-40
    key_nums = sorted(key_values)
    if key_nums != list(range(1, 41)):
        quar.append({"unit": "test", "reasonCode": "NON_STANDARD_NUMBERING",
                     "evidence": {"keyNumbers": [key_nums[0], key_nums[-1], len(key_nums)] if key_nums else []}})
    # audio flags: file-level
    for f in record["audio"]["flags"]:
        if f in ("AUDIO_MISSING",):
            quar.append({"unit": "test", "reasonCode": "AUDIO_MISSING", "evidence": record["audio"]["refs"]})
        else:
            warns.append({"layer": "V7_asset", "code": f, "detail": "audio relationship flag"})
    for img in record["images"]:
        if not img["exists"]:
            quar.append({"unit": "asset", "reasonCode": "IMAGE_FILE_MISSING", "evidence": img})
    return quar, warns


# ---------------------------------------------------------------- R2 media (production source)
MEDIA_MANIFEST = json.load(open(os.path.join(REPO, "content-db", "media_manifest.json")))
R2_KEYS = {m["r2Key"] for m in MEDIA_MANIFEST["media"]}


def r2_key(app_path):
    """Mirror of src/utils/media.js resolveMediaUrl → R2 object key (unencoded)."""
    clean = (app_path or "").lstrip("/")
    m = re.match(r"^wp-content/uploads/audio/(.+\.mp3)$", clean)
    if m: return f"cognition/audio/listening/{m.group(1)}"
    if "lis-test" in clean: return f"cognition/images/listening/{clean.split('/')[-1]}"
    m = re.match(r"^wp-content/uploads/\d{4}/\d{2}/(.+\.(?:png|webp|jpg|jpeg))$", clean)
    if m: return f"cognition/images/writing/{m.group(1)}"
    base = clean.split("/")[-1]
    if re.search(r"\.(png|webp|jpg|jpeg|gif)$", base, re.I): return f"cognition/images/writing/{base}"
    return clean


# ---------------------------------------------------------------- 3. schema
LISTENING_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Cognition Production Listening Test",
    "type": "object",
    "required": ["id", "module", "sourceNumbers", "slug", "title", "kind", "pipelineVersion",
                 "provenance", "audio", "answerKey", "questionGroups", "status"],
    "properties": {
        "id": {"type": "string", "pattern": "^listening\\.test-\\d+\\.[0-9a-f]{8}$"},
        "module": {"const": "listening"},
        "sourceNumbers": {"type": "array", "minItems": 1, "items": {"type": "integer", "minimum": 1, "maximum": 999}},
        "slug": {"type": "string"},
        "title": {"type": "string"},
        "kind": {"const": "full_test"},
        "pipelineVersion": {"type": "string"},
        "provenance": {
            "type": "object",
            "required": ["page", "extractionMethod"],
            "properties": {
                "page": {"type": "object", "required": ["path", "sha256"],
                          "properties": {"path": {"type": "string"}, "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
                                          "manifestHashMatch": {"type": "boolean"}, "url": {"type": ["string", "null"]}}},
                "extractionMethod": {"type": "string"},
            },
        },
        "cambridgeIdentity": {"type": "array", "items": {"type": "object", "required": ["book", "test"],
                                                         "properties": {"book": {"type": "integer"}, "test": {"type": "integer"},
                                                                         "source": {"type": "string"}, "label": {"type": "string"}}}},
        "hubEnumerated": {"type": "boolean"},
        "duplicateOf": {"type": ["string", "null"]},
        "contentFingerprint": {"type": "string"},
        "audio": {"type": "object", "required": ["status", "flags", "refs"],
                   "properties": {"status": {"enum": ["resolved", "missing", "unresolved"]},
                                   "asset": {"type": ["object", "null"]},
                                   "durationSeconds": {"type": ["number", "null"]},
                                   "flags": {"type": "array", "items": {"type": "string"}},
                                   "refs": {"type": "array"}, "dialect": {"type": ["string", "null"]}}},
        "images": {"type": "array"},
        "answerKey": {"type": "object", "required": ["items"],
                       "properties": {"items": {"type": "array"}, "answers": {"type": "array"},
                                       "trailingEmpty": {"type": ["boolean", "null"]}, "error": {"type": ["string", "null"]}}},
        "questionGroups": {
            "type": "array", "minItems": 1,
            "items": {
                "type": "object", "required": ["groupId", "part", "startQ", "endQ", "instruction", "stimulus", "questions", "status"],
                "properties": {
                    "groupId": {"type": "string"},
                    "part": {"type": ["integer", "null"], "minimum": 0, "maximum": 4},
                    "startQ": {"type": "integer"}, "endQ": {"type": "integer"},
                    "instruction": {"type": "object", "required": ["text"],
                                     "properties": {"text": {"type": "string"}, "wordLimit": {"type": "string"},
                                                     "removedResidue": {"type": "array"}}},
                    "stimulus": {"type": "object", "required": ["kind"],
                                  "properties": {"kind": {"type": "string"}, "table": {"type": ["object", "null"]},
                                                  "segments": {"type": ["array", "null"]},
                                                  "figures": {"type": ["array", "null"]},
                                                  "sharedOptions": {"type": ["array", "null"]}}},
                    "questions": {"type": "array", "items": {
                        "type": "object", "required": ["number", "type", "stem", "status", "provenance"],
                        "properties": {
                            "number": {"type": "integer", "minimum": 1, "maximum": 60},
                            "type": {"enum": ["completion", "mcq_single", "mcq_multi", "matching_box",
                                               "map_labeling", "diagram_labeling", "short_answer"]},
                            "stem": {"type": "object", "properties": {"plain": {"type": "string"}, "segments": {"type": ["array", "null"]}}},
                            "options": {"type": ["array", "null"]},
                            "blankContext": {"type": ["string", "null"]},
                            "correctAnswer": {"type": ["string", "null"]},
                            "answerFound": {"type": "boolean"},
                            "status": {"enum": ["verified", "quarantined"]},
                            "provenance": {"type": "object", "required": ["rawExcerpt"],
                                            "properties": {"elementPath": {"type": "string"}, "rawExcerpt": {"type": "string"}}},
                        }}},
                    "provenance": {"type": "object"},
                },
            },
        },
        "counts": {"type": "object"},
        "status": {"enum": ["verified", "quarantined", "duplicate"]},
        "fullTestEligible": {"type": "boolean"},
        "validationWarnings": {"type": "array"},
        "quarantinedCount": {"type": "integer"},
        "verifiedQuestionCount": {"type": "integer"},
    },
}
SCHEMA_VALIDATOR = Draft202012Validator(LISTENING_SCHEMA)

# ---------------------------------------------------------------- per-test pipeline

# ---------------------------------------------------------------- owner-reviewed key corrections
_CORR_PATH = os.path.join(REPO, "content-db", "listening", "key-corrections.json")
KEY_CORRECTIONS = json.load(open(_CORR_PATH))["corrections"] if os.path.exists(_CORR_PATH) else []


def apply_key_corrections(slug, key):
    """Fixes recorded source-key misspellings. A correction applies only when
    the source still says exactly what was reviewed; the original is kept."""
    applied = []
    if not key:
        return applied
    for field in ("items", "items_so_far"):
        items = key.get(field)
        if not items:
            continue
        for i, (n, v) in enumerate(items):
            for c in KEY_CORRECTIONS:
                if c["slug"] == slug and c["number"] == n and norm(v).lower() == c["source"].lower():
                    items[i] = (n, c["corrected"])
                    applied.append({"number": n, "source": v, "corrected": c["corrected"],
                                    "reason": c["reason"], "approvedBy": c["approvedBy"]})
    return applied


def process(slug, page_loader):
    from bs4 import BeautifulSoup as BS
    page = page_loader(slug)
    test_number_m = re.search(r"(\d+)", slug)
    test_number = int(test_number_m.group(1)) if test_number_m else 0
    raw_text = page["raw"].decode("utf-8", "replace")
    key = parse_answer_key(BS(raw_text, "html.parser"))
    applied_corrections = apply_key_corrections(slug, key)
    audio = resolve_audio(decontaminate(BS(raw_text, "html.parser")), test_number)
    images = resolve_images(decontaminate(BS(raw_text, "html.parser")))
    groups, unparsed, ec = extract(slug, page, key)
    anchors = count_blank_anchors(decontaminate(BS(raw_text, "html.parser")))

    key_items = (key or {}).get("items") or (key or {}).get("items_so_far") or []
    key_map = dict(key_items)

    # independent second key parse (from raw hidden text or post-button region)
    key2_items = []
    if key and key.get("raw"):
        key2_items = parse_key_independent(key["raw"])
        fixes = {c["number"]: c["corrected"] for c in applied_corrections}
        key2_items = [(n, fixes.get(n, v)) for n, v in key2_items]

    groups_json = []
    quar_pre = []
    for g in groups:
        cleaned_instr, removed = clean_instruction(g.instruction_raw, g.stimulus_segments)
        gj = {
            "groupId": g.group_id, "part": g.part or None, "startQ": g.start_q, "endQ": g.end_q,
            "partExplicit": bool(g.part_explicit),
            "instruction": {"text": cleaned_instr, "wordLimit": g.word_limit, "removedResidue": removed,
                             "originalText": g.instruction_raw},
            "stimulus": {"kind": g.stimulus_kind, "table": g.stimulus_table,
                          "segments": g.stimulus_segments or None,
                          "figures": g.figure_srcs or None,
                          "sharedOptions": g.shared_options or None,
                          "optionPreface": g.option_preface or None},
            "orphanOptionBlocks": g.orphan_blocks or None,
            "questions": [{
                "number": q.number, "type": q.qtype,
                "stem": {"plain": q.stem_plain, "segments": q.stem_segments or None},
                "options": q.options or None,
                "blankContext": q.blank_context or None,
                "correctAnswer": q.correct_answer, "answerFound": q.answer_found,
                "status": "verified",
                "provenance": {"elementPath": q.element_path, "rawExcerpt": (q.raw_excerpt or "")[:200]},
            } for q in g.questions],
            "provenance": {"elementPath": g.element_path, "rawExcerpt": (g.raw_excerpt or g.instruction_raw)[:200]},
        }
        groups_json.append(gj)

    rec = {
        "id": FROZEN_IDS.get(slug) or f"listening.test-{test_number:04d}.{content_hash(slug, page['sha256'])}",
        "module": "listening", "sourceNumbers": [test_number], "slug": slug,
        "title": f"IELTS Listening Test {test_number}", "kind": "full_test",
        "pipelineVersion": PIPELINE_VERSION,
        "provenance": {"page": {"path": page["path"], "sha256": page["sha256"],
                                 "manifestHashMatch": page["sha256"] == page["manifest_sha256"],
                                 "url": page["url"]},
                        "extractionMethod": "deterministic_dom_v2.listening"},
        "cambridgeIdentity": [], "hubEnumerated": slug in HUB_SLUGS or slug in ("ielts-listening-test-111.html",),
        "duplicateOf": None, "contentFingerprint": content_fingerprint(groups_json, key_items),
        "audio": audio, "images": images,
        "answerKey": {"keyStart": (key or {}).get("keyStart"), "keyEnd": (key or {}).get("keyEnd"),
                       "trailingEmpty": (key or {}).get("trailing_empty"), "error": (key or {}).get("error"),
                       "independentParseCount": len(key2_items),
                       "items": [{"number": n, "value": v} for n, v in key_items],
                       "corrections": applied_corrections or None,
                       "answers": [{"number": n, "value": key_map.get(n)} for n in
                                   sorted({q["number"] for g in groups_json for q in g["questions"]})]},
        "questionGroups": groups_json,
        "counts": anchors,
        "unparsed": unparsed[:20],
    }
    # audio duration
    if audio.get("asset") and audio["asset"].get("resolvedPath"):
        dur = audio_duration(os.path.join(SRC_ROOT, audio["asset"]["resolvedPath"]))
        rec["audio"]["durationSeconds"] = dur
        flags = set(rec["audio"]["flags"])
        if dur is not None and dur < 300: flags.add("AUDIO_DURATION_SHORT")
        if dur is None: flags.add("AUDIO_DURATION_UNKNOWN")
        rec["audio"]["flags"] = sorted(flags)
    # cambridge identity (advisory, only where the book pages map it)
    rec["cambridgeIdentity"] = IDENTITY.get(slug, [])

    # shared-stimulus merge: a group whose stimulus is only interactive input rows
    # (no table, no prose) duplicates blanks already present in the previous group's
    # stimulus — merge it so each question is listed exactly once.
    INPUT_ROW_ONLY = re.compile(r"^(?:\(\d{1,2}\)[….…·\s\u2426]*)+$")
    merged_into = {}
    gi = 1
    while gi < len(groups_json):
        gB = groups_json[gi]
        segs = [s for s in (gB["stimulus"].get("segments") or [])]
        rows_only = (not gB["stimulus"].get("table")) and segs and all(INPUT_ROW_ONLY.match(s.strip()) for s in segs)
        if rows_only and gi > 0:
            gA = groups_json[gi - 1]
            numsB = {q["number"] for q in gB["questions"]}
            segsA_text = " ".join(gA["stimulus"].get("segments") or []) + " " + json.dumps(gA["stimulus"].get("table") or {})
            covered = all(f"({n})" in segsA_text for n in numsB) and numsB
            if covered:
                have = {q["number"] for q in gA["questions"]}
                gA["questions"].extend(q for q in gB["questions"] if q["number"] not in have)
                gA["questions"].sort(key=lambda q: q["number"])
                lo = min(gA["startQ"], gB["startQ"]); hi = max(gA["endQ"], gB["endQ"])
                gA["markerRange"] = [gA["startQ"], gA["endQ"]]
                gA["startQ"], gA["endQ"] = lo, hi
                gA["mergedGroups"] = (gA.get("mergedGroups") or []) + [gB["groupId"]]
                groups_json.pop(gi)
                continue
        gi += 1

    # part assignment for groups that never saw an explicit part marker:
    # standard IELTS listening section boundaries, unless the test's explicit
    # markers conflict. Every assignment by this rule is recorded.
    for g in groups_json:
        if g["part"] is not None and g.get("partExplicit"):
            continue
        s = g["startQ"]
        boundary = 1 if s <= 10 else 2 if s <= 20 else 3 if s <= 30 else 4
        if g["part"] != boundary:
            g["part"] = boundary
            g["partAssignedBy"] = "section_boundary_rule"
        elif g.get("partExplicit") is False:
            g["partAssignedBy"] = "inherited_no_marker"
    for g in groups_json:
        if g["part"] is not None and g.get("partExplicit"):
            if not (1 <= g["part"] <= 4):
                g["partExplicitWarning"] = "unusual part number"
            if g["part"] != (1 if g["startQ"] <= 10 else 2 if g["startQ"] <= 20 else 3 if g["startQ"] <= 30 else 4):
                g["partUnusual"] = True

    # group-range reconciliation + cross-group question deduplication.
    # Shared stimulus tables can feed questions to several group splits; assign each
    # question number to exactly one group: the one whose original marker range
    # claims it, else the earliest group containing it. Then reconcile ranges.
    from collections import defaultdict as _dd
    num_owners = _dd(list)
    for gi, g in enumerate(groups_json):
        for q in g["questions"]:
            num_owners[q["number"]].append(gi)
    for n, owners in num_owners.items():
        if len(owners) > 1:
            keeper = None
            for gi in owners:
                g = groups_json[gi]
                if g["startQ"] <= n <= g["endQ"]:
                    keeper = gi; break
            if keeper is None:
                keeper = owners[0]
            for gi in owners:
                if gi != keeper:
                    groups_json[gi]["questions"] = [q for q in groups_json[gi]["questions"] if q["number"] != n]
    for gi, g in enumerate(groups_json):
        nums = [q["number"] for q in g["questions"]]
        if not nums: continue
        lo, hi = min(nums), max(nums)
        if (lo, hi) != (g["startQ"], g["endQ"]):
            overlaps = any(not (hi < og["startQ"] or lo > og["endQ"])
                           for oi, og in enumerate(groups_json) if oi != gi and og["questions"])
            if not overlaps:
                g["markerRange"] = [g["startQ"], g["endQ"]]
                g["startQ"], g["endQ"] = lo, hi
                g["rangeReconciled"] = True
    # drop phantom groups left with no questions after dedup (evidence preserved in quarantine)
    dropped = [g for g in groups_json if not g["questions"]]
    for g in dropped:
        quar_pre.append({"unit": "group", "groupId": g["groupId"],
                          "reasonCode": "PHANTOM_SPLIT_MERGED",
                          "evidence": {"markerRange": g.get("markerRange"), "range": [g["startQ"], g["endQ"]]}})
    groups_json = [g for g in groups_json if g["questions"]]
    rec["questionGroups"] = groups_json

    # answer controls (selection pools, multi-select groups, letter-keyed blanks)
    for g in groups_json:
        g["_groupReasons"] = model_group(g)
        # every figure a group shows must be served from R2
        missing = [f for f in (g["stimulus"].get("figures") or []) if r2_key("/" + f) not in R2_KEYS]
        if missing:
            g["_groupReasons"].append("IMAGE_NOT_IN_R2")
            g["figuresNotInR2"] = missing

    # per-unit validation
    page_text = ec.get_text("\n")
    quar, warns = validate_units(rec, page_text, key2_items)
    quar = quar_pre + quar
    nq = [q for g in groups_json for q in g["questions"]]
    verified = [q for q in nq if q["status"] == "verified"]

    # ---- full-test gate: only complete, fully verified 1–40 tests ship
    test_units = []
    if slug in NON_STANDARD_TESTS:
        test_units.append({"unit": "test", "reasonCode": NON_STANDARD_TESTS[slug][0],
                           "evidence": {"note": NON_STANDARD_TESTS[slug][1]}})
    a_asset = audio.get("asset") or {}
    if audio.get("status") != "resolved" or not a_asset.get("resolvedPath"):
        test_units.append({"unit": "test", "reasonCode": "AUDIO_MISSING", "evidence": audio.get("refs")})
    elif r2_key("/" + a_asset["resolvedPath"]) not in R2_KEYS:
        test_units.append({"unit": "test", "reasonCode": "AUDIO_NOT_IN_R2",
                           "evidence": {"resolvedPath": a_asset["resolvedPath"],
                                        "r2Key": r2_key("/" + a_asset["resolvedPath"])}})
    misplaced = sorted(q["number"] for g in groups_json for q in g["questions"]
                       if q["status"] == "verified" and g["part"] != (q["number"] - 1) // 10 + 1)
    if misplaced:
        test_units.append({"unit": "test", "reasonCode": "NON_STANDARD_SECTION_LAYOUT",
                           "evidence": {"questionsOutsideTheirSection": misplaced}})
    v_nums = sorted(q["number"] for q in verified)
    if v_nums != list(range(1, 41)):
        test_units.append({"unit": "test", "reasonCode": "INCOMPLETE_TEST",
                           "evidence": {"verifiedQuestions": len(v_nums),
                                        "missingOrQuarantined": sorted(set(range(1, 41)) - set(v_nums)),
                                        "outOfRange": [n for n in v_nums if not 1 <= n <= 40]}})
    quar = [u for u in quar if u["unit"] != "test" or u["reasonCode"] not in {t["reasonCode"] for t in test_units}] + test_units

    rec["quarantinedUnits"] = quar
    rec["validationWarnings"] = warns
    rec["verifiedQuestionCount"] = len(verified)
    rec["quarantinedCount"] = len(quar)
    rec["status"] = "quarantined" if any(u["unit"] == "test" for u in quar) else "verified"
    rec["fullTestEligible"] = rec["status"] == "verified"

    # render gate: the runtime object built from this record must pass every
    # structural/artifact check the app relies on
    if rec["status"] == "verified":
        defects = listening_runtime_defects(build_listening_runtime(json.loads(json.dumps(rec))))
        if defects:
            rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "RENDER_CHECK_FAILED",
                                            "evidence": {"defects": defects[:20]}})
            rec["quarantinedCount"] = len(rec["quarantinedUnits"])
            rec["status"] = "quarantined"
            rec["fullTestEligible"] = False

    # schema hard gate
    errors = sorted(SCHEMA_VALIDATOR.iter_errors(rec), key=lambda e: e.path)
    if errors:
        rec["schemaErrors"] = [f"{list(e.path)}: {e.message[:200]}" for e in errors[:10]]
        rec["quarantinedUnits"].append({"unit": "test", "reasonCode": "SCHEMA_INVALID",
                                        "evidence": {"errors": rec["schemaErrors"]}})
        rec["status"] = "quarantined"
        rec["fullTestEligible"] = False
    else:
        rec["schemaErrors"] = []
    return rec

IDENTITY = build_identity_map()

# Record ids are frozen: stored attempts reference them, and a re-download of the
# source mirror changes page bytes (cache timestamps) without changing content.
_ID_MAP_PATH = os.path.join(OUT, "listening", "id-map.json")
FROZEN_IDS = json.load(open(_ID_MAP_PATH))["ids"] if os.path.exists(_ID_MAP_PATH) else {}

IRRELEVANT_TEMPLATES = {"hub_or_info": "HUB_PAGE", "tutorial_hub": "TUTORIAL_PAGE", "speaking_cue_card": "OTHER_MODULE"}


def mcq_drill_record(slug):
    """The 'IELTS Listening MCQ test N' series are 3-10 question part-drills,
    not 40-question tests: accounted for, never shipped."""
    meta = PAGE_BY_SLUG.get(slug, {})
    return {"slug": slug, "module": "listening", "kind": "mcq_drill", "status": "quarantined",
            "provenance": {"page": {"path": f"{slug}/index.html", "manifestSha256": meta.get("sha256")}},
            "units": [{"unit": "test", "reasonCode": "NOT_A_FULL_TEST",
                       "evidence": {"template": meta.get("template"), "title": meta.get("title"),
                                    "answerCount": meta.get("answer_count")}}]}


def key_conflicts(a, b):
    ka = {i["number"]: i["value"] for i in a["answerKey"]["items"]}
    kb = {i["number"]: i["value"] for i in b["answerKey"]["items"]}
    return [{"number": n, "this": kb.get(n), "canonical": ka.get(n)}
            for n in sorted(set(ka) | set(kb)) if norm(str(ka.get(n) or "")).lower() != norm(str(kb.get(n) or "")).lower()]


def main():
    import shutil
    for sub in ("listening/tests", "listening/quarantine"):
        p = os.path.join(OUT, sub)
        if os.path.exists(p): shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)
    os.makedirs(os.path.join(OUT, "schema"), exist_ok=True)
    with open(os.path.join(OUT, "schema", "listening-test.schema.json"), "w") as f:
        json.dump(LISTENING_SCHEMA, f, indent=1, ensure_ascii=False)
    dirs, loose = listening_slug_list()
    records = []
    for slug in dirs:
        try:
            records.append(process(slug, load_page))
        except Exception as e:
            records.append({"slug": slug, "status": "quarantined",
                            "quarantinedUnits": [{"unit": "test", "reasonCode": "EXTRACTION_CRASH", "evidence": repr(e)[:300]}],
                            "error": repr(e)[:300]})
    for fname in loose:
        try:
            records.append(process(fname, load_loose_page))
        except Exception as e:
            records.append({"slug": fname, "status": "quarantined",
                            "quarantinedUnits": [{"unit": "test", "reasonCode": "EXTRACTION_CRASH", "evidence": repr(e)[:300]}],
                            "error": repr(e)[:300]})
    by_slug = {r["slug"]: r for r in records}

    def mark_duplicate(r, of, reason, evidence=None):
        r["duplicateOf"] = of
        r["status"] = "duplicate"
        r["fullTestEligible"] = False
        r["duplicateEvidence"] = {"reasonCode": reason, **(evidence or {})}

    # exact duplicates by content fingerprint
    by_fp = defaultdict(list)
    for r in records:
        if r.get("contentFingerprint"):
            by_fp[r["contentFingerprint"]].append(r["slug"])
    for fp, slugs in by_fp.items():
        if len(slugs) > 1:
            hub_first = sorted(slugs, key=lambda s: (s not in HUB_SLUGS, s))[0]
            for s in slugs:
                if s != hub_first:
                    mark_duplicate(by_slug[s], hub_first, "CONTENT_FINGERPRINT_IDENTICAL")
    # near-duplicate Cambridge pairs: the verified member is canonical (else the first)
    for a, b in NEAR_DUPLICATE_PAIRS:
        ra, rb = by_slug[a], by_slug[b]
        canon, dup = (rb, ra) if (rb.get("status") == "verified" and ra.get("status") != "verified") else (ra, rb)
        mark_duplicate(dup, canon["slug"], "CAMBRIDGE_NEAR_DUPLICATE",
                       {"cambridgeIdentity": canon.get("cambridgeIdentity") or dup.get("cambridgeIdentity"),
                        "conflictingKeyItems": key_conflicts(canon, dup)})

    drills = [p["slug"] for p in MANIFEST["page_inventory"] if p.get("template") == "listening_mcq_test"]
    irrelevant = [{"slug": p["slug"], "reasonCode": IRRELEVANT_TEMPLATES[p["template"]], "template": p["template"]}
                  for p in MANIFEST["page_inventory"]
                  if "listening" in p["slug"] and p.get("template") in IRRELEVANT_TEMPLATES]

    # emit
    index_rows = []
    tally = defaultdict(int)
    reasons = defaultdict(lambda: {"units": 0, "tests": set()})
    for r in records:
        with open(os.path.join(OUT, "listening", "tests", f"{r['slug']}.json"), "w") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
        if r.get("quarantinedUnits"):
            with open(os.path.join(OUT, "listening", "quarantine", f"{r['slug']}.json"), "w") as f:
                json.dump({"slug": r["slug"], "status": r["status"],
                            "sourceSha256": r.get("provenance", {}).get("page", {}).get("sha256"),
                            "units": r["quarantinedUnits"]}, f, indent=1, ensure_ascii=False)
            for u in r["quarantinedUnits"]:
                for code in (u.get("reasonCodes") or [u["reasonCode"]]):
                    reasons[f"{u['unit']}:{code}"]["units"] += 1
                    reasons[f"{u['unit']}:{code}"]["tests"].add(r["slug"])
        nq = [q for g in r.get("questionGroups", []) for q in g["questions"]]
        index_rows.append({"slug": r["slug"], "id": r.get("id"), "status": r["status"],
                            "fullTestEligible": bool(r.get("fullTestEligible")),
                            "duplicateOf": r.get("duplicateOf"),
                            "testReasons": [u["reasonCode"] for u in r.get("quarantinedUnits", []) if u["unit"] == "test"],
                            "verifiedQuestions": r.get("verifiedQuestionCount", 0),
                            "totalQuestions": len(nq),
                            "audio": r.get("audio", {}).get("status"),
                            "cambridgeIdentity": r.get("cambridgeIdentity")})
        tally[r["status"]] += 1
        tally["questions_extracted"] += len(nq)
        tally["questions_verified"] += r.get("verifiedQuestionCount", 0)
        tally["source_key_items"] += len((r.get("answerKey") or {}).get("items") or [])
        if r["status"] == "verified":
            tally["production_questions"] += len(nq)
    for slug in drills:
        rec = mcq_drill_record(slug)
        with open(os.path.join(OUT, "listening", "quarantine", f"{slug}.json"), "w") as f:
            json.dump(rec, f, indent=1, ensure_ascii=False)
        index_rows.append({"slug": slug, "id": None, "status": "quarantined", "kind": "mcq_drill",
                           "fullTestEligible": False, "testReasons": ["NOT_A_FULL_TEST"]})
        reasons["test:NOT_A_FULL_TEST"]["units"] += 1
        reasons["test:NOT_A_FULL_TEST"]["tests"].add(slug)
    q_types = defaultdict(int)
    for r in records:
        if r["status"] == "verified":
            for g in r["questionGroups"]:
                for q in g["questions"]:
                    q_types[q["type"]] += 1
    production = tally["verified"]
    quarantined = tally["quarantined"] + len(drills)
    reconciliation = {
        "sourcePages": len(records) + len(drills) + len(irrelevant),
        "production": production,
        "quarantined": quarantined,
        "quarantinedFullTestPages": tally["quarantined"],
        "quarantinedMcqDrillPages": len(drills),
        "duplicates": tally["duplicate"],
        "irrelevant": len(irrelevant),
        "balanced": len(records) + len(drills) + len(irrelevant) == production + quarantined + tally["duplicate"] + len(irrelevant),
    }
    json.dump({"pipelineVersion": PIPELINE_VERSION,
               "reconciliation": reconciliation,
               "questions": {"sourceKeyItems": tally["source_key_items"],
                             "extracted": tally["questions_extracted"],
                             "verified": tally["questions_verified"],
                             "inProductionTests": tally["production_questions"],
                             "productionByType": dict(sorted(q_types.items()))},
               "quarantineReasons": {k: {"units": v["units"], "tests": len(v["tests"])}
                                     for k, v in sorted(reasons.items(), key=lambda kv: -kv[1]["units"])},
               "irrelevantPages": irrelevant,
               "tests": index_rows,
               "tally": dict(tally)}, open(os.path.join(OUT, "listening", "index.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps(reconciliation, indent=1))
    print(json.dumps(dict(tally), indent=1))


if __name__ == "__main__":
    main()
