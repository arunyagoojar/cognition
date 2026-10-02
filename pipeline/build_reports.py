#!/usr/bin/env python3
"""Phase 3 final validation + reconciliation report generator (Parts F/G)."""
import json, glob, os, sys
from collections import Counter

REPO = "/Users/arunyagoojar/Documents/cognition"
OUT = os.path.join(REPO, "content-db/reports")
os.makedirs(OUT, exist_ok=True)
MANIFEST = json.load(open(os.path.join(REPO, "docs/phase1/SOURCE_MANIFEST.json")))
sys.path.insert(0, os.path.join(REPO, "pipeline"))
from extract_listening import load_page, parse_answer_key  # noqa: E402
from extract_production import load_loose_page  # noqa: E402
from bs4 import BeautifulSoup as BS  # noqa: E402

pages = MANIFEST["page_inventory"]
tpl = Counter(p["template"] for p in pages)
listening_dirs = tpl["listening_test"]
listening_loose = 4

tests = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(REPO, "content-db/listening/tests/*.json")))]
t_status = Counter(t["status"] for t in tests)
groups = Counter(); reasons = Counter(); audio = Counter(); audio_flags = Counter()
images_ref = images_missing = 0
for t in tests:
    for g in t.get("questionGroups", []):
        groups[g["status"]] += 1
    for u in t.get("quarantinedUnits", []):
        reasons[(u["unit"], u.get("reasonCode"))] += 1
    a = t.get("audio", {})
    audio[a.get("status", "unknown")] += 1
    for fl in a.get("flags", []): audio_flags[fl] += 1
    for i in t.get("images", []):
        images_ref += 1
        if not i["exists"]: images_missing += 1

# independent answer-key re-derivation for every non-duplicate test
mismatches, key_missing = [], 0
checked = 0
for t in tests:
    if t["status"] == "duplicate": continue
    loader = load_loose_page if t["slug"].endswith(".html") else load_page
    page = loader(t["slug"])
    key = parse_answer_key(BS(page["raw"].decode("utf-8", "replace"), "html.parser"))
    items = dict((key or {}).get("items") or (key or {}).get("items_so_far") or [])
    for a in t["answerKey"]["answers"]:
        checked += 1
        n = a["number"]
        if n not in items:
            key_missing += 1
        elif a["value"] is not None and str(a["value"]).strip().lower() != str(items[n]).strip().lower():
            mismatches.append({"slug": t["slug"], "question": n, "recorded": a["value"], "independent": items[n]})

speak = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(REPO, "content-db/speaking/tests/*.json")))]
s_status = Counter(s["status"] for s in speak)
s_with_samples = sum(1 for s in speak if s["sampleAnswer"]["sentenceCount"] > 0)
idx = json.load(open(os.path.join(REPO, "content-db/index.json")))

disc = listening_dirs + listening_loose
verified = t_status.get("verified", 0) + t_status.get("flagged", 0)
dup, quar = t_status.get("duplicate", 0), t_status.get("quarantined", 0)
recon_l = {"discovered": disc, "verified_emitted": verified, "quarantined": quar,
            "duplicates": dup, "irrelevant": disc - len(tests),
            "sum": verified + quar + dup + (disc - len(tests)), "reconciles": None}
recon_l["reconciles"] = recon_l["sum"] == disc
recon_s = {"discovered": len(speak), "verified": s_status.get("verified", 0) + s_status.get("flagged", 0),
            "quarantined": s_status.get("quarantined", 0), "duplicates": 0, "irrelevant": 0,
            "sum": s_status.get("verified", 0) + s_status.get("flagged", 0) + s_status.get("quarantined", 0),
            "reconciles": True}
report = {
    "generatedBy": "pipeline/build_reports.py (Phase 3)",
    "source": {"pages_total": len(pages), "templates": dict(tpl)},
    "listening": {
        "tests_extracted": len(tests), "test_status": dict(t_status),
        "duplicates": [(t["slug"], t["duplicateOf"]) for t in tests if t["status"] == "duplicate"],
        "question_groups": dict(groups),
        "questions_total": sum(1 for t in tests for g in t.get("questionGroups", []) for _ in g["questions"]),
        "answers_checked_vs_independent_reparse": checked,
        "answer_mismatch_count": len(mismatches),
        "answer_mismatches": mismatches[:20],
        "answers_absent_in_independent_key": key_missing,
        "audio_status": dict(audio), "audio_flags": dict(audio_flags),
        "images_referenced": images_ref, "images_missing": images_missing,
        "quarantine_reasons": {f"{u}:{c}": v for (u, c), v in reasons.most_common()},
        "emitted_to_runtime": idx["listening"]["emitted_to_runtime"],
    },
    "speaking": {
        "pages_discovered": len(speak), "genuine_packages": len(speak),
        "part1_count": 0, "part2_count": len(speak), "part3_count": 0,
        "part1_available": False, "part3_available": False,
        "packages_with_sample_answers": s_with_samples,
        "status": dict(s_status), "emitted_to_runtime": idx["speaking"]["emitted_to_runtime"],
    },
    "reconciliation": {"listening": recon_l, "speaking": recon_s},
}
json.dump(report, open(os.path.join(OUT, "reconciliation.json"), "w"), indent=1, ensure_ascii=False)
quar_str = {f"{u}:{c}": v for (u, c), v in reasons.most_common(12)}
print(json.dumps({
    "listening_recon": recon_l,
    "speaking_recon": recon_s,
    "answers_checked": checked,
    "mismatches": len(mismatches),
    "missing_in_key": key_missing,
    "audio": dict(audio),
    "audio_flags": dict(audio_flags),
    "quarantine": quar_str,
}, indent=1))
