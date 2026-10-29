# Diagnose the Yarn Classic mirror fallback

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/static_base_manager_mirror.test.ts`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** A hosted test installs ordinary Yarn Classic versions from a committed offline mirror.
- **Problem:** One CI run fell back to tier three instead of tier two. The unchanged rerun passed.
- **Impact if no action:** The test can flake, and its current failure lacks the manager output needed to find the cause.
- **Root question:** How should Mokly diagnose the Yarn Classic mirror fallback?
- **Options:**
  - **A.** Reproduce the fallback with manager output captured. Effort: Small.
  - **B.** Apply A and include manager output in the failure diagnostic. Effort: Small.
- **Left out:** Increasing a timeout has no evidence because the failure did not identify a timeout.
- **Wider fix:** B. Persistent diagnostics make every future occurrence actionable.
- **Previous examples:** PR #200 run 40194214551 attempt 1 recorded the one failure.
- **Recommendation:** A. Reproduction identifies the nondeterminism before changing the test. B best preserves later evidence.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6503).
