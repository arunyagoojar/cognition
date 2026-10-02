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
    segment_with_blanks, decontaminate, content_hash, norm,
)

OUT = os.path.join(REPO, "content-db")
PIPELINE_VERSION = "production-listening-1.0.0"

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

# ---------------------------------------------------------------- 1+2. per-unit validation
def validate_units(record, page_text, key2_items):
    """Returns (quarantined_units, warnings). Unit = question or group. Smallest
    possible unit is quarantined; a test ships unless audio/file-level failures."""
    quar = []
    warns = []
    groups = record["questionGroups"]
    key2 = dict(key2_items)
    raw_norm = norm(page_text)
    anchors = set(record["counts"]["blankTokens"])
    ranges = [(g["startQ"], g["endQ"]) for g in groups]

    def evidence_count(n, g):
        ev = 0
        if any(a <= n <= b for a, b in ranges): ev += 1          # marker range
        if n in key2: ev += 1                                     # independent key
        if n in anchors: ev += 1                                  # blank token
        return ev

    for g in groups:
        g_quar = []
        if not g["instruction"]["text"]:
            quar.append({"unit": "group", "groupId": g["groupId"], "questionNumbers": [q["number"] for q in g["questions"]],
                         "reasonCode": "INSTRUCTION_MISSING", "evidence": {"instructionRaw": g["provenance"]["rawExcerpt"][:200]}})
            g["status"] = "quarantined"
            for q in g["questions"]: q["status"] = "quarantined"
            continue
        g["status"] = "verified"
        for q in g["questions"]:
            q_reasons = []
            ans = q.get("correctAnswer")
            if not q.get("answerFound"):
                q_reasons.append("ANSWER_MISSING")
            elif ans is None or ans == "":
                q_reasons.append("ANSWER_EMPTY_IN_KEY")
            if q["type"] == "mcq_single":
                if not q.get("options") or len(q["options"]) < 2:
                    q_reasons.append("OPTIONS_MISSING")
                elif ans and q.get("options") and ans.strip().upper() not in [o["letter"] for o in q["options"]]:
                    q_reasons.append("ANSWER_NOT_IN_OPTIONS")
            if evidence_count(q["number"], g) < 2:
                q_reasons.append("SEGMENTATION_UNPROVEN")
            if q["type"] not in ("mcq_multi", "matching_box", "map_labeling", "diagram_labeling") and \
               not norm(q["stem"].get("plain") or "") and not q["stem"].get("segments"):
                q_reasons.append("STEM_MISSING_IN_SOURCE")
            # independent key value equality
            if ans and key2.get(q["number"]) is not None and norm(str(ans)).lower() != norm(key2[q["number"]]).lower():
                q_reasons.append("KEY_PARSE_DISAGREEMENT")
            if q_reasons:
                q["status"] = "quarantined"
                g["status"] = "flagged"
                quar.append({"unit": "question", "groupId": g["groupId"], "questionNumber": q["number"],
                             "reasonCode": q_reasons[0], "reasonCodes": q_reasons,
                             "evidence": {"stem": q["stem"].get("plain"), "answer": ans,
                                          "rawExcerpt": q.get("_raw", "")[:160],
                                          "options": q.get("options")}})
            else:
                q["status"] = "verified"
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
        "status": {"enum": ["verified", "flagged", "quarantined"]},
        "validationWarnings": {"type": "array"},
        "quarantinedCount": {"type": "integer"},
        "verifiedQuestionCount": {"type": "integer"},
    },
}
SCHEMA_VALIDATOR = Draft202012Validator(LISTENING_SCHEMA)

# ---------------------------------------------------------------- per-test pipeline
def process(slug, page_loader):
    from bs4 import BeautifulSoup as BS
    page = page_loader(slug)
    test_number_m = re.search(r"(\d+)", slug)
    test_number = int(test_number_m.group(1)) if test_number_m else 0
    raw_text = page["raw"].decode("utf-8", "replace")
    key = parse_answer_key(BS(raw_text, "html.parser"))
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
                          "sharedOptions": g.shared_options or None},
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
        "id": f"listening.test-{test_number:04d}.{content_hash(slug, page['sha256'])}",
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

    # per-unit validation
    page_text = ec.get_text("\n")
    quar, warns = validate_units(rec, page_text, key2_items)
    quar = quar_pre + quar
    rec["quarantinedUnits"] = quar
    rec["validationWarnings"] = warns
    nq = [q for g in groups_json for q in g["questions"]]
    rec["verifiedQuestionCount"] = sum(1 for q in nq if q["status"] == "verified")
    rec["quarantinedCount"] = len(quar)
    # test status: quarantine only for test-unit failures or zero verified questions
    test_level_fails = [u for u in quar if u["unit"] == "test"]
    if test_level_fails or rec["verifiedQuestionCount"] == 0:
        rec["status"] = "quarantined"
    elif quar:
        rec["status"] = "flagged"
    else:
        rec["status"] = "verified" if not warns else "flagged"

    # schema hard gate
    errors = sorted(SCHEMA_VALIDATOR.iter_errors(rec), key=lambda e: e.path)
    if errors:
        rec["schemaErrors"] = [f"{list(e.path)}: {e.message[:200]}" for e in errors[:10]]
        rec["status"] = "quarantined"
    else:
        rec["schemaErrors"] = []
    return rec

IDENTITY = build_identity_map()

def main():
    import shutil
    for sub in ("listening/tests", "listening/quarantine", "reports"):
        p = os.path.join(OUT, sub)
        if os.path.exists(p): shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)
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

    # duplicate classification by content fingerprint
    by_fp = defaultdict(list)
    for r in records:
        if "contentFingerprint" in r and r.get("contentFingerprint"):
            by_fp[r["contentFingerprint"]].append(r["slug"])
    duplicates = {}
    for fp, slugs in by_fp.items():
        if len(slugs) > 1:
            hub_first = sorted(slugs, key=lambda s: (s not in HUB_SLUGS, s))[0]
            for s in slugs:
                if s != hub_first:
                    duplicates[s] = hub_first
    for r in records:
        if r["slug"] in duplicates:
            r["duplicateOf"] = duplicates[r["slug"]]
            r["status"] = "duplicate"

    # emit
    index_rows = []
    tally = defaultdict(int)
    for r in records:
        with open(os.path.join(OUT, "listening", "tests", f"{r['slug']}.json"), "w") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
        if r.get("quarantinedUnits"):
            with open(os.path.join(OUT, "listening", "quarantine", f"{r['slug']}.json"), "w") as f:
                json.dump({"slug": r["slug"], "sourceSha256": r.get("provenance", {}).get("page", {}).get("sha256"),
                            "units": r["quarantinedUnits"]}, f, indent=1, ensure_ascii=False)
        q_total = sum(len(g["questions"]) for g in r.get("questionGroups", []))
        index_rows.append({"slug": r["slug"], "id": r.get("id"), "status": r["status"],
                            "duplicateOf": r.get("duplicateOf"),
                            "verifiedQuestions": r.get("verifiedQuestionCount", 0),
                            "totalQuestions": q_total,
                            "audio": r.get("audio", {}).get("status"),
                            "cambridgeIdentity": r.get("cambridgeIdentity")})
        tally[r["status"]] += 1
        tally["questions_total"] += q_total
        tally["questions_verified"] += r.get("verifiedQuestionCount", 0)
    json.dump({"pipelineVersion": PIPELINE_VERSION, "tests": index_rows,
                "tally": dict(tally)}, open(os.path.join(OUT, "listening", "index.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps(dict(tally), indent=1))
    print("duplicates:", len(duplicates))

if __name__ == "__main__":
    main()
