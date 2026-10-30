# Imported CSS comparison test races a mode switch

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the CI run of PR #248 at `cc463669`, job
  "Browser (Node 22.15.0, shard 2/4)".
- **Location:** `tests/browser/imported_css_panes.ts:40`, called from
  `tests/browser/imported_css_comparison.spec.ts:27`, the test "static export
  comparison panes retain CSS Modules and url assets".
- **Reason:** The test is unrelated to PR #248, which changes only the
  terminal spinner labels, and it passed on every rerun.

The test failed once in CI with `Error: locator.evaluate: Frame was detached`
at `expectStyledPanes (tests/browser/imported_css_panes.ts:40:32)`. The
failing call is the check after a click on "Difference" or "Side by side".
The same commit passed this test in all four browser shards of a remote
`cargo xtask check`, and a local
`npm run test:browser -- tests/browser/imported_css_comparison.spec.ts --repeat-each=30`
passed 30 of 30.

The suspected source is async ordering in the test. After the mode click,
the locator
`[data-mokly-comparison-frame][data-mokly-preview-source*="/snapshots/before/"]`
with `.first()` can still match a frame of the earlier mode. Overlay and
Difference render their frames in `packages/viewer/src/shell/comparison_stack.tsx`,
and Side by side renders new frames in
`packages/viewer/src/shell/comparison_side.tsx`. The `toHaveCSS` check can pass
on the old frame, and the old frame then detaches during `evaluate`. A fix
waits for an explicit readiness signal of the new mode, such as the pane
layout of the selected mode, before it reads the frames, and keeps every
assertion.
