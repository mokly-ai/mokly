# The viewer's brand icon colours are untested

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-24, from the review of the branch `calummoore/favicons-app-icons-new-logo-jbsc`, a problem outside its scope.
- **Location:** `packages/viewer/src/shell/assets/brand.svg`, `packages/viewer/tests/palette.test.ts`.
- **Reason:** The problem predates the favicon branch and lies in the open-source viewer, outside that branch's change.
- **Category:** Test.

- **Terms:**
  - **Canvas palette:** The light and dark colours of `@mokly/ui`, exported from `@mokly/ui/palette` (source `packages/ui/src/palette/palette.ts`).
- **Background:** The Browse shell of Mokly uses `packages/viewer/src/shell/assets/brand.svg` as its favicon; `crates/mokly-model/src/shell.rs` links it. The file draws the adaptive Mokly mark with literal light and dark colours and a `prefers-color-scheme: dark` rule. `packages/viewer/tests/palette.test.ts` checks that viewer files use palette colours, but it scans only `.css` files.
- **Problem:** No test ties the literal colours in `brand.svg` to the Canvas palette.
- **Impact if no action:** A palette change can leave the Browse shell's tab icon in old colours with every test green.
- **Root question:** How does the viewer's favicon keep the Canvas palette's colours?
- **Options:**
  - **A.** Extend `packages/viewer/tests/palette.test.ts`, or add a viewer test, that asserts `brand.svg` holds the palette's light and dark `text` and `signal` colours and the dark rule. Effort: Small.
  - **B.** Generate `brand.svg` from `@mokly/ui/palette` in the viewer build. Effort: Medium.
- **Left out:** None.
- **Wider fix:** B removes the literal copy. `plans/follow-ups/app-favicon-copies-token-colours.md` option G goes further and makes this file the one source for the app too.
- **Related:** `plans/follow-ups/app-favicon-copies-token-colours.md`, the same mark in the cloud app.
- **Recommendation:** A. It catches drift with a small test and keeps the file static.
- **Action:** fix after merge, apply A, because the problem is outside the favicon branch.
