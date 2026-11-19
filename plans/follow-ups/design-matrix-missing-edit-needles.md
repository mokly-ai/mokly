# Design matrix edits sources that moved

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the branch `calummoore/ci-provider`, which moves CI to GitHub-hosted runners.
- **Location:** `crates/mokly-cli/tests/design_support/matrix.rs:98`,
  `examples/basic/specs/design/library/chrome/top-bar.view.tsx`, and
  `examples/basic/specs/design/library/controls/tag-chip.view.tsx`.
- **Reason:** The branch that found the failure changes only CI runners, and the fix changes a Rust test of the design catalogue.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Design attribution matrix:** the optional nightly workflow `.github/workflows/design-attribution.yml`. It runs the `design_attribution_tests` target of `mokly-cli` with the `design-matrix` Cargo feature.
  - **Needle:** a source string that the matrix test finds in an example file and replaces, to simulate an edit of a shared design component.
- **Background:**
  - `crates/mokly-cli/tests/design_support/matrix.rs` edits two design library files of the example catalogue. Before each edit, it asserts `source.contains(needle)`.
  - The case `top_bar_implementation` looks for `<header className="mbk-topbar">` in `chrome/top-bar.view.tsx`.
  - The case `nested_tag_chip_implementation` looks for `className={className}` in `controls/tag-chip.view.tsx`.
  - Neither string is in its file today. Commit `14c6f9ec` (#249, 2026-10-30) moved the shell chrome to `@mokly/ui`. Commit `7edabc30` (#251, 2026-10-31) moved the controls.
  - The nightly run passed on 2026-10-30 at `f93afcea`. It failed every night from 2026-10-31 to 2026-11-18.
  - The failure text: `panicked at crates/mokly-cli/tests/design_support/matrix.rs:98:9: assertion failed: source.contains(needle)`, then `test result: FAILED. 21 passed; 1 failed`.
  - `Required CI` does not depend on this workflow, so no pull request shows the failure.
- **Problem:** The matrix test cannot run its edit scenarios, because the example sources no longer hold the strings that it replaces.
- **Impact if no action:** The design attribution matrix stays red every night. It checks none of its attribution scenarios, so a regression in design change attribution goes unseen.
- **Root question:** How does the matrix test simulate an edit of a shared design component after the move to `@mokly/ui`?
- **Options:**
  - **A.** Change the two needles to strings that the current view files hold, and keep the expected affected entries. Effort: Small.
  - **B.** Make the edit step name the needle and the file in its assertion message, then do A. A later move then fails with a clear message. Effort: Small.
  - **C.** Edit the moved package components under `packages/ui/src` instead, if the scenarios must change the shared markup itself. Effort: Medium.
- **Left out:** Removing the two scenarios loses the coverage of shared component edits.
- **Wider fix:** B. A message that names the file and the needle makes each later drift quick to fix.
- **Previous examples:** None found.
- **Recommendation:** B. It fixes the matrix and makes the next drift easy to find.
- **Action:** fix after merge, apply B, because the fix belongs to the design catalogue tests and not to the runner change.
