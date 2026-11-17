# Design matrix searches for text the views lost

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from branch `calummoore/sidebar-collapse-pi9i` (hidden catalogue navigation).
- **Location:** `crates/mokly-cli/tests/design_support/matrix.rs:79-98`
- **Reason:** The failure is older than the branch that found it, and that branch does not change the matrix.

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Test.
- **Location:** `crates/mokly-cli/tests/design_support/matrix.rs:79-98`
- **Terms:**
  - **Design matrix:** the nightly test `cargo test -p mokly-cli --features design-matrix --test design_attribution_tests`. The workflow `.github/workflows/design-attribution.yml` runs it on a schedule.
- **Background:** The design matrix edits shared design library views under `examples/basic/specs/design/library/` and compares the design entries that the edit affects with insta snapshots under `crates/mokly-cli/tests/design_support/snapshots/`. The function `run` in `matrix.rs` makes each edit. It finds a fixed piece of text in a view and replaces it. It first asserts `source.contains(needle)`.
- **Problem:** Two of the search texts are no longer in their views. The step `top_bar_implementation` searches `chrome/top-bar.view.tsx` for `<header className="mbk-topbar">`. That view now renders the `@mokly/ui` top bar and has no such text. The step `nested_tag_chip_implementation` searches `controls/tag-chip.view.tsx` for `className={className}`, which that view also lacks. The run fails with `assertion failed: source.contains(needle)`. On 17 November 2026 the last five scheduled runs on `main` failed this way.
- **Impact if no action:** The matrix never checks the `top_bar_implementation` snapshot, the tag chip step, or any step after them. A wrong attribution in those design components goes unseen.
- **Root question:** How does the design matrix keep an edit point in each view that it tests?
- **Options:**
  - **A.** Point both searches at text that the views contain now, such as an attribute that each view renders. Then run the matrix and refresh the snapshots that change. A later view rewrite can break the search again. Effort: Small.
  - **B.** Do A, and also add a stable marker comment to each view that the matrix edits, so that the search does not depend on markup. Each tested view then carries a test-only comment. Effort: Small.
- **Left out:** Deleting the two steps fails the goal, because the matrix would stop checking those components.
- **Wider fix:** B. A marker keeps the edit point when a view changes its markup.
- **Previous examples:** None found.
- **Recommendation:** A. It restores the check with the smallest change. B best protects the matrix against the next rewrite.
- **Action:** fix after merge, apply A, because the branch that found the problem changes no matrix code.
