# Diagnose the Yarn Classic mirror fallback

- **Severity:** Low. **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 192.
- **Location:** `tests/static_base_manager_mirror.test.ts:14`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Dependency tier:** the source of a base side's dependencies. Tier two
    is a private base install. Tier three uses the working tree's
    dependencies with a warning.
  - **Offline mirror:** a committed Yarn Classic folder of package archives
    that an install can use without the registry.
- **Background:** The hosted test "a cold Yarn Classic base installs
  ordinary versions from its committed offline mirror" builds a base. Its
  Yarn Classic install must use the committed mirror. It expects tier two.
- **Problem:** The test fell back to tier three instead of tier two once on
  hosted CI, in PR #200 run 40194214551, attempt 1. The unchanged rerun
  passed. The failure output does not include the package manager's
  output, so the cause is unknown.
- **Impact if no action:** The test can fail at random, and its failure does
  not give the evidence that the diagnosis needs.
- **Root question:** How should the test make a tier fallback explain its
  cause?
- **Options:**
  - **A.** Find the cause from a reproduction with the manager output
    captured. Effort: Small (estimate).
  - **B.** Apply A, and also print the manager output in the failure
    message. Effort: Small (estimate).
- **Left out:** A longer timeout has no evidence, because the failure did
  not show a timeout.
- **Wider fix:** B. A lasting diagnostic makes each later failure
  actionable.
- **Previous examples:** The cold manager tests in
  `tests/static_base_managers.test.ts` already report the manager output as
  a test diagnostic when a build does not reach tier two.
- **Recommendation:** A. A reproduction names the source before the test
  changes. B best keeps the evidence of a later failure.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6503).
