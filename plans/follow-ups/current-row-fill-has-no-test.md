# No test checks the current row's fill

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch calummoore/click-on-row-ux-0nhj, review round 2.
- **Location:** `docs/mockups/styles/product/viewer-canvas-panels.css:171-173` and `docs/protocol/cloud/folio-viewer.md:171-173`.
- **Reason:** The rule and its missing test were on `origin/main` before the branch that found them.
- **Category:** Test.

- **Terms:**
  - **Current row:** the row of a viewer panel for the place the reader is on, such as the branch in the switcher or the project in Projects. It says Current, or Selected in Share.
- **Background:** `folio-viewer.md` says that the row the reader is already on takes `signalSoft` with the 8px chrome radius. The rule `[data-color-scheme] .fo-canvas-rows li:has(> .fo-canvas-row-current)` in `viewer-canvas-panels.css` draws the fill. Specs check the row's Current text and that it is no link, but no spec reads its fill.
- **Problem:** A stylesheet change can drop or recolour the current row's fill, and no test fails.
- **Impact if no action:** The mark of the reader's place can go away unseen in every panel.
- **Root question:** How does a test fail when the current row loses its `signalSoft` fill?
- **Options:**
  - **A.** In `packages/app/src/_tests_/viewer/switcher.spec.ts`, read the `main` row's background and compare it with the computed `--mk-color-signal-soft` of the panel. Effort: Small.
  - **B.** In `docs/mockups/src/_tests_/viewer-panels.spec.ts`, check the current row's background in light and dark. Effort: Small.
- **Left out:** A test that reads the rule text. It passes when the selector stops matching. Fewer than three approaches are real, because the choice is only the host.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A. It checks the shipped app with the synced stylesheet.
- **Action:** fix after merge, apply A, because the gap is older than the branch that found it.
