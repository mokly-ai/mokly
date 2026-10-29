# Cover every workflow runner label

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/actionlint_config.test.ts`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** A repository test checks workflow runner labels against the actionlint configuration.
- **Problem:** It reads only `.yml` files and skips a job's own `runs-on` when the job also has a matrix.
- **Impact if no action:** A `.yaml` workflow or fallback label can use an unconfigured runner without a test failure.
- **Root question:** How should Mokly cover every workflow runner label?
- **Options:**
  - **A.** Include `.yaml` workflows and each matrix job's own `runs-on` label. Effort: Small.
  - **B.** Keep the current `.yml` and matrix-only coverage. Effort: Small.
- **Left out:** A second workflow parser would duplicate the existing test without covering another behavior.
- **Wider fix:** A. The existing structural test can cover both omitted locations.
- **Previous examples:** The actionlint review found three CI jobs with both label forms.
- **Recommendation:** A. It completes the current test with a small change.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6053).
