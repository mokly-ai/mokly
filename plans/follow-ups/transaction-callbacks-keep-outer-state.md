# Transaction callbacks keep their results outside

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, the wider fix of finding 5 of the review of the branch `calummoore/builds-log-why-an-attempt-ends-as-9iep`, split off from its direct fix.
- **Location:** `crates/mkc-publications/src/transaction.rs`, `crates/mkc-publications/src/build_worker/claim.rs:43-160`, `crates/mkc-publications/src/build_worker/finalize.rs:33-89`.
- **Reason:** The structural fix changes the shared transaction seam and claim code that was on `origin/main` before the branch, outside the files of its diff.

- **Terms:**
  - **Transaction callback:** The closure that `Transactions::run` runs inside one database transaction. The store can run it again after a rolled-back commit, such as a serialization failure in `crates/mkc-store-pg/src/retry.rs`.
  - **Outer state:** Variables outside the closure, such as `claimed`, `handled`, `recovered` and `settled`, that the closure sets so that the caller can read the result after the run.
- **Background:**
  - `Transactions::run` returns only `Result<()>`. A callback that must hand back a value writes it into outer state.
  - Each such variable needs a reset at the start of the callback. Otherwise a replay that finds nothing to do leaves the value of a rolled-back run.
  - The claim and finalization callbacks in `crates/mkc-publications/src/build_worker/` reset `claimed`, `handled`, `recovered` and `settled` by hand.
  - `crates/mkc-publications/src/_tests_/build_worker/warning_replay_tests.rs` replays the finalization and the lease-recovery callbacks and checks that no warning stays. No test replays the claim callback to check the `claimed = None` reset, so a removed reset could start a runner for a rolled-back attempt start.
- **Problem:** Every new output of a callback needs a hand-written reset, and only a replay test catches a missing one.
- **Impact if no action:** A later edit can drop a reset. A replayed transaction then reports a result that the database rolled back, such as a warning or a claimed attempt.
- **Root question:** How can a caller get the result of the transaction run that committed, without outer state?
- **Options:**
  - **A.** Add replay tests for every remaining callback with outer state, starting with the claim callback. Effort: Small.
  - **B.** Add a function next to `Transactions` that runs a callback that returns a value, and returns the value of the run that committed. Move the claim and finalization callbacks to it, and delete their outer variables. A double that returns `Ok` without running the callback gives no value, so the function then returns an internal error. Effort: Medium.
- **Left out:** A lint on outer variables of callbacks, because syntax cannot show that every run sets a variable; the `renewed` variable in `execution.rs` is correct without a reset. A generic method on the `Transactions` trait, because the code uses it as `dyn Transactions`.
- **Wider fix:** B. The value of a rolled-back run can no longer reach the caller.
- **Previous examples:** `crates/mkc-publications/src/_tests_/build_worker/claim_clock_tests.rs` runs the claim callback twice to check its clock reads.
- **Recommendation:** B. It removes the class, and the existing replay tests keep guarding it.
- **Action:** fix after merge, apply B, because it changes the shared transaction seam outside the branch that found it.
