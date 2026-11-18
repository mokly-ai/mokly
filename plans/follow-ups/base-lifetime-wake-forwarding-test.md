# Test the base lifetime's admission wake forwarding

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the finding check of review round 1, finding 1,
  on branch `calummoore/mokly-startup-base-overlap-rae7`. The check put this
  problem outside the scope of that branch.
- **Location:** `crates/mokly-cli/src/serve_base_cancel.rs:77` to line 81,
  `crates/mokly-cli/src/serve_changes_base.rs:52` to line 55,
  `crates/mokly-cli/src/serve_changes_native.rs:117` to line 129 and line 264,
  and `crates/mokly-cli/src/serve_pool.rs:96` to line 113.
- **Reason:** The forwarding code was already on `origin/main`, the branch
  that found the gap did not change it, and no product defect is shown.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Generation token:** The `ChangeToken` of one Changes attempt in Serve. A new head or a moved merge base cancels it.
  - **Base lifetime:** `PreparingBase` in `crates/mokly-cli/src/serve_base_cancel.rs`, the cancellation that every service of a preparing base shares until Serve keeps the base.
  - **Combined cancellation:** `CombinedCancel` in `crates/mokly-cli/src/serve_changes_base.rs`, which joins the command stop, the generation token, and the capture operation.
  - **Early admission:** The wait of early base preparation for one sidecar slot while the current usage pass renders.
  - **Expected-state wait:** A wait for a state that the test expects, with a test-supplied allowance of at least 10 seconds, under `docs/protocol/ci-test-timing.md`.
- **Background:**
  - `Source::classify_native` at `serve_changes_native.rs:107` composes each Serve Changes classification. Lines 117 to 122 build a `CombinedCancel` over the operation, the command, and the generation token. They wrap it in a `PreparingBase`.
  - Serve passes that base lifetime to early admission through `ServePool::preparing` at line 127. It passes it to ordinary base admission through `classification_runtime` at line 129, which calls `ServePool::pool` at line 264.
  - Both admission paths subscribe their wake to the cancellation that they receive: `ServePool::pool` at `serve_pool.rs:96` to line 99, and `ServePool::preparing` at lines 111 to 113.
  - A generation cancel reaches those wakes only through two forwards. `PreparingBase::observe` at `serve_base_cancel.rs:77` to line 81 forwards to its `CombinedCancel` while the base prepares. `CombinedCancel::observe` at `serve_changes_base.rs:52` to line 55 forwards to the generation token and the operation.
  - `ChangeToken::cancel` at `crates/mokly-server/src/changes.rs:65` to line 74 notifies only the signals that observe it.
  - At the keep, `PreparingBase::detach` at `serve_base_cancel.rs:44` to line 49 drops the preparing cancellation. Later observers then follow only the command stop, as the cancellation rule of `docs/protocol/mokly-base-preparation.md` requires for a kept base.
- **Problem:**
  - No test checks that a generation cancel wakes an admission wait through these two forwards.
  - The ordinary admission test at `crates/mokly-cli/src/_tests_/serve_pool_tests.rs:97` and the early admission tests in `crates/mokly-cli/src/_tests_/serve_early_pool_tests.rs` observe a bare `ChangeToken`.
  - `crates/mokly-cli/src/_tests_/serve_capture_generation_tests.rs:106` and line 221, and `crates/mokly-cli/src/_tests_/serve_base/support.rs:51` to line 56, build the real lifetime. None of them waits in admission or checks a wake.
  - A command or browser test does not isolate this wake. Other events also wake admission: a lease release in the gate, a sidecar capacity notice, the end of current usage, and a gate close. The sidecar calls and HTTP renders of a new head also wake early admission through `Gate::wake_return` at `crates/mokly-cli/src/serve_pool_gate.rs:58`.
  - No product defect is shown. By a read of the code, the forwarding exists and works.
- **Impact if no action:** A later change can drop either forward without a failed test. A cancelled base preparation then sleeps in admission until an unrelated event wakes it. `ChangesPass` awaits that cancelled work at `crates/mokly-server/src/changes_background.rs:117`, and the usage pass runs one Changes preparation at a time at `crates/mokly-server/src/background.rs:83`. So Changes for the new head stays pending or preparing. Shutdown is not affected, because `cancel_renders` at `crates/mokly-server/src/runtime.rs:124` closes the gate before the work is joined.
- **Root question:** How do we make sure that a later change cannot silently drop the wake that carries a generation cancel through the Serve base lifetime into sidecar admission?
- **Options:**
  - **A.** Add one ordinary admission test with the product lifetime. Hold a foreground lease. Pass a `PreparingBase` over a `CombinedCancel` with a real generation `ChangeToken` to `ServePool::pool`. Queue a base request, and cancel only the generation token. Receive the result with an expected-state wait, then free the worker through an independent path, join it, and assert `Err(Error::Cancelled)`. Effort: Small.
  - **B.** A, plus the same check for early admission. Pass the product lifetime to `ServePool::preparing` with unsettled usage and a missed early slot. Cancel only the generation token. Assert `Err(Error::Cancelled)`, no sidecar call, and unchanged admission counters, with the same expected-state wait and cleanup. This covers both admission paths that Serve composes with the lifetime. Effort: Small.
  - **C.** Test the two forwards alone with a counting `ChangeSignal`. Observe it through `PreparingBase`, cancel the generation token, then the operation, and count the wakes. After `detach`, check that a new observer gets no generation wake. This proves the forwards, not their connection to admission. Effort: Small.
- **Left out:** A production change that subscribes admission to the generation token directly fails the goal, because a test of the wake is still needed and no defect asks for the change. Changing nothing fails the goal, because a dropped forward would then pass every test. A command or browser test fails the goal, because other events also wake admission.
- **Wider fix:** None. The `testing` skill already requires a behaviour test for each changed requirement. This item adds the missing test for an unchanged requirement.
- **Previous examples:** `cancellation_ends_early_admission_before_usage_settles` in `crates/mokly-cli/src/_tests_/serve_early_pool_tests.rs` tests the same early wake with a bare `ChangeToken`.
- **Related:** `plans/follow-ups/admission-cancellation-test-hang.md` proposes a shared expected-state helper for admission tests that join a blocked worker. The tests of this item can use it. The two items are independent.
- **Recommendation:** B. It covers both admission paths that Serve wires to the base lifetime, at the level of the existing admission tests. C is smaller, but it does not test the connection to admission.
- **Action:** fix after merge, apply B, because the forwarding code was on `origin/main` and unchanged by the branch that found the gap, and no product defect is shown.
