# Cognition — Production Status & Engineering Log

**Live URL:** https://cognition.eu.cc
**Worker:** `cognition` (also at `cognition.arunyagoojar.workers.dev`)
**Last updated:** 2026-10-03 · docs commit `0a321b1`+ (see git log for exact head)

---

## 1. Production architecture (what is running right now)

```
                      cognition.eu.cc  (user-facing domain, zone in this CF account)
                            │
                     Clerk Auth  (development instance, pk_test — any origin works;
                            │     production instance + pk_live recommended before scale)
                            ▼
        Cloudflare Worker "cognition"  (frontend + API in ONE worker)
              │            │                │
              ▼            ▼                ▼
     Cloudflare D1   Cloudflare R2      Gemini API
     cognition-db    cognition-media    (server-side only;
     users/attempts  353+ media assets  user key AES-256-GCM
     lessons/prefs   (r2.dev delivery)  encrypted in D1)
```

| Component | Value |
|---|---|
| Worker | `cognition` — SPA via `[assets]` (dist/) + `/api/*` via `run_worker_first` |
| Custom domain | `cognition.eu.cc` — declared in `wrangler.toml` routes, secret `CREDENTIAL_ENCRYPTION_KEY` set |
| D1 | `cognition-db` (`edd1e971-…`) — migrations `0001` (users/attempts/lessons) + `0002` (user_ai_credentials) applied remotely |
| R2 | `cognition-media` — public r2.dev delivery; manifest `content-db/media_manifest.json` |
| AI | Server-side chain `gemini-flash-latest` → `gemini-2.5-flash` (auto-updating alias survives upstream model retirement) |
| Media resolver | `src/utils/media.js` — runtime path → R2 URL; contract-checked against the manifest (353/353, plus listening images) |

**Rollback copies:** the `cognition-api` worker still holds the Phase 4 code (harmless, redundant).

---

## 2. What has been updated (commit history, newest last)

| Commit | What it did |
|---|---|
| `59ac49e`…`c31f5e3` | Clerk sign-in modal rework (compact, themed, Apple/GitHub/Google) |
| `e8c6116` | **Phase 2** — Clerk JWT-verified Worker API + D1 persistence (user, target band, theme, attempts, lessons) |
| `3a90dc6` | **Phase 3** — all media migrated to Cloudflare R2; centralized media resolver; manifest with SHA-256 dedupe; 316 MB video re-encoded under the 300 MiB upload limit; listening-image routing bug fix |
| `ac2fb77` | **Phase 4** — AES-256-GCM encrypted AI credentials (D1 `0002`), credential put/status/delete endpoints, server-side Gemini evaluation (writing + speaking), CORS allowlist, Settings UI for keys with legacy-localStorage migration, dark-mode fixes (Clerk overlay, Settings panel, theme toggle, undefined `--border`/`--coral`/`--surface-alt` tokens), Workers assets deployment, slim `public-static` production build |
| `7239163` | Production fixes: model retirement (`gemini-2.0-flash` → `gemini-flash-latest`), same-origin `/api` double-prefix bug, practice attempts silently dropped (module results lacked id/type — now enveloped in App), DEPLOYMENT.md |
| `cac8d96` | Mock run-through fixes: missing `getProductionWritingTest` import (the mock-start crash behind the Clerk `useUser` error), reading input injection + real deterministic grading (was a 0/40 stub), mock assembly includes answer keys, no-question reading tests excluded, degenerate option sets → text inputs, **dropdowns → radio lists**, mock attempts sync to D1, runtime bundle regenerated (253 reading tests, 5,921 questions) |
| `0a321b1` | **Production domain**: `cognition.eu.cc` moved onto the current Worker; docs updated |

**Everything above is pushed to `github.com/arunyagoojar/cognition` (`main`).**

---

## 3. What is verified working in production

Verified on the live deployment (browser + HTTP checks):

- **Auth**: sign-up/sign-in (Clerk accepts the custom origin), session survives refresh, sign-out/sign-in. Unauthenticated `/api/*` → 401.
- **User data (D1)**: target band + theme changes persist server-side and across refresh; attempts (writing/mock) persist; JWT verified Worker-side via the canonical JWKS endpoint.
- **Media**: R2 serving verified 353/353 (status 200 + exact bytes + content-type); listening audio plays; Learning Hub videos stream (incl. the 295.5 MiB re-encoded one); writing Task 1 visuals load.
- **Writing evaluation**: browser → Worker → encrypted credential → Gemini → validated rubric → UI. Real result observed live (band 8.0 on a proper submission; 3.5 with honest off-topic diagnosis on a mismatched one).
- **Speaking evaluation**: Worker → Gemini rubric verified with transcript payload; recording works in-browser; without a transcript the UI honestly reports "not assessed" (never invents pronunciation).
- **Full mock**: all 4 modules run in official sequence; deterministic scoring + AI evaluation; results screen renders; overall band correctly withheld unless all 4 skills are attempted.
- **Security**: no secrets in bundle/HTML/localStorage; CORS is an explicit allowlist; credentials stored only as ciphertext (verified in D1); legacy localStorage key paths removed with a one-time secure-migration UI.

---

## 4. Data correctness by section

### Listening — 207 tests · 8,050 questions · 8,050 answers — **solid**
- Every question has an official answer; deterministic scoring is exact.
- Audio: 206/207 tests resolved (1 test ships without audio by flag, handled in UI).
- Stimulus images (map/diagram, ~125 files): **initially missing from R2** (the Phase 3 media inventory missed this category — found and fixed during this audit; uploaded under `cognition/images/listening/` and added to the manifest).
- Interactive rendering: notes/diagram completion inputs render and submit correctly; a few legacy question groups render checkbox/typed-answer styles from source HTML (answerable, deterministic-scored).

### Reading — 253 tests · 5,921 questions · 5,920 answers — **structurally correct, per-test coverage varies**
- The answer data itself is correct where present (contract-tested; validators documented every exclusion).
- See §5 for the coverage problem.

### Writing — 132 tests · 120 Task 1 visuals · 12 tables — **solid**
- Prompts, visuals (R2), tables verified; AI evaluation path live; coverage-honesty rules (word floors, no band for single-task submissions) preserved.

### Speaking — 179 packages — **solid**
- Cue cards, part structure, prep timers, recording all verified; evaluation is transcript-based with the pronunciation honesty rule.

### Learning Hub — 20 lessons — **solid**
- Videos stream from R2; lesson completion now persists to D1 (`syncLessonComplete` was wired late — completed-lesson records from before this fix exist only locally).

### User data — **correct**
- users / attempts / completed_lessons / user_ai_credentials all migration-applied remotely; preferences sync verified live.

---

## 5. Reading — the honest problem list

These are **content-extraction (Phase 6) quality issues**, not scoring bugs. The scoring engine is exact against whatever structured data a test carries.

1. **Uneven structured coverage per test.** Extraction converted only a *subset* of questions into structured records (id/prompt/answer) for many tests — e.g. the mock's test 66 carries only 10 of 40; some tests had zero and are now excluded from the pool. A test with partial data **scores only its structured subset**.
2. **Answerable ≠ scoreable.** The runtime blank-injection makes *every* numbered question line typeable (good UX), but where no structured record exists the answer is not in the data, so it cannot be marked right or wrong. On such tests a perfect paper could still under-report.
3. **Answer-key numbering misalignment in some tests.** A group's extracted numbers occasionally disagree with the global answer-key numbering (e.g. a summary-completion group numbered 18–24 while the key holds matching letters there). Those questions score strictly by their own records — correct answers may not align.
4. **Roman-numeral heading-match questions** (Passage 3 pattern) are frequently text-only in extraction; they render as instructions without inputs on some tests.
5. **Degenerate option sets** (each question carrying a single "A" option) existed in the stale bundle; the build now degrades those to typed answers, and the UI renders radios only when a group has ≥ 2 real options.
6. **Stale-bundle drift (fixed).** The deployed bundle had been built from an older extraction than `content-db` — regenerated and re-shipped (`cac8d96`).

**Recommended fix (one focused phase):** re-run the reading extraction over the source HTML with per-question structured output as the hard requirement (all 40 questions + key alignment per test), re-validate, regenerate the runtime. That converts reading to the same "solid" tier as listening/writing.

---

## 6. Other sections — remaining problems

| Section | Problem | Severity |
|---|---|---|
| Listening | Stimulus images were missing from R2 (fixed during this audit — verify after upload completes). Some legacy groups use checkbox-style rendering from source HTML. | Low |
| Speaking | Live transcription depends on the browser's Web Speech API (Chrome/Edge desktop; absent in Safari and most in-app browsers) → without it, speaking is honestly "not assessed". No server-side STT. | Medium |
| Speaking | Audio is recorded but never uploaded — recordings live only in the session; pronunciation remains unassessed by design. | Low |
| Learning Hub | Completed lessons synced to D1 only from this fix forward; earlier local completions don't backfill. | Low |
| Auth | Clerk is a **development instance** (pk_test): fine for now, but production instances require dashboard setup + origin allowlisting before serious launch. Also `+clerk_test` e-mails auto-verify in dev — not a production pattern. | Medium (pre-launch) |
| AI | Gemini key is user-supplied per account; users without a key get deterministic-only scoring with clear "not configured" messaging. Rate-limit handling is a 60 s client cooldown + server 429 mapping. | Low |
| Mock | Randomization serves a random listening test and pairs writing by number; the paired reading/speaking fall back to random when the paired id has no structured data. | Low |
| Timers | Mock module timers are real (60/60 min); listening audio is not enforced as play-once in automation but the UI states the rule. | Low |

---

## 7. Test & validation status

- `npm test` — **passes**: listening contract (207 tests / 8,050 Q / 8,050 A / audio + images resolved), writing contract (132 tests), reading contract (253 tests / 5,921 Q / 5,920 A), evaluation-engine suite.
- `npm run lint` — 0 errors (75 pre-existing warnings, documented, not hidden).
- `npm run build` — passes (slim `public-static` build; dist ≈ 19 MB).
- Validators — reading passes (253 records, exclusions documented); writing validator requires the local source-site download (environment dependency, content already validated).
- Security suite — 12 checks executed live against the Worker (auth rejection, key-format rejection, server-side validation, no-credential-leak, CORS withholding, D1 ciphertext verification, bundle/localStorage scans).

---

## 8. Known operational notes

- **R2 uploads require `--remote`** (otherwise wrangler writes to a local simulator), cap at 300 MiB per object, and object keys containing `...` are WAF-blocked on the API path (the resolver collapses dot-runs).
- **One worker serves everything**: renaming/moving the worker in `wrangler.toml` changes which domains/bindings deploy — the `[assets]`, D1, vars, and routes are all in that one file now.
- **The e2e test account** (`e2e-tester+clerk_test@cognition-test.dev`, password in `/tmp/cognition_e2e_password` on this machine) exists in the Clerk dev instance for automated checks; delete it from the Clerk dashboard whenever.
- **Media archive**: `public/wp-content` + `public/videos` (~8.5 GB) are the local R2 upload sources, gitignored; never ship them in a build (`PUBLIC_DIR_OVERRIDE=public-static` handles it).
