# Spelling Bee

Run `npm run dev:local`: Vite is at http://127.0.0.1:5173 and the local Worker/D1 API is at port 8787. This applies migrations to **local D1 only**.

The dashboard shares the lavender card between Lessons and Tips & Strategies, retaining both existing pages. The yellow card opens Spelling Bee (`#/spelling-bee`), which is available without signing in. Guests keep scores and their word bank on this device; signed-in accounts additionally sync to D1. Guest data is kept separate from account data and is not uploaded when someone signs in. A standalone local review entry at `/qa/spelling-bee.html` renders the real cards and real Spelling Bee with an isolated device-only review account. QA HTML is not included in the production entry.

## Behaviour

- Every completed session contains 30 unique words. First session: 10 easy, 10 medium, 10 difficult, in that order.
- Later sessions prioritise up to 20 misspelled personal words, then unsure correct words, fill with new seed words and remaining seed words, and shuffle the entire selection. There are 60 curated seed words; personal mistakes can expand this pool.
- On each word, the speaker automatically pronounces it twice without showing it. Browsers that block autoplay offer a speaker button to retry. Only installed English speech voices are selected. No speech provider or dictionary API key is required.
- The 10-second limit starts after both initial pronunciations finish. Replays do not restart it. Deadlines survive refresh and continue when the browser is in the background.
- Enter in the answer field submits as Confident. Clicking Check spelling uses the selected confidence (Unsure by default). Confidence is reported separately and does not change accuracy. The answer field has a visible boundary, a placeholder, and keyboard focus styling.
- Correct answers show green feedback and advance. Wrong answers and timeouts show untimed teaching notes and wait for Next, including the final word.
- Five **consecutive** correct attempts mark a word fixed. A later error resets its streak and returns it to practice.
- The dashboard card, landing page and summary show an independent spelling score out of 9: correct / 30 × 9, rounded to one decimal. This is an accuracy scale, not an IELTS band.
- Summary groups: mistakes, confidently correct, unsure but correct, improvement on previous mistakes, and newly fixed words. Spelling scores never enter the IELTS band or performance-attempt store.

## Files and persistence

`src/components/views/SpellingBee.jsx` and `spellingBee.css` own the UI. `src/data/spelling/words.js` owns starter vocabulary and original example sentences. It contains no handmade divisions, roots, or mnemonic rules. `src/utils/spelling/engine.js` owns selection, grading, mastery and summaries. `store.js` owns account-scoped local activity; `capture.js` collects conservative local spelling findings. `activity.js` validates immutable records in both client tests and the Worker.

The browser stores activity under `cognition_spelling_v1:<account>` and active sessions through the existing scoped drafts. The existing durable sync outbox sends spelling activity to `/api/spelling/activity`. Migration `0004_spelling_activity.sql` adds an independent, account-keyed activity table. POST is idempotent; GET is paginated. The word bank is derived from immutable activity so retries cannot increment counters twice. Remote records hydrate on sign-in; locally saved records are requeued if a tab closed before queueing. Account deletion removes spelling data in D1 and on the current device.

Writing, writing-with-help, and reading/listening evaluator submission paths run Harper locally. Capture uses spelling findings, not grammar suggestions. It skips known valid words, non-word answers, unknown dictionary corrections, and equally plausible suggestions. Rechecking identical source text does not add another capture. It only stores misspelled/corrected word pairs, not full essays. Capture can continue in the background after a submission and does not block scoring. It is intentionally conservative; not every misspelling is automatically classified.

`public-static/spelling/` contains 77,196 WordNet 3.0 entries in letter shards, loaded on demand from this app. Definitions come from WordNet when available, with starter teaching definitions covering function words absent from WordNet. Examples are original starter examples or dictionary examples; an absent example is labelled rather than invented.

`public-static/spelling/structure/` bundles 40,036 word-structure entries. Starter etymologies and available divisions were extracted from English Wiktionary with per-field revision links; wider coverage uses the public-domain Webster’s Unabridged Dictionary (1913). Only printed divisions whose letters reconstruct the exact headword are accepted. These are dictionary word divisions/hyphenation, not generated groups or an inferred pronunciation algorithm. Missing divisions and etymologies are explicitly labelled. Greek/Latin roots appear only in sourced origin notes. Historical abbreviations and spelling are retained. The derived Wiktionary records are licensed CC BY-SA 4.0; see `ATTRIBUTION.txt` in that directory. No external dictionary/AI API is used at runtime.

Rebuild definition shards with `python3 scripts/build-spelling-dictionary.py <WNdb-3.0.tar.gz>`; source: https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz. Retain `LICENSE-WordNet.txt` from https://wordnetcode.princeton.edu/3.0/LICENSE.

Rebuild structure shards with `python3 scripts/build-spelling-structure.py <pg29765.txt>`. Source: https://www.gutenberg.org/cache/epub/29765/pg29765.txt. Existing Wiktionary starter snapshots are preserved by default. `--wiktionary` refreshes only the 60 public starter entries from their English Wiktionary HTML pages; learner mistakes are never sent. The manifest records source checksum and coverage. Retain the attribution file when distributing the derived data.

## Verification

`npm run test:spelling` checks session composition, normalization, timeouts, mastery and relapse, selection, summaries, real Harper detection, local identity separation, and real Worker routes against an in-memory SQLite database with signed test tokens.

`npm run test:spelling:browser` requires a Playwright install and running local server. Set `PLAYWRIGHT_MODULE` to its module path and `BROWSER_EXECUTABLE` if Chrome is elsewhere. Optional `QA_SCREENSHOTS` saves desktop/mobile/dark-mode screenshots. Browser timing tests mock speech completion; audible voice quality needs a human listen-through. No test token or auth bypass is built into the application.

`npm run test:spelling:guest` checks the real app while signed out: dashboard entry, direct route, guest storage, and absence of authenticated spelling API requests. It uses the same Playwright and browser environment variables.

`node test/spelling_speech.test.js` verifies two sequential utterances, delayed timer eligibility, cancellation, and autoplay failure without invoking real audio.
