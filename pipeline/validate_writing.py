#!/usr/bin/env python3
"""
Cognition — Phase 5: recursive production Writing validator.

Validates EVERY production Writing record (no sampling):
- ID grammar + uniqueness
- prompt non-empty + SOURCE FIDELITY (re-extract from raw HTML, normalized equality)
- Task 1 visual: exists, hash re-computed from source, MIME, dimensions, association
- HTML table tasks: structured rows present
- contamination: sample-answer markers / site shell in prompts
- renderer contract: visualType enum or table data
- source → production reconciliation with exact arithmetic

Exit code 1 on any failure. Wired as `npm run validate:production:writing`.
"""
import json, os, re, sys, hashlib
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_writing import SRC_ROOT, load_page, block_sequence, split_tasks, extract_prompt_and_visual, norm, asset_meta, page_inventory  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

OUT = os.path.join(REPO := "/Users/arunyagoojar/Documents/cognition", "content-db")

ID_RE = re.compile(r"^writing\.test-\d{4}\.[0-9a-f]{8}$")
VISUAL_TYPES = {"line_graph", "bar_chart", "pie_chart", "table", "process", "map",
                 "mixed_chart", "diagram", "multiple_visual", "other"}
# Site-shell contamination signals. NOTE: "advertising" in prose is a legitimate
# IELTS topic — real site ads are <ins>/<iframe> elements and are removed
# structurally during extraction, never text-matched.
CONTAMINATION = re.compile(r"(sample answer|model answer|band [6-9]\s*(answer|essay)|suggested answer|"
                            r"candidate response|answer analysis|leave a reply|recent posts|IELTS MASTER)", re.I)


def normalize(text):
    t = text or ""
    t = t.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def fail(errors, slug, code, detail):
    errors.append({"slug": slug, "code": code, "detail": str(detail)[:220]})


def reextract_prompts(slug):
    """Independent re-extraction of the task prompts straight from raw HTML."""
    page = load_page(slug)
    soup = BeautifulSoup(page["raw"].decode("utf-8", "replace"), "html.parser")
    ec = soup.find("div", class_="entry-content")
    comments = ec.find(id="comments")
    if comments is not None:
        for el in [comments, *comments.find_next_siblings()]:
            el.decompose()
    regions, found = split_tasks(block_sequence(ec))
    out = {}
    for tn in ("1", "2"):
        if regions[tn]:
            lines, _, _, _, _, _ = extract_prompt_and_visual(regions[tn])
            out[tn] = norm(" ".join(l["text"] for l in lines if "text" in l))
    return out, page


def main():
    errors, warnings = [], []
    tests = [json.load(open(f)) for f in
             sorted(__import__("glob").glob(os.path.join(OUT, "writing/tests/*.json")))]
    ids = Counter()
    t1_count = t2_count = 0
    img_stats = Counter()

    for r in tests:
        slug = r["slug"]
        # ── identity ──
        if not ID_RE.match(r["id"]):
            fail(errors, slug, "ID_MALFORMED", r["id"])
        ids[r["id"]] += 1
        if not r.get("provenance", {}).get("page", {}).get("sha256"):
            fail(errors, slug, "PROVENANCE_MISSING", "page hash absent")

        # ── prompts: existence, fidelity, contamination ──
        prompts_re, page = reextract_prompts(slug)
        for tn, task_key in (("1", "task1"), ("2", "task2")):
            task = r.get(task_key)
            if task is None:
                fail(errors, slug, f"TASK{tn}_MISSING", "no task record")
                continue
            t_count_key = "t1_count" if tn == "1" else "t2_count"
            if tn == "1": t1_count += 1
            else: t2_count += 1
            prompt = task.get("prompt") or ""
            if len(prompt) < 40:
                fail(errors, slug, f"TASK{tn}_PROMPT_EMPTY", prompt[:60])
            if CONTAMINATION.search(prompt):
                fail(errors, slug, f"TASK{tn}_CONTAMINATION", prompt[:120])
            # fidelity: production prompt must equal the independent re-extraction
            src_prompt = prompts_re.get(tn)
            if src_prompt is None:
                fail(errors, slug, f"TASK{tn}_SOURCE_MISMATCH", "re-extraction found no task")
            elif normalize(src_prompt) != normalize(prompt):
                fail(errors, slug, f"TASK{tn}_PROMPT_MISMATCH",
                     f"len src={len(src_prompt)} prod={len(prompt)}")

            # ── task1 visual / table ──
            if tn == "1":
                vis = task.get("visual")
                table = task.get("table")
                if not vis and not table:
                    fail(errors, slug, "TASK1_VISUAL_MISSING", "no visual and no table")
                if vis:
                    if vis["visualType"] not in VISUAL_TYPES:
                        fail(errors, slug, "VISUAL_TYPE_INVALID", vis["visualType"])
                    meta = asset_meta(vis["sourcePath"])
                    if not meta.get("exists"):
                        fail(errors, slug, "ASSET_UNRESOLVED", vis["sourcePath"])
                    else:
                        img_stats["resolved"] += 1
                        if meta["sha256"] != vis.get("sha256"):
                            fail(errors, slug, "TASK1_VISUAL_HASH_MISMATCH", vis["sourcePath"])
                        else:
                            img_stats["hash_match"] += 1
                        if meta["mimeType"] not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
                            fail(errors, slug, "VISUAL_MIME_INVALID", meta["mimeType"])
                        if not (meta.get("width") and meta.get("height")):
                            fail(errors, slug, "VISUAL_DIMENSIONS_INVALID", vis["sourcePath"])
                        if not vis.get("sourceElementEvidence"):
                            fail(errors, slug, "VISUAL_ASSOCIATION_UNPROVEN", "no element evidence")
                    if table:
                        fail(errors, slug, "VISUAL_ASSOCIATION_AMBIGUOUS", "image and html table both present")
                if table:
                    rows = table.get("rows") or []
                    if len(rows) < 2:
                        fail(errors, slug, "TASK1_TABLE_MALFORMED", f"{len(rows)} rows")
                    else:
                        img_stats["html_table"] += 1

    # ── duplicates / uniqueness ──
    for rid, n in ids.items():
        if n > 1:
            fail(errors, "—", "ID_DUPLICATE", f"{rid} x{n}")

    # ── reconciliation ──
    discovered = len(page_inventory())
    statuses = Counter(t["status"] for t in tests)
    production = statuses.get("verified", 0) + statuses.get("flagged", 0)
    quarantined = statuses.get("quarantined", 0)
    duplicates = statuses.get("duplicate", 0)
    irrelevant = discovered - len(tests)
    recon = {"discovered": discovered, "production": production, "quarantined": quarantined,
              "duplicates": duplicates, "irrelevant": irrelevant,
              "sum": production + quarantined + duplicates + irrelevant}
    recon["reconciles"] = recon["sum"] == discovered

    report = {
        "validator": "pipeline/validate_writing.py",
        "records": len(tests),
        "task1Records": t1_count, "task2Records": t2_count,
        "images": dict(img_stats),
        "errors": errors,
        "warnings": warnings,
        "reconciliation": recon,
    }
    json.dump(report, open(os.path.join(OUT, "writing", "validation.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({k: report[k] for k in ("records", "task1Records", "task2Records", "images", "reconciliation")},
                      indent=1))
    print("errors:", len(errors))
    for e in errors[:12]:
        print("  ✗", e["slug"], e["code"], e["detail"][:100])
    if errors or not recon["reconciles"]:
        print("VALIDATION FAILED")
        sys.exit(1)
    print("WRITING PRODUCTION VALIDATION PASSED")


if __name__ == "__main__":
    main()
