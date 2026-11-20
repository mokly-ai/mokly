# Held-failure replacement test can hang

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-20, from a local repository suite run on the branch `ci-fix/site-lighthouse-run-lighthouse-budget` (PR #431).
- **Location:** `crates/mokly-server/src/_tests_/background_batch/cancellation_tests.rs:172-184`, the test `a_replacement_seen_when_a_render_ends_discards_a_held_failure`. The background batch pass of `crates/mokly-server/src/background_stage.rs`.
- **Reason:** The test is in `mokly-server`, which the site change that met it does not touch.

- **Terms:**
  - **Background batch pass:** the Mokly server pass that renders queued routes in bounded batches when workers are free.
  - **Held failure:** a render failure that the pass keeps back while a newer catalogue snapshot can still replace the batch.
- **Background:** The test starts a pass with a held failure, swaps in a replacement snapshot, and releases the render of route 0. It then awaits `replacement_renders.next_start()`, releases route 2, and awaits the pass task. It expects no reported failure and one published batch, `[route(0)]`. Commit `cb233fb50` (#408) on 2026-11-20 last changed the test.
- **Problem:** On 2026-11-20, in a local run of `cargo xtask check --suite repository` with 4 vCPUs and the CI Rust settings, the test printed `has been running for over 60 seconds` and then hung. The `mokly_server` test process ran for 34 minutes at 0.1 % CPU until it was stopped. Five runs of the test alone each passed in seconds. The test awaits `next_start()` and the task with no time limit. The suspected source is a lost wake-up: when the pass checks for a replacement before the swap is visible, it starts no replacement render, and `next_start()` never resolves.
- **Impact if no action:** A run of the Rust tests can hang until the job time limit, and the gate fails on a correct change.
- **Root question:** How does the test prove that a replacement seen at the end of a render discards the held failure, without depending on when the pass sees the swap?
- **Options:**
  - **A.** Reproduce first: run the test many times under parallel load, record the pass counts, and capture the task state of a hung run. Effort: Small.
  - **B.** Make the test wait for an explicit readiness signal: let the pass report that it observed the replacement, and release route 0 only after that. Keep every assertion. Effort: Small.
  - **C.** When the pass can miss a swap that lands while a render ends, fix the pass so that it reads the current snapshot after each render ends, and keep the test. Effort: Medium.
- **Left out:** A test timeout or a retry. A timeout turns the hang into a failure but hides the race, and the testing rules forbid a retry.
- **Wider fix:** C, when the pass can miss the swap, because then no caller meets the race.
- **Previous examples:** `plans/follow-ups/flaky-background-admission-order.md`, another `mokly-server` test of the same change that depends on task timing.
- **Related:** `plans/follow-ups/flaky-background-admission-order.md`, the same change and the same kind of timing dependence in the background work. One cause in the pool can explain both.
- **Recommendation:** A, then B or C. The flaky-test rule asks for a reproduction with pass counts, and the captured state shows whether the test or the pass is wrong.
- **Action:** fix after merge, apply A, because the test is outside the scope of the site change that met it, and one fix in its own branch reaches every open branch.
