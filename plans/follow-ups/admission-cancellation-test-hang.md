# Admission cancellation test hangs instead of failing

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the finding check of review round 1, finding 1,
  on branch `calummoore/mokly-startup-base-overlap-rae7`. The check put this
  problem outside the scope of that branch.
- **Location:** `crates/mokly-cli/src/_tests_/serve_pool_tests.rs:96` to line
  116, `crates/mokly-cli/src/_tests_/serve_pool_tests.rs:118` to line 137,
  `crates/mokly-cli/src/_tests_/serve_pool_support.rs`,
  `crates/mokly-cli/src/serve_pool.rs:96` to line 99, and
  `crates/mokly-cli/src/serve_pool_gate.rs:83` to line 155.
- **Reason:** The test and its cancellation subscription were already on
  `origin/main`, and the branch that found the gap changed neither.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Serve:** The Mokly development server that `mokly serve` starts.
  - **Sidecar admission:** The gate in `crates/mokly-cli/src/serve_pool_gate.rs` that holds a base sidecar call while a foreground render holds its lease.
  - **Cancellation subscription:** The `cancel.observe(...)` call in `ServePool::pool`, which registers the gate as a wake signal of a base cancellation.
  - **Expected-state wait:** A wait for a state that the test expects, with a test-supplied allowance of at least 10 seconds, under `docs/protocol/ci-test-timing.md`.
- **Background:**
  - A base sidecar call in Serve waits at sidecar admission while a foreground render holds its lease. `Gate::acquire` at `serve_pool_gate.rs:83` loops. It returns `Error::Cancelled` when the gate is closed or the base cancellation is cancelled. Otherwise it sleeps on the `changed` condition variable.
  - `ServePool::pool` at `serve_pool.rs:96` to line 99 subscribes the gate to the base cancellation. `ChangeToken::cancel` at `crates/mokly-server/src/changes.rs:65` to line 74 notifies only the signals that observe it. The gate's `ChangeSignal::notify` at `serve_pool_gate.rs:128` to line 133 then wakes the condition variable.
  - Other events also wake the condition variable: a new waiter, a lease drop at `serve_pool_gate.rs:142` to line 155, and `Gate::close` at line 118 to line 125.
  - The test `cancellation_wakes_queued_base_work_without_waiting_for_the_foreground` at `serve_pool_tests.rs:97` holds a foreground lease for its whole body. It queues one base request on a worker thread and waits until the gate counts one waiting request. Then it cancels the `ChangeToken`.
  - The test then joins the worker and asserts `Err(Error::Cancelled)`. It also asserts a foreground count of 1, and an immediate `Err(Error::Cancelled)` for a later request with the same token.
- **Problem:**
  - When a change removes the subscription at `serve_pool.rs:98`, the cancel wakes nothing. The foreground lease stays held, so no other event wakes the gate. The join at `serve_pool_tests.rs:107` then blocks forever. The test hangs and never reaches its assertion.
  - The Rust tests have no per-test timeout. Under `docs/protocol/ci-test-timing.md`, the CI job timeout is their only hang guard. The complete Rust tests run in the repository job, with a 75-minute timeout, and in the native jobs, with a 60-minute timeout, under `docs/protocol/ci-workflow.md`.
  - `shutdown_closes_both_sides_and_wakes_pending_admission` at `serve_pool_tests.rs:118` joins a queued worker in the same way. It depends on the wake in `Gate::close`.
  - Nobody ran the mutation. The hang follows from a read of the code. No production flake is shown: the subscription exists, and the test passes.
- **Impact if no action:** A later change that drops the subscription hangs the Rust job until its timeout. The job then names no failed assertion, so the cause takes longer to find.
- **Root question:** How does the ordinary admission cancellation test fail on an assertion, not hang, when its cancellation wake breaks?
- **Options:**
  - **A.** Change only this test. The worker sends its result through a channel. The test receives the result with an expected-state allowance of at least 10 seconds and saves it unasserted. It also saves the foreground count. Then it frees the worker through an independent path: it drops the foreground lease, which wakes the gate. It joins the worker and then asserts the saved values. Keep every existing assertion, the late request included. Effort: Small.
  - **B.** A, through one shared helper in `crates/mokly-cli/src/_tests_/serve_pool_support.rs`. The helper runs a call on a worker, receives its result with the expected-state allowance, runs a cleanup closure, joins the worker, and returns the saved result. Use it in this test and in the shutdown test. Each cleanup drops the foreground lease, so it does not depend on the wake under test. Effort: Small.
  - **C.** Add a per-test timeout to the Rust test runner, so that each hung test fails sooner with its name. This adds a gate and changes the hang guard rule of `docs/protocol/ci-test-timing.md`. Effort: Medium.
- **Left out:** A production change, such as a gate wait that subscribes its own cancellation, fails the goal, because the test must still prove the subscription. A polling wait in the gate fails the goal, because a timeout would then hide a missing wake. Changing nothing fails the goal, because a removed subscription keeps hanging the job.
- **Wider fix:** B. One helper gives each admission test that joins a blocked worker the same assertion failure. C is a detection fix for every hung Rust test, but it adds a gate, so it waits for the user.
- **Previous examples:** `crates/mokly-graph/src/_tests_/snapshot_digest_tests.rs:97` receives a worker result with a 10-second allowance before it releases and joins the worker. In `crates/mokly-cli/src/_tests_/serve_early_pool_tests.rs`, `cancellation_ends_early_admission_before_usage_settles` and `an_unavailable_early_slot_waits_outside_admission_then_uses_ordinary_calls` use the same pattern for early admission.
- **Related:** `plans/follow-ups/base-lifetime-wake-forwarding-test.md` adds admission tests with the product base lifetime. Those tests can use the helper of B. The two items are independent.
- **Recommendation:** B. It fixes this test and gives the shutdown test the same failure mode with one small helper. A is the direct fix when only this test changes.
- **Action:** fix after merge, apply B, because the test, its support file, and the subscription were on `origin/main`, outside the diff of the branch that found the problem.
