# A macOS stop can fail with EPERM

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-a-ube3`, the root-cause analysis of the flaky test `a_hanging_checkout_filter_is_bounded`.
- **Location:** `crates/mokly-platform/src/unix_process_tree/group.rs:44-89`, `crates/mokly-platform/src/unix.rs:94-123`, `crates/mokly-platform/src/unix_process_table/macos.rs:48-59`, `crates/mokly-platform/src/unix_process_tree/walk.rs:116-123`, and `crates/mokly-git/src/system.rs:131-201`.
- **Reason:** A macOS run reproduced the error, but no run named the system call that returns EPERM or the state of its process, so the fix is not known.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Stop:** the SIGTERM, and after a one-second grace period the SIGKILL, that the Git runner sends to the process tree of a Git command when the command is cancelled or reaches its deadline.
  - **Process tree guard:** `UnixGroup` in `crates/mokly-platform/src/unix_process_tree/group.rs`. Each signal stops the process group with SIGSTOP, walks the descendants, and signals the group and each descendant.
- **Background:**
  - `SystemRunner::execute` in `crates/mokly-git/src/system.rs` calls `signal` for each step of a stop. When the guard returns an error, the runner returns `Error::Platform` before its `CheckoutTimeout` and `Cancelled` branches.
  - `UnixGroup::signal` keeps the first error of any step and returns it at `group.rs:88`.
  - On macOS, the guard already accepts EPERM from the group signal when every group member is gone or a zombie, in `group_is_gone` in `crates/mokly-platform/src/unix.rs`. The single-process signal in `macos.rs` and the SIGSTOP of the walk in `walk.rs` accept only ESRCH.
  - Until 2026-11-26, `a_hanging_checkout_filter_is_bounded` in `crates/mokly-git/tests/checkout_tests.rs` used a fake clock that adds 5 ms on each pause and never waits. The 120-second deadline then passed a few milliseconds after the spawn of Git, and the SIGKILL followed the SIGTERM within microseconds.
  - With that clock, a Linux probe saw the deadline pass before Git started its filter in 154 of 200 runs.
  - The test failed once on `Native (macos-26)` in CI run 45443894288, attempt 1, and passed on the rerun.
  - On 2026-11-25, a temporary probe of the old clock ran on a GitHub-hosted `macos-26` runner, with the filter `sh -c 'sleep 60'`. 300 sequential runs all returned `Conversion { source: CheckoutTimeout }`. Of 600 runs with 6 processes at once, 596 did, and 4 returned this error:

    ```text
    Platform { source: Internal(Io { source: Os { code: 1, kind: PermissionDenied, message: "Operation not permitted" }, defined_at: Location { file: "crates/mokly-platform/src/unix_process_tree/group.rs", line: 88, column: 49 } }) }
    ```

  - A second probe printed each failed signal call and each EPERM member check. 2,400 runs with 6 processes at once gave no failure, so it named no call. Its printing can have changed the timing.
  - So the old clock gave 4 failures in 3,000 parallel macOS runs across the two probes.
  - A third probe started 8,000 runs with 12 processes at once and reached its 60-minute job limit before it wrote a result. The 2,400 runs of the second probe took about 3 minutes. A guess, not confirmed: a stop during the fork of the filter leaves `sleep 60` processes behind, and they slow the runner.
  - The branch that added this item changed the hanging filter test to `HangClock` in `crates/mokly-git/tests/support/hang_clock.rs`. The deadline now passes only after the filter has started.
  - At branch commit `4cfbd3b7c`, that clock waited with `std::thread::sleep`, and the three checkout tests that use it each passed 500 of 500 macOS runs with 6 processes at once. Later in the same branch, the clock started to wait through `SystemClock`, and no macOS repeat ran with that version. At the base rate of 4 in 3,000, about half of all samples of 500 old-clock runs would pass too, so these passes are weak evidence.
  - No repeat showed whether a current test reaches the error. `an_active_git_process_is_cancelled_through_its_process_group` in `crates/mokly-git/tests/cancellation_tests.rs` cancels a Git command at the first supervision check after the spawn, on every platform. No macOS repeat covered it.
  - A cancellation can come at any time in the product, also while Git starts a helper. No probe showed in which other phases of a command the error can occur.
- **Problem:** On macOS, a stop of a Git process tree can fail with EPERM. The runner then returns a platform error in place of the cancellation or deadline result. The four failures came when the old clock sent SIGTERM and SIGKILL a few milliseconds after the spawn of Git. No run named the call or the state of its process.
- **Impact if no action:** A rare stop on macOS reports a platform error, and the caller treats the command as failed instead of cancelled. A stop during a fork can perhaps leave a filter process behind, which the third probe suggests but does not show.
- **Root question:** How does a stop on macOS report the cancellation or the deadline result, also when the process tree changes during the stop?
- **Options:**
  - **A.** Trace first. Run a temporary macOS probe of the old clock that writes each failed signal call to a file and stays inside the job limit, for example in batches of 1,000 runs. Name the call and the state of its process. Then add a failing unit test with the mocked process table in `crates/mokly-platform/src/unix_process_tree/_tests_/group_tests.rs`, and fix that call. Also count the `sleep` processes that remain after each batch. Repeat, without the trace, `an_active_git_process_is_cancelled_through_its_process_group` and the old-clock and new-clock hanging filter tests, a few thousand runs each, to learn which current tests reach the error. Effort: Medium.
  - **B.** Fix without a trace. Treat EPERM from the single-process signal and from the SIGSTOP of the walk as gone when the process is a zombie or no longer has the same identity, as `group_is_gone` does for the group. Add a unit test with the mocked process table. The guess can miss the real call. Effort: Small.
  - **C.** Change nothing. The error stays rare and macOS-only, but the probes did not show in which phases of a command a stop meets it. Effort: Small.
- **Left out:**
  - Accept every EPERM as gone. It hides a real permission error, such as a process that another user owns.
  - Retry the signal. The `testing` skill forbids a retry in place of a named source, and a retry does not tell a gone process from a refused one.
- **Wider fix:** A. It names the transition that the guard misses, so one fix covers every process tree that the guard owns: Git, the sidecar, and base installs.
- **Previous examples:** `owned_process_group_terminates_descendants_and_closes_pipes` failed from the same class of race on Linux. Commit `86f675549` made the Linux process table treat a reaped process as gone.
- **Related:**
  - `plans/follow-ups/macos-stop-mid-walk-orphans.md` covers another macOS gap of the same walk: an orphan that the walk cannot reach. A change to the macOS walk can serve both items.
  - `plans/follow-ups/process-table-gone-mapping-test.md` asks for a test of the Linux gone mapping, the Linux side of the same class.
- **Recommendation:** A. Only a trace shows which call refuses the signal, so that the fix keeps real permission errors. B is cheaper, but it can fix the wrong call.
- **Action:** ask the user, because no run named the call that returns EPERM, and the flaky-test rule sends an unknown source to the user.
