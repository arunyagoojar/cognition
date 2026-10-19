Writing Help verification

The feature lives in HarperWritingPractice and its own WritingHelp/CSS/data modules. The mock test and WritingModule are unchanged. The Harper engine and its default rule configuration are unchanged; its practice adapter now owns, caches and disposes the browser worker.

Run `npm run test:writing-help` for real Harper detections, cached results, safe fixes, sentence counts, repetition ignores, and local vocabulary/phrase data checks. These tests also run in `npm test`.

Run `npm run test:writing-help:browser` with Playwright available. It builds an isolated production QA entry, starts a local preview, and cleans up the generated build. Optional environment variables:

- `PLAYWRIGHT_MODULE`: absolute path to an existing Playwright module, if it is not installed in this project.
- `BROWSER_EXECUTABLE`: installed Chromium-compatible browser executable; defaults to Playwright's Chrome channel.
- `WRITING_HELP_URL`: use an already-built QA page instead of building and serving one.
- `QA_SCREENSHOTS`: existing directory for desktop, mobile and dark-mode screenshots.

The browser test covers real worker detections, all three panel ratios, persistence, clipboard copy without insertion, Task 1/2 filtering, keyboard tabs, vocabulary refresh and used states, selected-occurrence synonym replacement/undo/ignore, Unicode edits, scroll alignment, mobile overflow, local rule explanations, and worker shutdown. Provider calls are blocked in this isolated session when testing submission fallback; live paid-provider assessment is not exercised.

Known checker limitation, deliberately asserted: for `he go to university everyday`, Harper detects `go` → `goes`. With a final period, it also detects `everyday` → `every day`. It does not flag every possible mistake; the UI does not claim complete correctness. Severity labels are a presentation distinction based on rule kinds, not IELTS scores. Grammar counters include spelling and style; repetition groups are counted separately as warnings.

The phrase bank has 102 entries: six per supported category and task, adapted from the supplied IELTS Writing Phrase Cheat Sheet and expanded with meanings and illustrative examples. Opinion, speculative causes, and proposed solutions are excluded from Academic Task 1. Its conclusion category contains overview language. Vocabulary and phrases are bundled locally and make no API requests. Repetition offers three to five alternatives where the local dictionary has an entry; unsupported words retain occurrence and ignore controls without fabricated synonyms.


Quick-reference UI revision

Suggestions in the top navigation opens a native modal dialog with Vocabulary and Phrase Bank tabs. Close, Escape and the backdrop dismiss it, with focus returned to the trigger. Native modal focus containment includes expandable summaries. The last resource selection is preserved while the writing workspace stays mounted.

Question, editor and feedback share equal outer bounds. Question and feedback headers remain outside the scrollable body, so scrolling cannot cut off their frames. Feedback uses divider-separated rows and plain text synonym actions, with no occurrence-number navigation or draft excerpts. Clicking or selecting a highlighted word selects the target occurrence; otherwise an alternative applies to the first occurrence. Replacements validate offsets, preserve capitalisation, and have an explicit Undo action.

Apple design references used as web design principles: layout.md / Visual hierarchy (progressive disclosure and grouping), modality.md / Best practices (short task and obvious dismissal), toolbars.md / Item groupings (common controls in the centre, primary action at the trailing edge), and accessibility.md / Vision and Mobility (contrast, keyboard access and comfortable targets). Cognition's existing Kodchasan type, semantic light/dark colours and outlined outer surfaces are retained. Interior rows use spacing and separators. Reduced motion disables the short layout/dialog transitions.

The browser checks now assert matched panel top/bottom edges, toolbar alignment, stable frames while scrolling, modal close/focus return, mobile usable feedback height, and single-occurrence replacement with Undo.

## Final visual polish

Vocabulary uses a two-column grid of ten expandable cards inside the reference overlay. Native select controls retain keyboard and mobile picker behavior, with explicit appearance, 48px height, rounded surfaces, and matching chevrons. Phrase rows and feedback retain quiet dividers. This applies Apple's pop-up button guidance (useful defaults and labeled mutually exclusive choices) and collection guidance (standard grid, adequate spacing), translated to the existing Cognition web design.

Inspected all 128 production writing records and the writing adapter: no difficulty or level metadata exists, so no easy/medium/hard labels are added.

Validation: full npm test suite, lint, production build, and Chromium desktop/mobile browser checks pass. Reviewed generated vocabulary, phrase, and mobile overlay screenshots.

## Button sizing

Practice buttons share sizing tokens across outlined, filled, text, and segmented variants: 44px regular, 36px compact inline actions, and 48px task-start actions. Compact targets increase to 44px on mobile/coarse pointers. Type, line height, padding, icon alignment, and toolbar border widths are consistent; disabled states keep the same geometry. Narrow layouts wrap actions, stretch multiline layout segments equally, and stack feedback tabs to avoid clipped labels. Browser checks compare toolbar geometry before/after enabling Finish & Summary and verify touch targets and overflow at 320px.
