# Linux parent-exit process-tree stop sometimes fails

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from the repository CI job of PR #331.
- **Location:** `crates/mokly-platform/tests/process_tree_tests.rs:85`,
  `crates/mokly-platform/src/unix_process_tree/group.rs:88`, and
  `crates/mokly-platform/src/unix_process_table/linux.rs`.
- **Reason:** The failure is outside the viewer fix, and its exact failing
  operating-system operation is not known.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Process tree:** a child process and its descendants, which Mokly must
    stop even when a descendant starts a new session.
  - **Process identity:** a process ID and its recorded start time, which
    prevent a signal from reaching an unrelated reused process ID.
  - **pidfd:** a Linux file descriptor that identifies one process instance
    for a signal.
- **Background:**
  - The test
    `unix::kill_keeps_a_child_whose_intermediate_parent_dies_after_terminate`
    starts a real process tree in its `parent-exits` mode.
  - It terminates the tree, waits for the original child and its intermediate
    descendant to exit, then checks that the last descendant is still alive.
    It calls `tree.group.kill()` and checks that the descendant is gone.
  - The Unix group retains process identities across those two operations.
    Its Linux process table reads `/proc` and sends signals through pidfds.
  - PR #321 merged on 2026-11-18 as `159231c31`. It added `defined_at` to
    each platform I/O error so that the next failure would name its call
    site. This failure is the first one recorded with that field.
  - The Linux repository job failed on commit
    `e1dfcc1a0ebfdd31954552fd81d602281cfcaa43`, at the `kill().unwrap()`
    assertion on line 92. The six-test integration binary reported five
    passes and one failure. Cargo returned status 101.
  - Failure text:
    `called Result::unwrap() on an Err value: Internal(Io { source: Os { code: 22, kind: InvalidInput, message: "Invalid argument" }, defined_at: Location { file: "crates/mokly-platform/src/unix_process_tree/group.rs", line: 88, column: 49 } })`.
  - The reported group location wraps the first error from several
    process-table or signal operations. It does not identify which operation
    returned OS error 22. The new field therefore names the error collection
    site, rather than the failing operation that PR #321 sought to identify.
  - Rerun outcome: the unchanged test passed in the complete local gate on
    merge commit `61b2c52fa9fc33a7d7219a4d1692eb72618a23eb`. It also passed
    in the two complete local gates before that CI run. No process-tree code
    or assertion changed between the failure and those passes.
  - Suspected source: real process-exit and reparenting order during process
    discovery or signaling. The exact operation and cause are not confirmed.
- **Problem:** The Linux gate can fail on a change that does not touch the
  process-tree code. The current error does not show whether the race is in
  the fixture, process discovery, or signal delivery.
- **Impact if no action:** Correct pull requests can receive a false CI
  failure. A real failure to stop a descendant can be dismissed as a test
  flake.
- **Root question:** How should the failing Linux stop operation be
  identified before a correction is selected?
- **Options:**
  - **A.** Repeat the existing integration test on Linux and capture the
    process identities and operating-system operations for a failed run.
    Choose a correction from that evidence in a separate branch. Keep every
    assertion. Effort: Medium.
  - **B.** Add operation and process-identity context at the shared
    process-table and signal error boundary. Then repeat the unchanged test
    to identify the failing operation. This reaches more code, but also
    makes other process-stop failures easier to diagnose. It finishes the
    diagnosis that PR #321 started. Effort: Medium.
- **Left out:** A retry, sleep, skip, or longer time limit hides the source.
  No third safe correction can be selected from an error that does not name
  its failing operation.
- **Wider fix:** B gives all process-stop errors their operation and process
  context. It improves diagnosis. A structural fix for the race cannot be
  selected until its cause is known.
- **Previous examples:** On 2026-11-18, the checkout deadline test
  `a_batch_stopped_by_a_real_deadline_converts_each_file_alone` failed once
  in a complete gate with the same
  `Os { code: 22, kind: InvalidInput, message: "Invalid argument" }` from
  `mokly-platform`. Its suspected boundary was also a process-tree stop.
  Its record is the [deleted checkout deadline item at its last commit](https://github.com/mokly-ai/mokly/blob/a44e40119/plans/follow-ups/flaky-checkout-conversion-deadline.md).
- **Related:** The checkout deadline failure and this parent-exit failure
  can share one cause. Both report OS error 22 during a Unix process-tree
  stop. The evidence does not yet show that their causes are the same.
- **Recommendation:** A. First identify the failing operation without
  changing product behavior. B improves diagnosis across the shared code.
- **Action:** ask the user, because the exact failing operation and source
  are unknown, so no correction is supported by a reproduction yet.

Failure source: [repository CI job](https://github.com/mokly-ai/mokly/actions/runs/44353587486/job/134975688281).
