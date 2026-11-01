# Add the missing period to the scripts hint

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 156, from finding 52 of the 135 B review.
- **Location:** `crates/mokly-cli/src/changes_diagnostics.rs:14`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Scripts hint:** the recovery message that Changes shows when a base
    dependency install may fail because lifecycle scripts are off.
- **Background:**
  - `changes_diagnostics.rs:14` defines the hint: "If this base needs
    lifecycle scripts, enable `review.baseInstallScripts` or use
    `--base-install-scripts`".
  - The terminal text puts it after the failure detail as
    `"{detail}. {SCRIPTS_HINT}"`, at line 174. Changes details show it as
    its own diagnostic.
  - The plan records only the recommended option. The review report that
    held the options is not in the repository.
- **Problem:** The hint is a complete sentence with no final period.
- **Impact if no action:** The hint stays inconsistent with the product copy
  rules.
- **Root question:** How should the scripts hint end?
- **Options:**
  - **A.** Add the final period, and update the tests that compare the
    exact message. Effort: Small.
  - **B.** Keep the current text. Effort: Small.
- **Left out:** None. The text has no third place or form to change.
- **Wider fix:** None. The copy rules of the `product-ui` skill already
  cover this class.
- **Previous examples:** None found.
- **Related:** [base-script-render-failure-hint.md](base-script-render-failure-hint.md)
  extends where the same hint shows. A branch that builds the hint in one
  helper can fix its wording there.
- **Recommendation:** A. It fixes the copy defect without changing the
  meaning.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6150).
