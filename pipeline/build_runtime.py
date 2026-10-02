#!/usr/bin/env python3
"""
Cognition — Phase 3: production runtime bundle + DB manifests.

1. content-db/assets.json            — deterministic asset manifest (sha256 of every
                                        referenced audio/image; app paths under /wp-content)
2. content-db/index.json             — production DB manifest with exact accounting
3. src/data/production/productionContent.js — generated runtime bundle consumed by the
                                        application's data layer (same pattern as V2's
                                        browser_bundle.js; V2 itself is untouched).
"""
import json, os, re, hashlib, glob, html

REPO = "/Users/arunyagoojar/Documents/cognition"
SRC_ROOT = "/Users/arunyagoojar/Downloads/ielts-website"
OUT = os.path.join(REPO, "content-db")
RUNTIME = os.path.join(REPO, "src/data/production")

def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

def esc(s):
    return html.escape(s or "", quote=True)

BLANK_IN_TEXT = re.compile(r"\((\d{1,2})\)\s*[.…·]{0,}")
INPUT_PLACEHOLDER = "\u2426"
INPUT_ROW_LIKE = re.compile(r"^(?:\(\d{1,2}\)[….…·\s\u2426]*)+$")

def input_tag(n, qids_seen):
    qids_seen.add(n)
    return f'<input data-qid="q{n}" class="cognition-exam-input" autocomplete="off" />'


def line_to_html(line, qids_seen, skip_qids=None):
    """Convert one stimulus text line to HTML with inline inputs at blank positions.
    Blanks whose qid is in skip_qids render as static underlines (already answered
    elsewhere in the same group)."""
    skip_qids = skip_qids or set()
    out = []
    last = 0
    found = False
    for m in BLANK_IN_TEXT.finditer(line):
        n = int(m.group(1))
        out.append(esc(line[last:m.start()]))
        if n in skip_qids:
            out.append('<span class="blank-static">______</span>')
        else:
            out.append(input_tag(n, qids_seen))
        last = m.end()
        found = True
    out.append(esc(line[last:]))
    res = "".join(out)
    if not found and INPUT_PLACEHOLDER in line:
        qm = re.match(r"^\s*(\d{1,2})\.\s*", line)
        if qm:
            n = int(qm.group(1))
            ph = input_tag(n, qids_seen) if n not in skip_qids else '<span class="blank-static">______</span>'
            res = esc(line).replace(INPUT_PLACEHOLDER, ph, 1)
            if n not in skip_qids: qids_seen.add(n)
    return res

def stim_line_class(line):
    """Presentation hierarchy from deterministic text signals (source text unchanged)."""
    letters = [c for c in line if c.isalpha()]
    if letters and line.upper() == line and len(line) <= 60:
        return "stim-title"
    if line.startswith("•") or line.startswith("- "):
        return "stim-bullet"
    if len(line) <= 44 and ":" not in line and not any(c.isdigit() for c in line) \
       and not line.endswith((".", "?", "!", ",")):
        return "stim-subsection"
    return "stim-line"

def stimulus_to_html(g, qids_seen, owned=None):
    owned = owned if owned is not None else set()
    parts = []
    stim = g["stimulus"]
    # visuals are emitted separately (group.visualHtml) so each logical visual
    # renders exactly once, wherever the layout places it
    if stim.get("table"):
        rows = stim["table"]["rows"]
        if rows:
            parts.append('<table class="stimulus-table bordered">')
            for r_i, row in enumerate(rows):
                cells = []
                for cell in row:
                    segs, last = [], 0
                    for m in BLANK_IN_TEXT.finditer(cell):
                        segs.append(esc(cell[last:m.start()]))
                        n_cell = int(m.group(1))
                        if owned is not None and n_cell not in owned:
                            segs.append('<span class="blank-static">______</span>')
                        else:
                            segs.append(input_tag(n_cell, qids_seen))
                        last = m.end()
                    segs.append(esc(cell[last:]))
                    cells.append("".join(segs).replace(INPUT_PLACEHOLDER, ""))
                parts.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>")
            parts.append("</table>")
    cell_text = " ".join(" ".join(r) for r in (stim.get("table") or {}).get("rows", [])) if stim.get("table") else ""
    emitted_qids = set()
    for seg in (stim.get("segments") or []):
        for line in seg.split("\n"):
            stripped = line.strip()
            line_qids = {int(m.group(1)) for m in re.finditer(r"\((\d{1,2})\)", stripped)}
            if "\u2426" in stripped and not line_qids:
                qm = re.match(r"^(\d{1,2})\.", stripped)
                if qm: line_qids = {int(qm.group(1))}
            # a blank is rendered exactly once per group: prose lines win over the
            # site's bare interactive-input rows; table cells win over both
            is_bare_input_row = bool(INPUT_ROW_LIKE.match(stripped)) or (
                "\u2426" in stripped and len(stripped) <= 14 and not re.search(r"[A-Za-z]{3}", stripped))
            if (line_qids & emitted_qids) or (is_bare_input_row and (line_qids & (qids_seen | emitted_qids))):
                continue
            if stim.get("table") and (INPUT_ROW_LIKE.match(stripped)
                                       or (stripped and stripped in cell_text and len(stripped) > 2)):
                continue
            h = line_to_html(line, qids_seen, skip_qids=(emitted_qids | (set(line_qids) - owned)))
            emitted_qids |= line_qids
            if h.strip():
                cls = stim_line_class(stripped)
                parts.append(f'<p class="{cls}">{h}</p>')
    if stim.get("sharedOptions"):
        opts = " ".join(f"<strong>{esc(o['letter'])}</strong> {esc(o['text'] or '—')}" for o in stim["sharedOptions"])
        parts.append(f'<p class="stimulus-options">{opts}</p>')
    # every answerable blank is an inline <input data-qid>; remaining placeholder
    # glyphs are the source site's input-box artifacts
    return "\n".join(parts).replace(INPUT_PLACEHOLDER, "")

QUESTION_TYPE_MAP = {
    "completion": ("fill_in_blank", "text"),
    "short_answer": ("short_answer", "text"),
    "mcq_single": ("multiple_choice", "single_select"),
    "mcq_multi": ("multiple_choice", "multi_select"),
    "matching_box": ("matching", "single_select"),
    "map_labeling": ("map_labeling", "single_select"),
    "diagram_labeling": ("diagram_labeling", "single_select"),
}

def build_listening_runtime(rec):
    """Production record → runtime test object (module shape, answers included;
    the adapter gates answers by includeAnswers like the V2 flow)."""
    parts = {}
    qids_seen = set()
    for g in rec["questionGroups"]:
        if g["status"] == "quarantined":
            continue
        gqs = [q for q in g["questions"] if q["status"] == "verified"]
        if not gqs:
            continue
        part = g["part"]
        if part is None:
            # single part-less group covering the first section: explicit rule + warning
            part = 1
            g["partRule"] = "first_section_default"
        p = parts.setdefault(part, {"part": part, "groups": []})
        p["groups"].append((g, gqs))
    part_list = []
    for part in sorted(parts):
        p = parts[part]
        group_objs, flat_qs, html_parts = [], [], []
        owned_by_group = {id(g): {q["number"] for q in gqs} for g, gqs in p["groups"]}
        for g, gqs in p["groups"]:
            gh = stimulus_to_html(g, qids_seen, owned=owned_by_group[id(g)])
            html_parts.append(gh)
            q_objs = []
            for q in gqs:
                qtype, input_type = QUESTION_TYPE_MAP.get(q["type"], ("fill_in_blank", "text"))
                opts = None
                if q.get("options"):
                    opts = [{"id": o["letter"], "label": o["text"] or ""} for o in q["options"]]
                elif g["stimulus"].get("sharedOptions") and q["type"] in ("matching_box", "map_labeling", "diagram_labeling", "mcq_multi"):
                    opts = [{"id": o["letter"], "label": o["text"] or ""} for o in g["stimulus"]["sharedOptions"]]
                elif q["type"] in ("map_labeling", "diagram_labeling"):
                    # letters live on the visual itself; derive the range from the
                    # group instruction ("Write the correct letter A-I next to…")
                    m = re.search(r"letter ([A-Z])[-–]([A-Z])", g["instruction"]["text"] or "")
                    if m:
                        a, b = ord(m.group(1)), ord(m.group(2))
                        if a <= b <= a + 12:
                            opts = [{"id": chr(c), "label": ""} for c in range(a, b + 1)]
                stem = q["stem"] or {}
                text_plain = stem.get("plain") or ""
                prompt, suffix = text_plain, ""
                if q["type"] in ("completion",) and stem.get("segments"):
                    pre = [s for s in stem["segments"] if isinstance(s, str)]
                    prompt = text_plain
                ans = q.get("correctAnswer")
                q_objs.append({
                    "id": f"q{q['number']}",
                    "questionNumber": q["number"],
                    "questionType": qtype,
                    "inputType": input_type,
                    "questionText": esc(text_plain) or "(answer in the stimulus)",
                    "prompt": prompt,
                    "suffix": suffix,
                    "options": opts,
                    "answer": ans if ans not in ("", None) else None,
                    "type": q["type"],
                })
            flat_qs.extend(q_objs)
            visual_html = None
            if g["stimulus"].get("figures"):
                def _fig_url(f):
                    rel = f[len("wp-content/"):] if f.startswith("wp-content/") else f
                    return f'<img src="/wp-content/{esc(rel)}" style="max-width:100%" alt="test stimulus" />'
                visual_html = "\n".join(_fig_url(f) for f in g["stimulus"]["figures"])
            group_objs.append({
                "groupId": g["groupId"],
                "instructions": g["instruction"]["text"] or None,
                "wordLimit": g["instruction"].get("wordLimit") or None,
                "groupType": g["stimulus"]["kind"],
                "visualHtml": visual_html,
                "options": ([{"id": o["letter"], "label": o["text"] or ""} for o in g["stimulus"]["sharedOptions"]]
                             if g["stimulus"].get("sharedOptions") else None),
                "htmlContent": gh,
                "questions": q_objs,
            })
        audio = rec["audio"]
        audio_file = None
        if audio.get("asset") and audio.get("status") == "resolved":
            rp = audio["asset"]["resolvedPath"]
            audio_file = "/" + rp
        part_list.append({
            "part": part,
            "title": f"Section {part}",
            "instructions": f"Listening Section {part}. Answer all questions.",
            "audioFile": audio_file,
            "htmlContent": "\n".join(html_parts),
            "questions": flat_qs,
            "questionGroups": group_objs,
        })
    audio = rec["audio"]
    return {
        "id": rec["id"],
        "testId": rec["sourceNumbers"][0],
        "slug": rec["slug"],
        "title": rec["title"],
        "status": rec["status"],
        "cambridgeIdentity": rec.get("cambridgeIdentity") or [],
        "audio": {
            "appPath": ("/" + audio["asset"]["resolvedPath"]) if audio.get("asset") and audio.get("status") == "resolved" else None,
            "durationSeconds": audio.get("durationSeconds"),
            "flags": audio.get("flags") or [],
            "status": audio.get("status"),
        },
        "images": [{"appPath": "/" + i["resolvedPath"], "exists": i["exists"]} for i in rec.get("images", [])],
        "source": {"slug": rec["slug"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
        "parts": part_list,
        "verifiedQuestionCount": rec.get("verifiedQuestionCount"),
    }

def build_speaking_runtime(rec):
    """Phase 4: full 3-part packages. Part 2 topic = authentic Makkar (SOURCE_PRACTICE);
    bullets + Part 1/3 = generated practice, provenance-tagged per item."""
    assembled = ASSEMBLED_BY_SLUG.get(rec["slug"], {})
    return {
        "id": rec["id"],
        "slug": rec["slug"],
        "title": rec["cueCard"]["topic"] or rec["title"],
        "hubNumber": rec.get("hubNumber"),
        "status": rec["status"],
        "category": assembled.get("category"),
        "cueCard": {"topic": rec["cueCard"]["topic"],
                     "leadIn": assembled.get("part2", {}).get("cueCard", {}).get("leadIn", "You should say:"),
                     "bulletPrompts": assembled.get("part2", {}).get("cueCard", {}).get("bullets", []),
                     "finalInstruction": assembled.get("part2", {}).get("cueCard", {}).get("final", ""),
                     "bulletsNote": rec["cueCard"]["bulletsNote"]},
        "part1": assembled.get("part1", {"available": False}),
        "part3": assembled.get("part3", {"available": False}),
        "coverage": {"part1": assembled.get("part1", {}).get("available") and "generated_practice" or "unavailable",
                      "part2": "available",
                      "part3": assembled.get("part3", {}).get("available") and "generated_practice" or "unavailable"},
        "sampleAnswer": {"sentences": rec["sampleAnswer"]["sentences"],
                          "usage": rec["sampleAnswer"]["usage"]},
        "source": {"slug": rec["slug"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
    }

ASSEMBLED = json.load(open(os.path.join(OUT, "speaking/generated/assembled_packages.json")))

# ---------- production Reading ----------
def reading_passage_html(p):
    """Renderer contract: real passage paragraphs; asset markers → project images."""
    html = []
    if p.get("title"):
        html.append(f'<h3 class="reading-passage-title">{esc(p["title"])}</h3>')
    for para in p.get("paragraphs", []):
        m = re.match(r"\[asset:(asset\.[0-9a-f]+)\]", para)
        if m:
            aid = m.group(1)
            asset = next((a for a in p.get("assets", []) if a["assetId"] == aid), None)
            if asset:
                html.append(f'<img src="{esc(asset["projectPath"])}" alt="reading passage visual" style="max-width:100%;height:auto;margin:10px 0;border:1px solid var(--border);border-radius:8px;" />')
            continue
        m2 = re.match(r"\[asset-missing:(.+?)\]", para)
        if m2: continue
        html.append(f'<p>{esc(para)}</p>')
    return "\n".join(html)

def reading_group_html(g):
    html = []
    for seg in (g.get("stimulusSegments") or []):
        m = re.match(r"^__TABLE__(.*)$", seg, re.S)
        if m:
            rows = json.loads(m.group(1))
            if rows:
                html.append('<table class="writing-table">')
                for i, row in enumerate(rows):
                    html += ["<tr>" + "".join(
                        f'<{"th" if i == 0 else "td"}>{esc(c)}</{"th" if i == 0 else "td"}>'
                        for c in row) + "</tr>"]
                html.append("</table>")
            continue
        if seg.strip():
            html.append(f'<p class="stim-line">{esc(seg)}</p>')
    if g.get("sharedOptions"):
        opts = " ".join(f'<strong>{esc(o["letter"])}</strong> {esc(o["text"] or "—")}' for o in g["sharedOptions"])
        html.append(f'<p class="stimulus-options">{opts}</p>')
    return "\n".join(html)

def reading_question_html(g, q):
    st = q["stem"] or {}
    segs = st.get("segments") or []
    if segs:
        parts = []
        for s in segs:
            parts.append("______" if isinstance(s, dict) else esc(s))
        return " ".join(parts)
    return esc(st.get("plain") or "")

def build_reading_runtime(rec):
    passages = []
    for p in rec.get("passages", []):
        groups, flat, html_parts = [], [], []
        for g in p.get("questionGroups", []):
            gh = reading_group_html(g)
            html_parts.append(gh)
            q_objs = []
            for q in g["questions"]:
                qtype = q["type"]
                input_type = "text"
                options = None
                if qtype == "mcq_single":
                    input_type = "single_select"
                    options = q.get("options") or None
                elif qtype in ("matching_headings", "matching_information", "matching_features", "matching_box"):
                    input_type = "single_select"
                    options = g.get("sharedOptions") or None
                    if qtype == "tfng": input_type = "text"
                elif qtype == "tfng":
                    input_type = "text"
                elif qtype == "ynng":
                    input_type = "text"
                q_objs.append({
                    "id": f"q{q['number']}", "questionNumber": q["number"],
                    "questionType": qtype, "inputType": input_type,
                    "questionText": reading_question_html(g, q),
                    "prompt": q["stem"].get("plain") or "",
                    "options": [{"id": o["letter"], "label": o["text"] or ""} for o in options] if options else None,
                    "answer": q.get("correctAnswer"),
                })
            flat.extend(q_objs)
            groups.append({
                "groupId": g["groupId"], "groupType": g["qtype"],
                "instructions": g["instruction"] or None, "wordLimit": g.get("wordLimit") or None,
                "options": ([{"id": o["letter"], "label": o["text"] or ""} for o in g["sharedOptions"]]
                             if g.get("sharedOptions") else None),
                "htmlContent": gh, "questions": q_objs,
            })
        passages.append({
            "passageNumber": p["passageNumber"], "title": p.get("title") or f"Passage {p['passageNumber']}",
            "htmlContent": reading_passage_html(p),
            "assets": [{"projectPath": a["projectPath"]} for a in p.get("assets", [])],
            "questions": flat, "questionGroups": groups,
        })
    return {
        "id": rec["id"], "testId": rec["sourceNumbers"][0], "slug": rec["slug"],
        "title": rec["title"], "kind": rec["kind"], "status": rec["status"],
        "passages": passages,
        "source": {"slug": rec["slug"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
    }

# ---------- production Writing ----------
def writing_task_html(task):
    """Renderer contract: plain escaped prompt; Task 1 adds the exact source
    visual (image) or a real HTML table — never both, never a flattening."""
    html = esc(task["prompt"])
    if task.get("visual"):
        rel = task["visual"]["sourcePath"]
        rel = rel[len("wp-content/"):] if rel.startswith("wp-content/") else rel
        html += f'<img src="/wp-content/{esc(rel)}" alt="Task 1 visual ({esc(task["visual"]["visualType"])})" style="width:100%;max-width:640px;height:auto;display:block;margin:16px auto;border:1px solid var(--border);border-radius:8px;" />'
    elif task.get("table") and task["table"].get("rows"):
        rows = task["table"]["rows"]
        html += '<table class="writing-table">'
        for i, row in enumerate(rows):
            html += "<tr>" + "".join(
                f'<{"th" if i == 0 else "td"}>{esc(c)}</{"th" if i == 0 else "td"}>' for c in row) + "</tr>"
        html += "</table>"
    return html

def build_writing_runtime(rec):
    wt = {"id": rec["id"], "testId": rec["sourceNumbers"][0], "slug": rec["slug"],
           "title": rec["title"], "kind": rec["kind"], "status": rec["status"]}
    t1 = rec.get("task1")
    t2 = rec.get("task2")
    if t1:
        wl = t1.get("wordLimitMin") or 150
        wt["task1"] = {
            "id": f"{rec['id']}.task1",
            "prompt": t1["prompt"],
            "promptHtml": writing_task_html(t1),
            "instructions": f"Write at least {wl} words." if not t1["prompt"].lower().endswith(".") else "",
            "wordLimitMin": t1.get("wordLimitMin"),
            "visualType": (t1.get("visual") or {}).get("visualType") or (t1.get("table") or {}).get("visualType") or None,
            "image": ({"file": "/" + t1["visual"]["sourcePath"]} if t1.get("visual") else None),
            "table": t1.get("table"),
            "provenance": {"page": rec["provenance"]["page"]["path"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
        }
    if t2:
        wl = t2.get("wordLimitMin") or 250
        wt["task2"] = {
            "id": f"{rec['id']}.task2",
            "prompt": t2["prompt"],
            "promptHtml": writing_task_html(t2),
            "wordLimitMin": t2.get("wordLimitMin"),
            "provenance": {"page": rec["provenance"]["page"]["path"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
        }
    return wt
ASSEMBLED_BY_SLUG = {p["slug"]: p for p in ASSEMBLED["packages"]}

def main():
    os.makedirs(RUNTIME, exist_ok=True)
    # ---- assets manifest (referenced audio + images, hashed) ----
    assets, missing = [], []
    for f in sorted(glob.glob(os.path.join(OUT, "listening", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] == "duplicate": continue
        a = rec["audio"]
        if a.get("asset") and a.get("status") == "resolved":
            p = os.path.join(SRC_ROOT, a["asset"]["resolvedPath"])
            assets.append({"kind": "audio", "path": a["asset"]["resolvedPath"],
                            "appPath": "/" + a["asset"]["resolvedPath"],
                            "bytes": a["asset"].get("bytes"), "sha256": sha256_file(p) if os.path.exists(p) else None,
                            "durationSeconds": a.get("durationSeconds"),
                            "role": "full_test_audio", "usedBy": rec["slug"],
                            "flags": a.get("flags") or []})
            if not os.path.exists(p): missing.append(a["asset"]["resolvedPath"])
        for img in rec.get("images", []):
            p = os.path.join(SRC_ROOT, img["resolvedPath"])
            if not img["exists"] or not os.path.exists(p):
                missing.append(img["resolvedPath"]); continue
            assets.append({"kind": "image", "path": img["resolvedPath"], "appPath": "/" + img["resolvedPath"],
                            "sha256": sha256_file(p), "role": "question_visual", "usedBy": rec["slug"]})
    json.dump({"version": "1.0", "strategy": "in-place reference with content-addressed identity; app serves via /wp-content (dev public dir)",
                "assets": assets, "missing": missing},
               open(os.path.join(OUT, "assets.json"), "w"), indent=1)
    print("assets:", len(assets), "missing:", len(missing))

    # ---- runtime bundles ----
    listen_runtime, speak_runtime, write_runtime, read_runtime = [], [], [], []
    excluded = []
    for f in sorted(glob.glob(os.path.join(OUT, "listening", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] == "duplicate":
            excluded.append({"slug": rec["slug"], "reason": "duplicate", "duplicateOf": rec.get("duplicateOf")})
            continue
        if rec["status"] == "quarantined" or rec.get("schemaErrors"):
            excluded.append({"slug": rec["slug"], "reason": "quarantined"})
            continue
        if rec.get("verifiedQuestionCount", 0) == 0:
            excluded.append({"slug": rec["slug"], "reason": "no verified questions"})
            continue
        listen_runtime.append(build_listening_runtime(rec))
    for f in sorted(glob.glob(os.path.join(OUT, "speaking", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] == "quarantined":
            excluded.append({"slug": rec["slug"], "reason": "quarantined"})
            continue
        speak_runtime.append(build_speaking_runtime(rec))
    for f in sorted(glob.glob(os.path.join(OUT, "reading", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] in ("quarantined", "duplicate") or rec.get("kind") not in ("full_test", "practice_test"):
            excluded.append({"slug": rec["slug"], "reason": rec["status"] or "incomplete"})
            continue
        read_runtime.append(build_reading_runtime(rec))
    for f in sorted(glob.glob(os.path.join(OUT, "writing", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] in ("quarantined", "duplicate") or rec.get("kind") not in ("complete_test", "task1_only", "task2_only"):
            excluded.append({"slug": rec["slug"], "reason": rec["status"] or "incomplete"})
            continue
        write_runtime.append(build_writing_runtime(rec))

    js = (
        "// AUTO-GENERATED by pipeline/build_runtime.py — Cognition production content (Phase 3)\n"
        "// Source: content-db (listening + speaking). Deterministic; do not edit by hand.\n"
        "export const PRODUCTION_LISTENING = " + json.dumps(listen_runtime, ensure_ascii=False, separators=(",", ":")) + ";\n\n"
        "export const PRODUCTION_SPEAKING = " + json.dumps(speak_runtime, ensure_ascii=False, separators=(",", ":")) + ";\n\n"
        "export const PRODUCTION_WRITING = " + json.dumps(write_runtime, ensure_ascii=False, separators=(",", ":")) + ";\n\n"
        "export const PRODUCTION_READING = " + json.dumps(read_runtime, ensure_ascii=False, separators=(",", ":")) + ";\n\n"
        "export const PRODUCTION_META = " + json.dumps({
            "generatedBy": "pipeline/build_runtime.py (Phase 3)",
            "listeningTests": len(listen_runtime),
            "speakingPackages": len(speak_runtime),
            "writingTests": len(write_runtime),
            "readingTests": len(read_runtime),
            "excluded": excluded,
        }, ensure_ascii=False, indent=1) + ";\n"
    )
    with open(os.path.join(RUNTIME, "productionContent.js"), "w") as fjs:
        fjs.write(js)
    print("runtime bundle: listening tests =", len(listen_runtime), "| speaking packages =", len(speak_runtime),
          "| excluded =", len(excluded), "| size MB =", round(len(js) / 1e6, 1))

    # ---- production DB index with exact accounting ----
    l_tally = defaultdict_run = {}
    from collections import Counter
    lt = Counter()
    qcount = Counter()
    for f in sorted(glob.glob(os.path.join(OUT, "listening", "tests", "*.json"))):
        rec = json.load(open(f))
        lt[rec["status"]] += 1
        qcount[rec["status"]] += sum(len(g["questions"]) for g in rec.get("questionGroups", []))
    st = Counter()
    for f in sorted(glob.glob(os.path.join(OUT, "speaking", "tests", "*.json"))):
        st[json.load(open(f))["status"]] += 1
    index = {
        "database": "Cognition production content (Phase 3)",
        "listening": {
            "tests": dict(lt), "questionsByTestStatus": dict(qcount),
            "questions_total": sum(qcount.values()),
            "questions_verified": sum(v for k, v in qcount.items() if k in ("verified", "flagged")),
            "emitted_to_runtime": len(listen_runtime),
        },
        "speaking": {
            "packages": dict(st), "emitted_to_runtime": len(speak_runtime),
        },
        "excluded_from_runtime": excluded,
    }
    json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=1)
    print("content-db/index.json written")

if __name__ == "__main__":
    main()
