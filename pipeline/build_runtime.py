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

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_ROOT = os.path.join(REPO, "public-static")
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
            pool = g.get("optionPool") or None
            selection = g.get("selection") or None
            render_g = g
            if pool and pool.get("source") == "stimulus_lines":
                # the option list is shown once as the group's pool, not again as text
                render_g = json.loads(json.dumps(g))
                segs = list(render_g["stimulus"].get("segments") or [])
                if 0 <= pool.get("segmentIndex", -1) < len(segs):
                    segs.pop(pool["segmentIndex"])
                render_g["stimulus"]["segments"] = segs or None
            gh = stimulus_to_html(render_g, qids_seen, owned=owned_by_group[id(g)])
            html_parts.append(gh)
            q_objs = []
            for q in gqs:
                qtype, input_type = QUESTION_TYPE_MAP.get(q["type"], ("fill_in_blank", "text"))
                opts = None
                if pool and (selection or q["type"] in ("matching_box", "map_labeling", "diagram_labeling")) \
                        and not q.get("options"):
                    opts = [{"id": o["letter"], "label": o.get("text") or ""} for o in pool["options"]]
                elif q.get("options"):
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
                ctx = None
                for seg in (g["stimulus"].get("segments") or []):
                    for line in seg.split("\n"):
                        if f"({q['number']})" in line:
                            ctx = line
                            break
                    if ctx:
                        break
                if not ctx and g["stimulus"].get("table"):
                    rows = g["stimulus"]["table"].get("rows", [])
                    for row in rows:
                        if any(f"({q['number']})" in c for c in row):
                            header = " | ".join(rows[0]) if rows and rows[0] is not row else ""
                            ctx = (f"[{header}] " if header else "") + " | ".join(row)
                            break
                if ctx:
                    ctx = re.sub(r"\s+", " ", re.sub(r"\(\d{1,2}\)\s*[.…·_\u2426]*", "____", ctx)).strip()
                # prefer exactly what the candidate sees: the rendered row/line holding this input
                seen = rendered_context(gh, q["number"])
                if seen and (not ctx or not re.search(r"[A-Za-z]{3}", ctx.replace("____", ""))):
                    ctx = seen
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
                    "context": ctx or (text_plain or None),
                    "instruction": _with_limit(g["instruction"]["text"], g["instruction"].get("wordLimit")),
                    **({"unorderedGroup": selection["unorderedGroup"]} if selection else {}),
                })
            flat_qs.extend(q_objs)
            visual_html = None
            if g["stimulus"].get("figures"):
                def _fig_url(f):
                    rel = f[len("wp-content/"):] if f.startswith("wp-content/") else f
                    return f'<img src="/wp-content/{esc(rel)}" style="max-width:100%" alt="test stimulus" />'
                visual_html = "\n".join(_fig_url(f) for f in g["stimulus"]["figures"])
            instr_text = g["instruction"]["text"] or None
            if selection and selection.get("instructionText"):
                instr_text = selection["instructionText"]
            elif pool and pool.get("source") == "instruction":
                instr_text = pool.get("instructionText") or instr_text
            group_objs.append({
                "groupId": g["groupId"],
                "instructions": instr_text,
                "selection": ({"selectCount": selection["selectCount"], "prompt": selection.get("prompt"),
                               "unorderedGroup": selection["unorderedGroup"],
                               "options": [{"id": o["letter"], "label": o.get("text") or ""} for o in pool["options"]]}
                              if selection and pool else None),
                "optionPool": ({"title": pool.get("title"),
                                "options": [{"id": o["letter"], "label": o.get("text") or ""} for o in pool["options"]]}
                               if pool and not selection and pool.get("source") != "box" else None),
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

LISTENING_ARTIFACT = re.compile(r"\[orphan|Show Answers?|\u2426|_{4,}|(?:[.…·]\s?){5,}|\(answer in the stimulus\)")


def _with_limit(instruction, word_limit):
    """Group instruction plus its word limit, without repeating the limit."""
    text = (instruction or "").strip()
    if word_limit and word_limit.lower() not in text.lower():
        text = f"{text} ({word_limit})".strip()
    return text or None


def rendered_context(group_html, n):
    """The table row (with its header row) or paragraph that holds input qN in
    the rendered stimulus, as plain text with inputs shown as ____."""
    if not group_html:
        return None
    marker = f'data-qid="q{n}"'

    def plain(fragment):
        t = re.sub(r"<input[^>]*>", " ____ ", fragment)
        t = re.sub(r"</t[dh]>", " | ", t)
        t = html.unescape(re.sub(r"<[^>]+>", " ", t))
        return re.sub(r"\s+", " ", t).strip(" |")

    for table in re.findall(r"<table.*?</table>", group_html, flags=re.S):
        rows = re.findall(r"<tr>.*?</tr>", table, flags=re.S)
        for k, row in enumerate(rows):
            if marker in row:
                head = plain(rows[0]) if k > 0 and rows else ""
                return (f"[{head}] " if head else "") + plain(row)
    paras = re.findall(r"<p[^>]*>.*?</p>", group_html, flags=re.S)
    for k, para in enumerate(paras):
        if marker in para:
            own = plain(para)
            # a bare line ("• ____") is read with the lines above it, like a candidate does
            j = k
            lines = [own]
            while not re.search(r"[A-Za-z]{3}", " ".join(lines).replace("____", "")) and j > 0 and len(lines) < 4:
                j -= 1
                lines.insert(0, plain(paras[j]))
            if len(lines) == 1 and k > 0:
                lines.insert(0, plain(paras[k - 1]))  # one line of lead-in context
            return " / ".join(x for x in lines if x)
    return None


def listening_runtime_defects(rt):
    """Render gate for a full Listening test: everything a candidate needs to
    answer each of questions 1–40 exactly once, with a key the control can produce."""
    d = []
    if not (rt.get("audio") or {}).get("appPath"):
        d.append("audio: missing")
    seen = []
    for p in rt["parts"]:
        lo, hi = (p["part"] - 1) * 10 + 1, p["part"] * 10
        html_all = " ".join(g["htmlContent"] or "" for g in p["questionGroups"])
        for m in re.finditer(r'data-qid="q(\d+)"', html_all):
            n = int(m.group(1))
            if not any(q["questionNumber"] == n for q in p["questions"]):
                d.append(f"q{n}: inline input without a question")
        inline = [int(n) for n in re.findall(r'data-qid="q(\d+)"', html_all)]
        if len(inline) != len(set(inline)):
            d.append(f"part {p['part']}: an inline blank renders twice")
        if LISTENING_ARTIFACT.search(html_all):
            d.append(f"part {p['part']}: artifact in stimulus ({LISTENING_ARTIFACT.search(html_all).group(0)!r})")
        for g in p["questionGroups"]:
            if not (g.get("instructions") or "").strip():
                d.append(f"{g['groupId']}: no instruction")
            # a list of empty answer lines (no words, no figure) is ambiguous:
            # the candidate cannot tell which line asks for what
            if not g.get("visualHtml"):
                run = longest = 0
                for para in re.findall(r"<p[^>]*>.*?</p>", g.get("htmlContent") or "", flags=re.S):
                    words = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<input[^>]*>", " ", para)))
                    if "data-qid=" in para and not re.search(r"[A-Za-z0-9]{2}", words):
                        run += 1
                        longest = max(longest, run)
                    else:
                        run = 0  # a line with words (e.g. "What TWO images…?") resets the run
                if longest >= 3:
                    d.append(f"{g['groupId']}: {longest} answer lines in a row carry no text")
            sel = g.get("selection")
            if sel:
                vals = [q["answer"] for q in g["questions"]]
                ids = [o["id"] for o in sel["options"]]
                if sel["selectCount"] != len(g["questions"]) or len(set(vals)) != len(vals) or any(v not in ids for v in vals):
                    d.append(f"{g['groupId']}: multi-select set invalid")
                if any(not o["label"].strip() for o in sel["options"]):
                    d.append(f"{g['groupId']}: multi-select option without text")
            for q in g["questions"]:
                n = q["questionNumber"]
                seen.append(n)
                if not (lo <= n <= hi):
                    d.append(f"q{n}: outside part {p['part']}")
                a = q.get("answer")
                if a in (None, ""):
                    d.append(f"q{n}: no answer")
                # what the candidate sees: an inline blank lives in the stimulus; a
                # "choose N" slot is shown by its group prompt; anything else stands alone
                standalone = n not in inline and not sel
                qtext = q.get("questionText") or ""
                if standalone:
                    words = re.sub(r"_{3,}|\(answer in the stimulus\)", " ", qtext)
                    if not re.search(r"[A-Za-z]{2,}", words):
                        d.append(f"q{n}: standalone question without text")
                    if re.search(r"\[orphan|Show Answers?|\u2426|\(answer in the stimulus\)", qtext):
                        d.append(f"q{n}: artifact in question text")
                if any(LISTENING_ARTIFACT.search(o.get("label") or "") for o in q.get("options") or []):
                    d.append(f"q{n}: artifact in options")
                if q["inputType"] in ("single_select", "multi_select"):
                    ids = [o["id"] for o in q.get("options") or []]
                    if len(ids) < 2 or len(set(ids)) != len(ids):
                        d.append(f"q{n}: selection without a usable option list")
                    elif str(a).strip() not in ids:
                        d.append(f"q{n}: answer {a!r} not among options")
                    if q["inputType"] == "multi_select" and not sel:
                        d.append(f"q{n}: multi-select outside a selection group")
                    if q["type"] == "mcq_single" and not (q.get("prompt") or "").strip():
                        d.append(f"q{n}: multiple choice without a question")
                else:
                    if re.fullmatch(r"[A-Z]", str(a).strip()):
                        d.append(f"q{n}: letter key on a typed answer")
                    if standalone and not re.search(r"[A-Za-z]{2,}", re.sub(r"_{3,}", " ", q.get("prompt") or "")):
                        d.append(f"q{n}: typed answer with no blank and no question")
    if sorted(seen) != list(range(1, 41)):
        d.append(f"numbering: {len(seen)} questions, missing {sorted(set(range(1, 41)) - set(seen))[:8]}")
    return d


def build_speaking_runtime(rec):
    """IELTS-format package: Part 1 (3 topics × 4), Part 2 cue card, Part 3
    (2 themes × 3). Provenance travels per part so the UI can label it honestly:
    the Part 2 topic comes from the source practice site; prompts, Part 1 and
    Part 3 were written for Cognition in the IELTS format."""
    a = ASSEMBLED_BY_SLUG[rec["slug"]]
    p2 = a["part2"]
    return {
        "id": rec["id"],
        "slug": rec["slug"],
        "title": p2["topic"]["text"],
        "hubNumber": rec.get("hubNumber"),
        "status": rec["status"],
        "cueCard": {"topic": p2["topic"]["text"], "leadIn": p2["cueCard"]["leadIn"],
                    "bulletPrompts": p2["cueCard"]["bullets"], "finalInstruction": p2["cueCard"]["final"]},
        "part1": a["part1"],
        "part3": a["part3"],
        "provenance": {"part1": a["part1"]["provenanceType"], "part2Topic": p2["topic"]["provenanceType"],
                       "part2Prompts": p2["cueCard"]["provenanceType"], "part3": a["part3"]["provenanceType"]},
        "coverage": a["coverage"],
        "sampleAnswer": {"sentences": rec["sampleAnswer"]["sentences"], "usage": rec["sampleAnswer"]["usage"]},
        "source": {"slug": rec["slug"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
    }

ASSEMBLED = json.load(open(os.path.join(OUT, "speaking/generated/assembled_packages.json")))

# ---------- production Reading ----------
# Runtime contract (v2): the renderer receives structured data only — passage
# paragraphs, group instructions, option pools, stimulus segments with blank
# tokens, and one answer control per question. No HTML is parsed at runtime.
READING_INPUT = {"tfng": "tfng", "ynng": "ynng", "single_choice": "single_select",
                 "pool_select": "pool_select", "multi_choice": "multi_select", "text": "text"}


_SMALL_WORDS = {"a", "an", "the", "and", "but", "or", "nor", "of", "in", "on", "at", "to", "for", "by", "with", "from", "as", "vs"}


def display_title(title):
    """Some source titles are typed entirely in lower case ("reiki"). Title-case
    those for display only; any title with capitals is left exactly as written."""
    if not title or title != title.lower():
        return title
    words = title.split()
    return " ".join(w if (0 < i < len(words) - 1 and w in _SMALL_WORDS) else w[:1].upper() + w[1:]
                    for i, w in enumerate(words))


def reading_asset_src(assets_by_id, asset_id):
    a = assets_by_id.get(asset_id)
    return a["projectPath"] if a and a.get("status") == "in_r2" else None


def build_reading_runtime(rec):
    assets_by_id = {}
    for p in rec["passages"]:
        for a in p.get("assets") or []:
            assets_by_id[a["assetId"]] = a
        for g in p["questionGroups"]:
            for a in g.get("figures") or []:
                assets_by_id[a["assetId"]] = a
    passages = []
    for p in rec["passages"]:
        paragraphs = []
        for x in p["paragraphs"]:
            if x["type"] == "image":
                src = reading_asset_src(assets_by_id, x["asset"])
                if src:
                    paragraphs.append({"type": "image", "src": src})
            elif x["type"] == "table":
                paragraphs.append({"type": "table", "rows": x["rows"]})
            elif x["type"] == "subheading":
                paragraphs.append({"type": "subheading", "text": x["text"]})
            else:
                paragraphs.append({"type": "text", "text": x["text"], **({"label": x["label"]} if x.get("label") else {})})
        groups, flat = [], []
        for g in p["questionGroups"]:
            if g["status"] != "production":
                continue
            control = g["answerControl"]
            stimulus = None
            if g.get("stimulus"):
                blocks = []
                for b in g["stimulus"]["blocks"]:
                    if b["type"] == "image":
                        src = reading_asset_src(assets_by_id, b.get("asset"))
                        if not src:
                            raise SystemExit(f"{rec['slug']} {g['groupId']}: production stimulus image not in R2")
                        blocks.append({"type": "image", "src": src})
                    else:
                        blocks.append(b)
                stimulus = {"title": g["stimulus"].get("title"), "blocks": blocks}
            pool = None
            if g.get("optionPool"):
                pool = {"title": g["optionPool"].get("title"),
                        "options": [{"id": o["id"], "label": o["text"]} for o in g["optionPool"]["options"]]}
            # the sentence / table row each stimulus blank sits in (examiner context
            # for the AI answer check; the blank itself shown as ____)
            blank_context = {}
            for b in (g.get("stimulus") or {}).get("blocks", []):
                cells = [b.get("segments")] if b["type"] == "text" else (
                    [c for row in b["rows"] for c in row] if b["type"] == "table" else [])
                row_texts = []
                if b["type"] == "table":
                    head = " | ".join("".join(x if isinstance(x, str) else "____" for x in c) for c in b["rows"][0])
                    for ri, row in enumerate(b["rows"]):
                        t_ = " | ".join("".join(x if isinstance(x, str) else "____" for x in c) for c in row)
                        row_texts.append(t_ if ri == 0 else f"[{head}] {t_}")
                for k, segs in enumerate(cells):
                    for x in segs or []:
                        if isinstance(x, dict):
                            line = "".join(y if isinstance(y, str) else "____" for y in segs)
                            if b["type"] == "table":
                                line = next((r for r in row_texts if line in r), line)
                            blank_context[x["blank"]] = re.sub(r"\s+", " ", line).strip()
            instruction = _with_limit(g.get("instruction"), g.get("wordLimit")) or ""
            q_objs = []
            for q in g["questions"]:
                a = q["answer"]
                own_text = "".join(s_ if isinstance(s_, str) else "____" for s_ in (q.get("prompt") or [])).strip()
                q_objs.append({
                    "id": f"q{q['number']}", "questionNumber": q["number"],
                    "groupId": g["groupId"], "questionType": g["type"],
                    "inputType": READING_INPUT[control],
                    "prompt": q.get("prompt"),
                    "questionText": own_text,
                    "context": blank_context.get(q["number"]) or own_text or None,
                    "instruction": instruction or None,
                    "options": ([{"id": o["id"], "label": o["text"]} for o in q["options"]]
                                if q.get("options") else None),
                    "blankInStimulus": bool(q.get("blankInStimulus")),
                    "labelInFigure": bool(q.get("labelInFigure")),
                    "answer": a["value"],
                    "acceptedAnswers": a["accepted"],
                    "wordLimit": g.get("wordLimit"),
                    **({"unorderedGroup": g["groupId"]} if g["type"] == "mcq_multi" else {}),
                })
            flat.extend(q_objs)
            groups.append({
                "groupId": g["groupId"], "groupType": g["type"], "answerControl": control,
                "startQ": g["startQ"], "endQ": g["endQ"],
                "instructions": g.get("instruction"), "notes": g.get("notes"),
                "wordLimit": g.get("wordLimit"), "selectCount": g.get("selectCount"),
                "optionPool": pool, "stimulus": stimulus, "questions": q_objs,
            })
        passages.append({
            "passageNumber": p["passageNumber"],
            "title": display_title(p.get("title")) or f"Reading Passage {p['passageNumber']}",
            "paragraphs": paragraphs,
            "passageText": " ".join(x.get("text", "") for x in paragraphs if x["type"] in ("text", "subheading")),
            "questions": flat, "questionGroups": groups,
        })
    return {
        "id": rec["id"], "testId": rec["sourceNumbers"][0], "slug": rec["slug"],
        "title": rec["title"], "status": rec["status"], "fullMockEligible": rec["fullMockEligible"],
        "questionCount": sum(len(p["questions"]) for p in passages),
        "passages": passages,
        "source": {"slug": rec["slug"], "sha256": rec["provenance"]["page"]["sha256"][:16]},
    }

# ---------- production Writing ----------
def writing_task_html(task):
    """Renderer contract: plain escaped prompt. Images are handled via the
    separate image.file slot (rendered by WritingModule); HTML tables are
    embedded here with their source heading as a real <caption> (and any
    footnote headings after the table). Never both image + table, never a
    flattening."""
    html = esc(task["prompt"])
    if not task.get("visual") and task.get("table") and task["table"].get("rows"):
        rows = task["table"]["rows"]
        html += '<table class="writing-table">'
        if task["table"].get("caption"):
            html += f'<caption>{esc(task["table"]["caption"])}</caption>'
        for i, row in enumerate(rows):
            html += "<tr>" + "".join(
                f'<{"th" if i == 0 else "td"}>{esc(c)}</{"th" if i == 0 else "td"}>' for c in row) + "</tr>"
        html += "</table>"
        for note in task["table"].get("notes") or []:
            html += f'<p class="writing-table-note">{esc(note)}</p>'
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
        if not rec.get("fullTestEligible"):
            excluded.append({"slug": rec["slug"], "reason": "not a fully verified 40-question test"})
            continue
        rt = build_listening_runtime(rec)
        defects = listening_runtime_defects(rt)
        if defects:  # the extractor gates on this too; never ship a test that fails it
            excluded.append({"slug": rec["slug"], "reason": "render check failed", "defects": defects[:5]})
            continue
        listen_runtime.append(rt)
    for f in sorted(glob.glob(os.path.join(OUT, "speaking", "tests", "*.json"))):
        rec = json.load(open(f))
        if rec["status"] == "quarantined":
            excluded.append({"slug": rec["slug"], "reason": "quarantined"})
            continue
        speak_runtime.append(build_speaking_runtime(rec))
    for f in sorted(glob.glob(os.path.join(OUT, "reading", "tests", "*.json"))):
        rec = json.load(open(f))
        # Only complete, fully validated 40-question tests ship: every Reading
        # session in the app is a timed 3-passage test scored on the 40-mark band
        # scale. practice_only tests keep their validated groups in content-db.
        if rec["status"] != "production" or not rec.get("fullMockEligible"):
            excluded.append({"slug": rec["slug"], "reason": rec["status"] or "incomplete"})
            continue
        read_runtime.append(build_reading_runtime(rec))
    for f in sorted(glob.glob(os.path.join(OUT, "writing", "tests", "*.json"))):
        rec = json.load(open(f))
        # Only verified, complete packages ship: Task 1 + Task 2 always come from
        # the same source page. Quarantined packages stay in content-db with reasons.
        if rec["status"] != "verified" or rec.get("kind") != "complete_test":
            excluded.append({"slug": rec["slug"], "reason": rec["status"] or "incomplete",
                              "reasonCodes": sorted({u["reasonCode"] for u in rec.get("quarantinedUnits", [])})})
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
