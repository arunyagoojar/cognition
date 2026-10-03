#!/usr/bin/env python3
"""
Cognition — Speaking package assembly (v5).

Every package follows the IELTS Speaking format:
  Part 1  introduction + interview (4–5 min): 3 familiar topics × 3 short
          questions, each topic's questions in natural examiner order
  Part 2  long turn: the cue-card topic, "You should say:" + 3–4 prompts,
          and an "and explain …" line
  Part 3  discussion: 2 abstract themes linked to the Part 2 topic × 3 questions

Sources & provenance (carried per part into the runtime and shown in the UI):
  - Part 2 TOPIC: the 179 cue-card pages of the source practice site
    (SOURCE_PRACTICE_TOPIC). Never labelled official IELTS/Cambridge material.
  - Part 1 frames, cue-card prompts and Part 3: written for Cognition in the
    IELTS format (COGNITION_AUTHORED_PRACTICE), reviewed data files in
    content-db/speaking/authored/. Nothing is generated at runtime.

Deterministic: package ids are the committed ids; Part 1 topic selection is a
pure function of the package id. The build fails rather than ship a package
that breaks the format.
"""
import glob
import hashlib
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "content-db", "speaking")
AUTHORED = os.path.join(OUT, "authored")
PROV_TOPIC = "SOURCE_PRACTICE_TOPIC"
PROV_AUTHORED = "COGNITION_AUTHORED_PRACTICE"
# IELTS Part 1 runs 4–5 minutes: about three topics of three short questions
PART1_PER_TOPIC = 3


def fail(msg):
    sys.exit(f"build_speaking_phase4: {msg}")


def stable_index(key, n, salt=""):
    return int(hashlib.sha256(f"{salt}:{key}".encode()).hexdigest(), 16) % n


def load_cards():
    cards = {}
    for f in sorted(glob.glob(os.path.join(AUTHORED, "cards_batch_*.json"))):
        for c in json.load(open(f)):
            if c["id"] in cards:
                fail(f"duplicate card {c['id']}")
            cards[c["id"]] = c
    return cards


def check_card(c, topic):
    if c["topic"] != topic:
        fail(f"{c['id']}: card topic does not match the source topic")
    b = c.get("bullets") or []
    if not (3 <= len(b) <= 4) or any(not x.strip() or x.strip()[-1] in ".?!" for x in b):
        fail(f"{c['id']}: needs 3–4 cue-card prompts without end punctuation")
    if not (c.get("final") or "").startswith("and explain"):
        fail(f"{c['id']}: final line must start with 'and explain'")
    p3 = c.get("part3") or []
    if len(p3) != 2 or any(len(t.get("questions") or []) != 3 or not t.get("theme") for t in p3):
        fail(f"{c['id']}: Part 3 needs 2 themes × 3 questions")
    if any(not q.strip().endswith("?") for t in p3 for q in t["questions"]):
        fail(f"{c['id']}: every Part 3 question must end with '?'")


def pick_part1(pkg_id, topic, frames):
    """1 introductory frame + 2 everyday frames from different families, none of
    which pre-empts the Part 2 topic."""
    def ok(f):
        return not re.search(f.get("avoidIfTopicMatches") or r"$^", topic, re.I)
    intro = [f for f in frames["introFrames"] if ok(f)] or frames["introFrames"]
    every = [f for f in frames["everydayFrames"] if ok(f)]
    chosen = [intro[stable_index(pkg_id, len(intro), "intro")]]
    families = {chosen[0].get("family")}
    start = stable_index(pkg_id, len(every), "everyday")
    for k in range(len(every)):
        f = every[(start + k * 7) % len(every)]
        if f.get("family") not in families:
            chosen.append(f)
            families.add(f.get("family"))
        if len(chosen) == 3:
            break
    if len(chosen) != 3 or any(len(f["questions"]) < PART1_PER_TOPIC for f in chosen):
        fail(f"{pkg_id}: could not assemble 3 Part 1 topics × {PART1_PER_TOPIC} questions")
    # frames list questions in examiner order (opening question first)
    return [{"topic": f["topic"], "key": f["key"], "questions": list(f["questions"][:PART1_PER_TOPIC])} for f in chosen]


def main():
    frames = json.load(open(os.path.join(AUTHORED, "part1_topics.json")))
    cards = load_cards()
    recs = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(OUT, "tests", "*.json")))]
    recs = [r for r in recs if r.get("status") != "quarantined"]
    packages = []
    seen_bullets = {}
    for r in recs:
        topic = r["cueCard"]["topic"]
        c = cards.get(r["id"])
        if c is None:
            fail(f"{r['id']}: no authored cue card")
        check_card(c, topic)
        sig = json.dumps(c["bullets"])
        if sig in seen_bullets:
            fail(f"{r['id']}: same cue-card prompts as {seen_bullets[sig]}")
        seen_bullets[sig] = r["id"]
        source = {"path": r["provenance"]["page"]["path"], "sha256": r["provenance"]["page"]["sha256"][:16],
                  "collection": "makkar-cue-cards (practicepteonline.com)"}
        packages.append({
            "id": r["id"], "slug": r["slug"], "title": topic, "hubNumber": r.get("hubNumber"),
            "part1": {"available": True, "provenanceType": PROV_AUTHORED,
                      "topics": pick_part1(r["id"], topic, frames)},
            "part2": {"available": True,
                      "topic": {"text": topic, "provenanceType": PROV_TOPIC, "source": source},
                      "cueCard": {"leadIn": "You should say:", "bullets": c["bullets"], "final": c["final"],
                                  "provenanceType": PROV_AUTHORED}},
            "part3": {"available": True, "provenanceType": PROV_AUTHORED,
                      "themes": [{"theme": t["theme"], "questions": t["questions"]} for t in c["part3"]]},
            "coverage": {"part1": "authored_practice", "part2": "source_topic_with_authored_prompts",
                         "part3": "authored_practice"},
        })
    if len(packages) != len(recs):
        fail("package count mismatch")
    json.dump({"assembly": "speaking-v5", "provenance": {PROV_TOPIC: "Part 2 topic from the source practice site",
                                                         PROV_AUTHORED: "written for Cognition in the IELTS format"},
               "packages": packages},
              open(os.path.join(OUT, "generated", "assembled_packages.json"), "w"), indent=1, ensure_ascii=False)
    stale = os.path.join(OUT, "generated", "part1_sets.json")
    if os.path.exists(stale):
        os.remove(stale)
    print("packages:", len(packages), "| part1 frames:", len(frames["introFrames"]) + len(frames["everydayFrames"]))


if __name__ == "__main__":
    main()
