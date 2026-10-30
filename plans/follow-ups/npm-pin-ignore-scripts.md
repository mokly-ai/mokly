# Check npm pinning with ignore-scripts

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  a problem outside the scope of the review of the 200 B work.
- **Location:** `tests/npm_pin.test.ts:41-61`, with the match at line 48.
- **Reason:** The review found the gap in a test that its change did not
  edit, and the user must choose the proposed test coverage.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **npm pin:** the exact npm version that `packageManager` in the root
    `package.json` names, `npm@11.21.0` today.
- **Background:**
  - The test "CI and release jobs set up the pinned npm before npm ci"
    reads `ci.yml`, `release.yml`, and `release-prepare.yml`.
  - For each job, it finds the install step with
    `step.run === "npm ci"`, at line 48. It then requires an
    `npm install --global npm@{pin}` step before it.
  - Two release jobs install with `npm ci --ignore-scripts`, at
    `.github/workflows/release.yml:181` and `:250`.
  - `PINNED_WORKFLOWS` names only three workflows. Six other workflows
    contain `npm ci` commands. The separate automation test checks npm
    version values, but it does not check setup order in those workflows.
- **Problem:** The exact match skips each job whose install step is
  `npm ci --ignore-scripts`, so the test never checks those jobs.
- **Impact if no action:** A release job can install with an npm version
  other than the pin, and the test still passes.
- **Root question:** How does the pin test find every `npm ci` install
  step?
- **Options:**
  - **A.** Match a step whose command starts with `npm ci`, with or without
    flags. Effort: Small.
  - **B.** Change nothing. Effort: Small.
  - **C.** Apply A, and discover every workflow under `.github/workflows/`
    instead of keeping three filenames. Check setup order for each direct
    `npm ci` install step, including steps with flags. Effort: Small
    (estimate).
- **Left out:** Remove `--ignore-scripts` from the jobs. The release
  protocol requires native jobs to install with lifecycle scripts off.
- **Wider fix:** C (estimate). Discovery covers later workflows as well as
  install steps with flags.
- **Previous examples:** None found.
- **Recommendation:** C (estimate). It checks setup order across the
  workflow inventory instead of repairing only the three named files.
- **Action:** ask the user, because condition 6 holds (estimate): this is a
  missing-test proposal, and no recorded user choice approves it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6736).
