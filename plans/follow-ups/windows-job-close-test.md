# Make the Windows job-close test effective

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-platform/tests/process_tests.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** The Windows job-close test runs `cmd set /p` and then waits. `Child::wait` closes stdin before the assertion.
- **Problem:** The child can exit because stdin closed even when the job did not kill it.
- **Impact if no action:** The test can pass while process cleanup is broken.
- **Root question:** How should Mokly make the Windows job-close test effective?
- **Options:**
  - **A.** Append a leaked-output command and assert that it never prints. Effort: Small.
  - **B.** Create one helper that proves job termination and use it in every job-close test. Effort: Medium.
- **Left out:** An elapsed-time assertion would add machine-speed dependence.
- **Wider fix:** B. One event-based proof prevents false positives in every job-close test.
- **Previous examples:** Delta review 1 found the ineffective `set /p` proof.
- **Recommendation:** A. It makes the current test fail when the child survives. B best protects all job-close cases.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6348).
