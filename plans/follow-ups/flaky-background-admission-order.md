# Background admission order test flakes

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from the CI run of PR #431, branch `ci-fix/site-lighthouse-run-lighthouse-budget`.
- **Location:** `crates/mokly-server/src/_tests_/work/background_tests.rs:85-142`, the test `queued_background_renders_admit_in_request_order`, and its assertion at `:139`. The admission of background renders in the worker pool of `crates/mokly-server/src/work/`.
- **Reason:** The test is in `mokly-server`, which the site change that met it does not touch.

- **Terms:**
  - **Background render:** a render of the Mokly server that runs only when a worker of its pool is free. A foreground render goes first.
  - **Admission:** the moment when a queued render gets a worker.
- **Background:** The test builds a pool with one worker. A foreground render holds the worker behind a gate. The test queues two background renders, `first` and then `second`, and polls each once. It opens the gate, awaits the foreground render, polls `second` once more, and then awaits both renders. It expects the render order `["foreground", "first", "second"]`. Commit `cb233fb50` (#408) on 2026-11-20 last changed the test.
- **Problem:** In CI run 44827646761 of PR #431, attempt 1, the Repository job 136604300214 failed at `cargo test --locked -p "mokly-*" -p xtask`:

  ```text
  thread 'work::work_tests::background_tests::queued_background_renders_admit_in_request_order' panicked at crates/mokly-server/src/_tests_/work/background_tests.rs:139:5:
  assertion `left == right` failed
    left: ["foreground", "second", "first"]
   right: ["foreground", "first", "second"]
  ```

  The rerun of the same commit, job 136614887990, passed. The suspected source is async ordering. After the foreground render ends, the test polls `second` before `first`. When a background render takes the free worker at its own poll, `second` can start first, although it was queued second. The test name claims request order, so either the pool admits renders in poll order, which is a product bug, or the extra poll of `second` makes the test depend on timing.

- **Impact if no action:** The Repository job of Required CI fails now and then on a correct change and needs a rerun.
- **Root question:** Do queued background renders get a worker in request order, whatever order their futures are polled in?
- **Options:**
  - **A.** Make the test deterministic: remove the poll race, for example by awaiting the foreground render before any later poll and by asserting the admission order through an explicit readiness signal. It fits when the pool does not promise request order across polls. Effort: Small.
  - **B.** Make the pool admit queued background renders in request order, for example from a FIFO of waiters that the worker release serves, whatever future polls first. Keep the test and its assertion. It fits when request order is the contract. Effort: Small.
  - **C.** Reproduce first: run the test in a loop, with `--test-threads` set to 1 and to the default, and record the pass counts. Then choose A or B from the evidence. Effort: Small.
- **Left out:** A retry, a sleep, or a longer timeout. The testing rules forbid them for a flaky test.
- **Wider fix:** B, when request order is the contract, because the pool then cannot admit out of order for any caller.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/flaky-held-failure-replacement-hang.md`, the same change and the same kind of timing dependence in the background work. One cause in the pool can explain both.
- **Recommendation:** C, then B or A. The flaky-test rule asks for a reproduction with pass counts before the fix, and the evidence shows which side is wrong.
- **Action:** fix after merge, apply C, because the test is outside the scope of the site change that met it, and one fix in its own branch reaches every open branch.
