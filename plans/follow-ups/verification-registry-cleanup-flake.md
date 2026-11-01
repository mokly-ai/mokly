# Stabilize verification registry cleanup

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: outside the scope of a verification round of the rebuild.
- **Location:** `tests/serve_process.test.ts:75` and
  `scripts/verification/process-owner-snapshot.mjs:24`.
- **Reason:** The test failed once in an unrelated gate run and passed in an
  isolated rerun, so a separate branch investigates it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Verification registry:** the record of process owners that the
    verification scripts keep, so that a gate can name and stop every
    process that a suite starts.
- **Background:** The test and the registry check work as follows.
  - The test "the verification registry names Serve's group until it drains"
    starts Serve. It checks that the registry names Serve's process group
    until the group drains.
  - It runs on POSIX systems only.
  - `process-owner-snapshot.mjs` fails with `Verification owner {id} has no parent` when an owner has no parent process.
- **Problem:** The test failed once with `Verification owner {id} has no parent`, and the isolated rerun passed. The suspected source is concurrent
  process-registry cleanup, not proven. The record gives no run, commit, or
  full log.
- **Impact if no action:** A gate can fail on this test without a product
  change, and the developer must rerun it.
- **Root question:** How should the test read the registry while another
  cleanup can remove a parent?
- **Options:**
  - **A.** Drop the item unless the failure recurs. Effort: Small.
  - **B.** Repeat the test to reproduce the failure, then isolate the
    registry state of the test, or wait on an explicit drain signal. Keep
    every assertion, and record the pass counts. Effort: Small.
- **Left out:** A retry, a sleep, or a longer timeout breaks the
  deterministic-test rule.
- **Wider fix:** B. Isolated registry state stops other cleanups from
  changing the snapshot that a test reads.
- **Previous examples:** None found.
- **Recommendation:** B. It finds the source before any change.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4436).
