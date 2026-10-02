#!/usr/bin/env python3
"""
Cognition — Phase 3: production Speaking extraction.

Extracts every genuine Speaking record the source contains: Makkar-style Part 2
cue-card pages (topic + numbered sample answer). The source contains NO cue-card
bullet prompts (0 pages match "You should say") and NO Part 1 / Part 3 material —
coverage is recorded as explicitly unavailable, never invented.

Deterministic: output is a pure function of (source bytes, pipeline files).
"""
import json, os, re, hashlib, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_listening import SRC_ROOT, REPO, MANIFEST, norm, norm_keep_nl, content_hash  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

OUT = os.path.join(REPO, "content-db")
PIPELINE_VERSION = "production-speaking-1.0.0"
HUB = MANIFEST["hub_enumerations"]["makkar_speaking"]  # 180 links, numbered 1..180

TOPIC_SUFFIX = re.compile(r"\s*[–-]\s*IELTS MASTER\s*$", re.I)
SENT = re.compile(r"^\s*(\d{1,3})\s*\.\s*(.+)$", re.S)

def speaking_pages():
    pages = {}
    for p in MANIFEST["page_inventory"]:
        if p.get("template") == "speaking_cue_card":
            pages[p["slug"]] = p
    return pages

def parse_page(slug, meta):
    path = os.path.join(SRC_ROOT, slug, "index.html")
    raw = open(path, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    soup = BeautifulSoup(raw.decode("utf-8", "replace"), "html.parser")
    h1 = soup.find("h1")
    title = norm(h1.get_text(" ")) if h1 else ""
    topic = TOPIC_SUFFIX.sub("", title).strip()
    ec = soup.find("div", class_="entry-content")
    sentences, notes = [], []
    if ec is not None:
        for p in ec.find_all("p"):
            txt = norm_keep_nl(p.get_text("\n"))
            if not txt or "makkar" in txt.lower():
                continue
            for line in txt.split("\n"):
                m = SENT.match(line.strip())
                if m:
                    sentences.append((int(m.group(1)), norm(m.group(2))))
                elif line.strip():
                    notes.append(norm(line.strip()))
    # sample answer numbers must ascend from 1
    seq_ok = [n for n, _ in sentences] == list(range(1, len(sentences) + 1))
    # hub numbering
    hub = next((e for e in HUB if e["slug"] == slug), None)
    hub_number = None
    if hub:
        m = re.match(r"(\d+)\.", hub["label"])
        hub_number = int(m.group(1)) if m else None
    # topic/slug cross-check (proves the record belongs to the page)
    slug_words = set(re.findall(r"[a-z]+", slug))
    topic_words = [w for w in re.findall(r"[a-z]+", topic.lower()) if len(w) > 3][:6]
    overlap = sum(1 for w in topic_words if w in slug_words)
    rec = {
        "id": f"speaking.makkar.{hub_number:04d}.{content_hash(slug, sha)}" if hub_number else f"speaking.makkar.{content_hash(slug, sha)}",
        "module": "speaking",
        "kind": "part2_cue_card",
        "part": 2,
        "hubNumber": hub_number,
        "hubLabel": hub["label"] if hub else None,
        "slug": slug,
        "title": title,
        "cueCard": {
            "topic": topic,
            "bulletPrompts": [],
            "bulletsNote": "Source page does not carry cue-card bullet prompts (verified corpus-wide: 0 pages contain 'You should say' style prompts); bullets intentionally empty, never invented.",
        },
        "coverage": {"part1": "unavailable", "part2": "available", "part3": "unavailable"},
        "sampleAnswer": {
            "kind": "numbered_speech",
            "sentences": [s for _, s in sentences],
            "sentenceCount": len(sentences),
            "sequenceOk": seq_ok,
            "usage": "reference_material_not_question",
            "provenance": {"elementPath": "div.entry-content > p", "rawExcerpt": (sentences[0][1][:160] if sentences else "")},
        },
        "provenance": {
            "page": {"path": f"{slug}/index.html", "sha256": sha,
                      "manifestHashMatch": sha == meta.get("sha256"), "url": meta.get("url_hint")},
            "extractionMethod": "deterministic_dom_v1.speaking",
        },
        "unparsedNotes": notes[:10],
    }
    # validation
    quar, warns = [], []
    if not topic:
        quar.append({"unit": "package", "reasonCode": "TOPIC_MISSING", "evidence": {"title": title}})
    elif overlap < 2 and topic_words:
        quar.append({"unit": "package", "reasonCode": "TOPIC_SLUG_MISMATCH",
                      "evidence": {"topic": topic, "slug": slug, "overlap": overlap}})
    if not sentences:
        quar.append({"unit": "package", "reasonCode": "SAMPLE_ANSWER_MISSING", "evidence": {"notes": notes[:5]}})
    elif not seq_ok:
        warns.append({"code": "SAMPLE_ANSWER_SEQUENCE", "detail": f"numbering breaks at {[n for n, _ in sentences][:10]}"})
    if hub_number is None:
        warns.append({"code": "NOT_IN_MAKKAR_HUB", "detail": "page not enumerated by the makkar hub"})
    rec["quarantinedUnits"] = quar
    rec["validationWarnings"] = warns
    rec["status"] = "quarantined" if quar else ("flagged" if warns else "verified")
    return rec

def main():
    import shutil
    for sub in ("speaking/tests", "speaking/quarantine"):
        p = os.path.join(OUT, sub)
        if os.path.exists(p): shutil.rmtree(p)
        os.makedirs(p, exist_ok=True)
    pages = speaking_pages()
    records = []
    for slug, meta in sorted(pages.items()):
        records.append(parse_page(slug, meta))
    tally = defaultdict(int)
    rows = []
    for r in records:
        with open(os.path.join(OUT, "speaking", "tests", f"{r['slug']}.json"), "w") as f:
            json.dump(r, f, indent=1, ensure_ascii=False)
        if r["quarantinedUnits"]:
            with open(os.path.join(OUT, "speaking", "quarantine", f"{r['slug']}.json"), "w") as f:
                json.dump(r, f, indent=1, ensure_ascii=False)
        tally[r["status"]] += 1
        tally["sample_answers"] += 1 if r["sampleAnswer"]["sentences"] else 0
        rows.append({"slug": r["slug"], "id": r["id"], "hubNumber": r["hubNumber"], "status": r["status"]})
    json.dump({"pipelineVersion": PIPELINE_VERSION, "packages": rows, "tally": dict(tally)},
              open(os.path.join(OUT, "speaking", "index.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps(dict(tally), indent=1))
    # hub delta reconciliation
    hub_slugs = {e["slug"] for e in HUB}
    page_slugs = set(pages)
    print("hub links:", len(HUB), "| pages:", len(pages),
          "| hub-not-on-disk:", sorted(hub_slugs - page_slugs)[:4],
          "| pages-not-in-hub:", sorted(page_slugs - hub_slugs)[:4])

if __name__ == "__main__":
    main()
