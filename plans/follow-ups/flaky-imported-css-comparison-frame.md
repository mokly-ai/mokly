# Imported CSS comparison test races a mode switch

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the CI run of PR #248 at `cc463669`, job
  "Browser (Node 22.15.0, shard 2/4)".
- **Location:** `tests/browser/imported_css_panes.ts:40`, called from
  `tests/browser/imported_css_comparison.spec.ts:27`, the test "static export
  comparison panes retain CSS Modules and url assets". The same helper also
  serves `tests/browser/serve_imported_css_comparison.spec.ts:26-28`.
- **Reason:** The test is unrelated to PR #248, which changes only the
  terminal spinner labels, and it passed on every rerun. It failed again on
  2026-10-31 in the CI run of PR #251 at `9118c89a`, which changes only
  Markdown: twice in a row in "Browser (Node 22.15.0, shard 2/4)", with the
  same "Frame was detached" at `imported_css_panes.ts:40`, and it passed on
  the third attempt. It also failed in `main`'s CI run for `7edabc30`.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Comparison modes:** Overlay, Difference, and Side by side, the three
    ways that a comparison shows the previous and the current preview.
  - **Comparison frame:** an iframe with `data-mokly-comparison-frame` that
    shows one side of a comparison. Its `data-mokly-preview-source` names
    the side, such as `/snapshots/before/`.
- **Background:**
  - The test "static export comparison panes retain CSS Modules and url
    assets" starts at `tests/browser/imported_css_comparison.spec.ts:17`.
    For "Difference" and then "Side by side", it clicks the mode and calls
    `expectStyledPanes`, at lines 25-28.
  - `expectStyledPanes`, at `tests/browser/imported_css_panes.ts:22-49`,
    takes `.first()` of the comparison frames of each side, at lines 30-34.
    It checks a non-empty `srcdoc` at line 35 and the module colour with
    `toHaveCSS` at line 39. It reads the image through `button.evaluate` at
    line 40 and checks the byte count at line 47.
  - Overlay and Difference render their frames in
    `packages/viewer/src/shell/comparison_stack.tsx`, and Side by side
    renders new frames in `packages/viewer/src/shell/comparison_side.tsx`.
    The panes of each mode carry `data-compare-mode`, at
    `comparison_stack.tsx:35` and `comparison_side.tsx:46`.
  - The Serve test "Serve comparison panes retain CSS Modules and url
    assets" calls the same helper after the same two mode clicks, at
    `tests/browser/serve_imported_css_comparison.spec.ts:26-28`. No failure
    of that test is recorded.
- **Problem:**
  - Failure: the test failed once in CI, in the run of PR #248 at
    `cc463669`, job "Browser (Node 22.15.0, shard 2/4)".
  - Failure text: `Error: locator.evaluate: Frame was detached` at
    `expectStyledPanes (tests/browser/imported_css_panes.ts:40:32)`. The
    failing call is the check after a click on "Difference" or "Side by
    side".
  - Rerun outcome: the same commit passed this test in all four browser
    shards of a remote `cargo xtask check`. A local
    `npm run test:browser -- tests/browser/imported_css_comparison.spec.ts --repeat-each=30`
    passed 30 of 30.
  - Suspected source: async ordering in the test. After the mode click, the
    locator
    `[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/before/"]`
    with `.first()` can still match a frame of the earlier mode. The
    `toHaveCSS` check can pass on the old frame, and the old frame then
    detaches during `evaluate`. Nobody confirmed it.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, and each failure costs a rerun. A real comparison defect can hide
  behind a flake label.
- **Root question:** How does the test know that the frames of the selected
  mode are ready before it reads them?
- **Options:**
  - **A.** Reproduce the failure by repeating the test, and name the source.
    Then, in this test, wait for an explicit readiness signal of the new
    mode, such as the pane layout of the selected mode, before the frames
    are read. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the failure
    details in this item then. Effort: Small.
  - **C.** Reproduce the failure and name the source, as in A. Then put the
    same readiness wait into `expectStyledPanes`, so that both callers, this
    test and the Serve test, read only frames of the selected mode. Keep
    every assertion. Effort: Small.
  - **D.** If the reproduction shows a product race in the mode switch of
    the comparison panes, add a failing test first. Then fix the order in
    the viewer comparison code. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The
  `testing` skill forbids them, because they hide the source.
- **Wider fix:** C. One wait in the shared helper protects both
  callers.
- **Previous examples:** Other browser tests that failed and passed on the
  rerun: [flaky-same-origin-handoff.md](./flaky-same-origin-handoff.md),
  [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md),
  and [frame-adapter-message-flake.md](./frame-adapter-message-flake.md). The
  first gives its shared probe the same kind of readiness option.
- **Recommendation:** C. It puts the wait where the frames are
  read, so both callers gain it at the cost of A.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.
