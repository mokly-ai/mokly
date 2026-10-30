# Cover every workflow runner label

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 132, the actionlint review finding.
- **Location:** `tests/actionlint_config.test.ts:32` and
  `tests/actionlint_config.test.ts:40`.
- **Reason:** On 2026-10-21 the user deferred the open review items of PR #199
  until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Test (estimate).
- **Terms:**
  - **Runner label:** the `runs-on` value of a GitHub Actions job, such as
    `blacksmith-8vcpu-ubuntu-2404`.
- **Background:** `tests/actionlint_config.test.ts` collects every
  Blacksmith runner label that the workflows use, and checks that the
  actionlint configuration lists exactly those labels.
- **Problem:** The test reads only `.yml` workflow files. For a job with a
  matrix, it reads only the matrix values and skips the job's own `runs-on`.
  Three `ci.yml` jobs have both a fixed label and a matrix, at lines 111,
  159, and 264 today.
- **Impact if no action:** A `.yaml` workflow or the fixed label of a matrix
  job can use a runner label that actionlint does not know, and no test
  fails.
- **Root question:** How should the test find every runner label that a
  workflow uses?
- **Options:**
  - **A.** Include `.yaml` workflows and each matrix job's own `runs-on`
    label in the label coverage test. Effort: Small.
  - **B.** Keep the current `.yml` and matrix-only coverage. Effort: Small
    (estimate).
- **Left out:** A second workflow parser would repeat the existing test
  without covering more behaviour. Only two approaches exist: complete the
  test, or keep its gaps.
- **Wider fix:** A. The existing test can cover both missed places.
- **Previous examples:** None found.
- **Recommendation:** A. It completes the current test with a small change.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild. Condition 6 also
  holds, because the item concerns a test gap.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6053).
