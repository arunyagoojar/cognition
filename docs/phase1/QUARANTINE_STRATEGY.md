# QUARANTINE_STRATEGY.md — Cognition Phase 1

Quarantine is the correctness guarantee's pressure valve: questionable records are
**parked with full evidence**, never emitted into production and never destroyed.

## 1. Principles

1. **Nothing questionable ships.** A record is emitted only from a deterministic path
   that passes all validation layers. Any `fail` ⇒ quarantine.
2. **Nothing is lost.** Every quarantine record preserves the original source excerpt,
   the attempted parse, machine-readable evidence, and a reason code. (Exception noted
   in §5: nothing needs deletion, so no destruction path exists.)
3. **No synthetic placeholders.** A quarantined question is *absent* from production —
   never replaced with "[Question unavailable]" or similar (absolute rule).
4. **Recovery is a designed path.** Quarantine records carry `recoveryPath` describing
   the deterministic condition under which the record can be re-verified (e.g. widened
   context, corrected mapping, asset supplied).

## 2. Quarantine record shape

```json
{
  "quarantineId": "qz-000042",
  "recordType": "question | group | test | asset | answer | sample_answer",
  "record": { …attempted parse… },
  "reasonCode": "ANSWER_MAP_UNPROVEN",
  "reason": "human-readable explanation",
  "evidence": { "counts": {"groupQuestions": 3, "blanks": 4, "keyItems": 4},
                "htmlFragment": "…", "keyExcerpt": "…" },
  "source": { "path": "ielts-listening-test-189/index.html", "sha256": "…",
              "region": {"element": "div.entry-content", "charRange": [4211, 11204]} },
  "pipelineVersion": "1.0.0",
  "recoveryPath": "…",
  "status": "quarantined | recovered | confirmed_dead"
}
```

## 3. Reason codes (initial taxonomy, extensible)

| Code | Trigger (observed instances) |
|---|---|
| `ANSWER_MAP_UNPROVEN` | group↔key positional cross-check fails; trailing empty key item (test-170 "40.") |
| `NUMBERING_AMBIGUOUS` | group ranges overlap/gap; question numbers not tiling 1..40 |
| `GROUP_SEGMENTATION_UNSAFE` | fewer than 2 of 3 passage/group boundary signals agree |
| `INSTRUCTION_MISSING` | group without instruction text where the template guarantees one |
| `ASSET_MISSING` | referenced image absent (2019/02/40.3.png, 40.4.png, 46.1.png) |
| `AUDIO_MISSING` | no audio for a listening test (test-122) |
| `AUDIO_AMBIGUOUS` | >1 audio candidate for a test |
| `ASSET_PAGE_MISMATCH` | naming cross-check fails and content check cannot resolve (test-61 embeds test-100's audio) |
| `SEMANTIC_MISMATCH` | instruction/type/options disagree (e.g. "Choose the correct letter" with 2 options) |
| `NOT_QUESTION_CONTENT` | sample answers, comments, SEO text wrongly captured — defensive: also the classifier's verdict for non-test pages |
| `TOPIC_SLUG_MISMATCH` | speaking topic vs page slug disagreement (V2's 121 contaminated topics; deterministic slug check) |
| `DUPLICATE_UNRESOLVED` | twin records where hub enumeration can't pick a canonical |
| `EMPTY_OR_MALFORMED` | parse produced empty/malformed structure |
| `EXTRACTION_CONFIDENCE_LOW` | reserved for records below configured thresholds (e.g. <2 boundary signals, unknown stimulus kind) |

## 4. What goes to quarantine (expected from forensics)

- **Listening**: test-122 (audio missing); test-61 audio flag (warn-level, emitted with
  flag or quarantined per policy decision); trailing-empty-answer items; table-completion
  groups where blank-token count ≠ input count.
- **Reading**: ambiguous passage boundaries; the 3 missing-image diagram groups;
  short tests ending at 35–39 (verify then emit as-is — a legitimately short test is
  *not* quarantined if internally consistent).
- **GT**: section-split failures from non-standard formatting.
- **Writing**: 12 image-less Task-1 pages (`ASSET_MISSING` at task level if prompt
  references a visual).
- **MCQ**: pages whose key numbering doesn't match group ranges (33/52 sequential).
- **Speaking**: slug/topic mismatch pages (after re-extraction with the corrected
  strategy; V2's mismatches came from grabbing cross-link titles).

## 5. Quarantine lifecycle

```
fail ──► quarantined ──┬── recovery condition met (re-run) ──► recovered (re-validated)
                       ├── human adjudication (explicit mapping decision recorded) ──► recovered
                       └── source demonstrably defective ──► confirmed_dead (kept for audit)
```

- Quarantine is a **pipeline-owned store** (`content-db/quarantine/<reason-code>/`),
  never shipped to the application.
- Re-runs never auto-delete quarantine records; they transition `status` with evidence.
- Adjudications are recorded as decisions with actor + rationale — the only place a
  human can affect content, and the decision itself is data (auditable).

## 6. Metrics

Reconciliation reports (§RECONCILIATION_PLAN) include: quarantined per reason code per
module, recovery rate, and the invariant
`discovered = verified + quarantined + duplicates + irrelevant` per unit type.
