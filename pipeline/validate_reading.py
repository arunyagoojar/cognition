#!/usr/bin/env python3
"""
Cognition — production Reading contract validator.

Independent of the extractor: it imports nothing from extract_reading.py and
checks the WRITTEN records (content-db/reading/tests/*.json) against the
production contract. Every group a candidate can be served must satisfy it;
quarantined content is checked only for isolation (it must never be marked
production). Read-only by default; `--write` stores content-db/reading/validation.json.

Exit status 1 when any production record violates the contract.
"""
import glob
import json
import os
import re
import sys
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(REPO, "content-db", "reading")
R2_READING = {m["sha256"] for m in json.load(open(os.path.join(REPO, "content-db/media_manifest.json")))["media"]
              if m["kind"] == "images/reading"}

TYPES = {
    "tfng": "tfng", "ynng": "ynng", "mcq_single": "single_choice", "mcq_multi": "multi_choice",
    "matching_headings": "pool_select", "matching_information": "pool_select",
    "matching_features": "pool_select", "sentence_endings": "pool_select",
    "short_answer": "text", "sentence_completion": None, "diagram_completion": None,
    "summary_completion": None, "note_completion": None, "table_completion": None,
    "flow_chart_completion": None,
}
COMPLETION = {"summary_completion", "note_completion", "table_completion", "flow_chart_completion",
              "sentence_completion", "diagram_completion"}
FIXED = {"tfng": {"TRUE", "FALSE", "NOT GIVEN"}, "ynng": {"YES", "NO", "NOT GIVEN"}}
ARTIFACT = re.compile(r"Show Answers|Cambridge IELTS Tests?\s+\d|\[IMG|<[a-z/][^>]*>|&[a-z]+;|␦|�|"
                      r"(?:[.…·_]\s?){3,}|…{2,}|_{3,}", re.I)
# passage prose may legitimately quote an ellipsis (". . .") or show a sample gap
# ("I___ see a car"); numbered answer blanks never belong there
PASSAGE_ARTIFACT = re.compile(r"Show Answers|Cambridge IELTS Tests?\s+\d|\[IMG|<[a-z/][^>]*>|&[a-z]+;|\u2426|\ufffd|"
                              r"\(\s*\d{1,2}\s*\)\s*(?:[.…_]\s?){2,}|(?:[.…_]\s?){2,}\s*\(\s*\d{1,2}\s*\)|"
                              r"(?:[.…]\s?){5,}|…{3,}|_{5,}", re.I)
STATUSES = {"production", "practice_only", "quarantined", "duplicate"}


def segs_text(segs):
    return "".join(s for s in (segs or []) if isinstance(s, str))


def blanks(segs):
    return [s["blank"] for s in (segs or []) if isinstance(s, dict)]


def validate_group(g, errs):
    def err(code, detail=""):
        errs.append({"group": g["groupId"], "code": code, "detail": detail})

    t, ctrl = g.get("type"), g.get("answerControl")
    if t not in TYPES:
        return err("INVALID_TYPE", t)
    if TYPES[t] and ctrl != TYPES[t]:
        err("INVALID_CONTROL", f"{t}/{ctrl}")
    if t in COMPLETION and ctrl not in ("text", "pool_select"):
        err("INVALID_CONTROL", f"{t}/{ctrl}")
    lo, hi = g["startQ"], g["endQ"]
    nums = [q["number"] for q in g["questions"]]
    if nums != list(range(lo, hi + 1)):
        err("NUMBERING_MISMATCH", f"{nums} vs {lo}-{hi}")
    if not (g.get("instruction") or "").strip() and t not in ("tfng", "ynng"):
        err("MISSING_INSTRUCTION")
    for text in [g.get("instruction") or ""] + [o["text"] for o in ((g.get("optionPool") or {}).get("options") or [])]:
        if ARTIFACT.search(text):
            err("EXTRACTION_ARTIFACT", text[:80])
    pool = (g.get("optionPool") or {}).get("options") or []
    pool_ids = [o["id"] for o in pool]
    if ctrl in ("pool_select", "multi_choice"):
        if len(pool_ids) < 2 or len(set(pool_ids)) != len(pool_ids):
            err("INCOMPLETE_OPTIONS", str(pool_ids))
        if t != "matching_information" and any(not o["text"].strip() for o in pool):
            err("INCOMPLETE_OPTIONS", "empty option text")
    elif pool:
        err("ORPHAN_OPTIONS", str(pool_ids))
    if t == "mcq_multi":
        if g.get("selectCount") != hi - lo + 1:
            err("SELECT_COUNT_MISMATCH", str(g.get("selectCount")))
        vals = [(q.get("answer") or {}).get("value") for q in g["questions"]]
        if len(set(vals)) != len(vals):
            err("ANSWER_INVALID_FOR_TYPE", "multi-select answers not distinct")
    # stimulus blanks: each completion question appears exactly once
    stim_blanks = []
    stim = g.get("stimulus")
    if stim:
        for b in stim["blocks"]:
            if b["type"] == "text":
                stim_blanks += blanks(b["segments"])
                if ARTIFACT.search(segs_text(b["segments"])):
                    err("EXTRACTION_ARTIFACT", segs_text(b["segments"])[:80])
            elif b["type"] == "table":
                for row in b["rows"]:
                    for cell in row:
                        stim_blanks += blanks(cell)
                        if ARTIFACT.search(segs_text(cell)):
                            err("EXTRACTION_ARTIFACT", segs_text(cell)[:80])
            elif b["type"] == "image" and not b.get("asset"):
                err("MEDIA_MISSING")
    if any(n < lo or n > hi for n in stim_blanks):
        err("NUMBERING_MISMATCH", f"stimulus blank outside range {stim_blanks}")
    c = Counter(stim_blanks)
    if any(v > 1 for v in c.values()):
        err("DUPLICATE_BLANK", str(c))
    for f in g.get("figures") or []:
        if f.get("status") != "in_r2" or f.get("sha256") not in R2_READING:
            err("MEDIA_NOT_IN_R2", f.get("sourcePath"))
    for q in g["questions"]:
        n = q["number"]
        a = q.get("answer") or {}
        if not a.get("value"):
            err("MISSING_ANSWER", f"q{n}")
            continue
        prompt = q.get("prompt")
        pb = blanks(prompt)
        if any(b != n for b in pb) or len(pb) > 1:
            err("MALFORMED_BLANK", f"q{n} prompt blanks {pb}")
        if ARTIFACT.search(segs_text(prompt)):
            err("EXTRACTION_ARTIFACT", f"q{n} {segs_text(prompt)[:80]}")
        if t in FIXED and a["value"] not in FIXED[t]:
            err("ANSWER_INVALID_FOR_TYPE", f"q{n} {a['value']}")
        if t == "mcq_single":
            ids = [o["id"] for o in q.get("options") or []]
            if len(ids) < 3 or ids != [chr(65 + k) for k in range(len(ids))]:
                err("INCOMPLETE_OPTIONS", f"q{n} {ids}")
            if a["value"] not in ids:
                err("ANSWER_INVALID_FOR_TYPE", f"q{n} {a['value']} not in {ids}")
            if not segs_text(prompt).strip():
                err("EMPTY_QUESTION", f"q{n}")
        elif ctrl in ("pool_select", "multi_choice"):
            if a["value"] not in pool_ids:
                err("ANSWER_INVALID_FOR_TYPE", f"q{n} {a['value']} not in pool")
        elif ctrl == "text":
            if not a.get("accepted"):
                err("MISSING_ANSWER", f"q{n} no accepted answers")
            if re.fullmatch(r"[A-Za-z]|[ivx]{1,4}|(?i:true|false|not given|yes|no)", a["raw"].strip().rstrip(".")):
                err("ANSWER_INVALID_FOR_TYPE", f"q{n} {a['raw']}")
        # every question must be locatable: own prompt, a stimulus blank, a figure label, or a multi-select slot
        locatable = (segs_text(prompt).strip() or n in c or q.get("labelInFigure")
                     or (t == "mcq_multi") or (t in ("tfng", "ynng") and segs_text(prompt).strip()))
        if not locatable:
            err("EMPTY_QUESTION", f"q{n}")
        if t in ("tfng", "ynng", "matching_information", "matching_features", "matching_headings",
                 "sentence_endings", "short_answer") and not segs_text(prompt).strip():
            err("EMPTY_QUESTION", f"q{n}")
        if t in COMPLETION and ctrl == "text" and stim and n not in c and not q.get("labelInFigure") and not pb:
            err("MALFORMED_BLANK", f"q{n} has no blank")


def main():
    write = "--write" in sys.argv
    errors, tally, groups = [], Counter(), Counter()
    full = 0
    for f in sorted(glob.glob(os.path.join(DB, "tests", "*.json"))):
        r = json.load(open(f))
        st = r.get("status")
        tally[st] += 1
        if st not in STATUSES:
            errors.append({"slug": r["slug"], "code": "INVALID_STATUS", "detail": st})
            continue
        prod_groups = [g for p in r.get("passages", []) for g in p["questionGroups"] if g["status"] == "production"]
        for p in r.get("passages", []):
            for g in p["questionGroups"]:
                groups[g["status"] if st != "duplicate" else "duplicate"] += 1
        if st in ("quarantined", "duplicate"):
            if r.get("fullMockEligible"):
                errors.append({"slug": r["slug"], "code": "QUARANTINE_LEAK", "detail": "quarantined test marked full-mock eligible"})
            continue
        test_errs = []
        seen = {}
        for g in prod_groups:
            if g.get("reasonCodes"):
                test_errs.append({"group": g["groupId"], "code": "QUARANTINE_LEAK", "detail": str(g["reasonCodes"])})
            validate_group(g, test_errs)
            for q in g["questions"]:
                if q["number"] in seen:
                    test_errs.append({"group": g["groupId"], "code": "DUPLICATE_QUESTION", "detail": f"q{q['number']}"})
                seen[q["number"]] = g["groupId"]
        for p in r["passages"]:
            if prod_groups and not any(x.get("text") for x in p["paragraphs"]):
                test_errs.append({"group": f"p{p['passageNumber']}", "code": "EMPTY_PASSAGE", "detail": ""})
            for x in p["paragraphs"]:
                if PASSAGE_ARTIFACT.search(x.get("text", "")):
                    test_errs.append({"group": f"p{p['passageNumber']}", "code": "EXTRACTION_ARTIFACT",
                                      "detail": x["text"][:80]})
        if r.get("fullMockEligible"):
            full += 1
            if sorted(seen) != list(range(1, 41)) or len(r["passages"]) != 3:
                test_errs.append({"group": "*", "code": "FULL_MOCK_INCOMPLETE", "detail": str(sorted(seen))[:120]})
            if st != "production":
                test_errs.append({"group": "*", "code": "FULL_MOCK_STATUS", "detail": st})
        for e in test_errs:
            errors.append({"slug": r["slug"], **e})
    report = {"validator": "validate_reading.py (independent contract check)",
              "tests": dict(tally), "fullMockEligible": full, "groups": dict(groups),
              "errorCount": len(errors), "errorsByCode": dict(Counter(e["code"] for e in errors)),
              "errors": errors}
    if write:
        json.dump(report, open(os.path.join(DB, "validation.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in report.items() if k != "errors"}, indent=1))
    for e in errors[:40]:
        print("  ", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
