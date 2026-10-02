#!/usr/bin/env python3
"""
Cognition — Phase 2 pilot: render reconstructions (validation layer V8).

Reads the emitted record JSONs and produces the human-readable rendering the
application would show, using ONLY the record (no source access). If the
rendering is complete and faithful, the schema passes V8.
"""
import json, os, glob

OUT_DIR = "/Users/arunyagoojar/Documents/cognition/pipeline/pilot"

def render_group(g):
    out = []
    inst = g["instruction"]["text"]
    wl = g["instruction"]["wordLimit"]
    out.append(f"**{g['groupId']} — Part {g['part']}, Questions {g['startQ']}–{g['endQ']}**  `{g['stimulus']['kind']}`")
    if inst: out.append(f"> {inst}" + (f"  \n> *word limit: {wl}*" if wl else ""))
    stim = g["stimulus"]
    if stim.get("table"):
        rows = stim["table"]["rows"]
        if rows:
            out.append("")
            hdr = rows[0]
            out.append("| " + " | ".join(hdr) + " |")
            out.append("|" + "---|" * len(hdr))
            for r in rows[1:]:
                out.append("| " + " | ".join(c.replace("\u2426", "___") if c else " " for c in r) + " |")
    if stim.get("figures"):
        for f in stim["figures"]:
            out.append(f"![{f}](asset: {f})")
    if stim.get("sharedOptions"):
        out.append("")
        opts = "  ".join(f"**{o['letter']}** {o['text'] or '—'}" for o in stim["sharedOptions"])
        out.append(f"Box: {opts}")
    for seg in (stim.get("segments") or []):
        if not seg.startswith("[orphan"):
            out.append(f"    {seg}")
        else:
            out.append(f"    ⚠ {seg}")
    out.append("")
    for q in g["questions"]:
        label = f"**Q{q['number']}** ({q['type']})"
        stem = q["stem"] or {}
        if q["type"] in ("mcq_single",):
            out.append(f"- {label} {stem.get('plain','')}")
            for o in (q["options"] or []):
                out.append(f"  - {o['letter']}. {o['text']}")
        elif q["type"] in ("matching_box", "map_labeling", "diagram_labeling"):
            out.append(f"- {label} {stem.get('plain','')} → `[letter select]`")
        elif q["type"] == "mcq_multi":
            out.append(f"- {label} *(select from box; stem = group instruction)*")
        elif q["type"] == "short_answer":
            out.append(f"- {label} {stem.get('plain','')} → `[text input]`")
        else:  # completion
            segs = stem.get("segments") or []
            if segs:
                parts = []
                for s in segs:
                    parts.append("______" if isinstance(s, dict) else s)
                out.append(f"- {label} {' '.join(parts)} → `[text input]`")
            else:
                out.append(f"- {label} {stem.get('plain','')}")
        if q.get("blankContext"):
            out.append(f"  - *context: {q['blankContext']}*")
    out.append("")
    return "\n".join(out)

def render_record(rec):
    lines = [f"# {rec['title']}", ""]
    lines.append(f"- record id: `{rec['id']}`  status: **{rec['status']['status']}**")
    a = rec["audio"]
    if a["asset"]:
        lines.append(f"- audio: `{a['asset']['resolvedPath']}` ({a['asset']['bytes']:,} bytes, dialect {a['dialect']})"
                     + (f" ⚠ flags: {', '.join(a['flags'])}" if a["flags"] else ""))
    else:
        lines.append(f"- audio: **MISSING** ⚠")
    for img in rec["images"]:
        lines.append(f"- image: `{img['resolvedPath']}` {'✓ exists' if img['exists'] else '✗ MISSING'}")
    lines.append(f"- provenance: `{rec['provenance']['page']['path']}` sha256 `{rec['provenance']['page']['sha256'][:16]}…`")
    lines.append("")
    cur_part = None
    for g in rec["questionGroups"]:
        if g["part"] != cur_part:
            cur_part = g["part"]
            lines.append(f"## Part {cur_part}")
            lines.append("")
        lines.append(render_group(g))
    lines.append("## Answer Key")
    lines.append("")
    items = rec["answerKey"]["items"]
    if items:
        per_row = 5
        for i in range(0, len(items), per_row):
            chunk = items[i:i+per_row]
            lines.append("| " + " | ".join(f"{n}. **{v}**" for n, v in chunk) + " |")
    if rec["answerKey"].get("trailingEmpty"):
        lines.append("")
        lines.append("⚠ *key ends with an empty item (source defect)*")
    lines.append("")
    lines.append("## Validation")
    lines.append("")
    lines.append(f"- status: **{rec['status']['status']}**")
    for layer, items in rec["validation"].items():
        for it in items:
            lines.append(f"- `{layer}` {it['level'].upper()}: {it['code']} — {it['detail']}")
    lines.append("")
    return "\n".join(lines)

def main():
    os.makedirs(os.path.join(OUT_DIR, "reconstructions"), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(OUT_DIR, "records", "*.json"))):
        rec = json.load(open(f))
        md = render_record(rec)
        out = os.path.join(OUT_DIR, "reconstructions", os.path.basename(f).replace(".json", ".md"))
        open(out, "w").write(md)
        print("rendered", os.path.basename(out))

if __name__ == "__main__":
    main()
