# Test the reaped-process mapping of the process table

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-fix-rust-flaky-tests-3snr`, review finding 2.
- **Location:** `crates/mokly-platform/src/unix_process_table/linux.rs:34`, `:55`, and `:83`.
- **Reason:** A deterministic test needs a new seam or a real process in a unit test, and the flake fix that added the mapping does not need it to merge.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Process table:** the `ProcessTable` trait in `crates/mokly-platform/src/unix_process_table/mod.rs`. Its Linux implementation `SystemTable` reads `/proc` and signals processes through a pidfd.
  - **pidfd:** a Linux file descriptor that names one process instance. `pidfd_open` gives EINVAL when the process ID still exists but no longer has a process.
- **Background:**
  - The process-group guard walks the descendants of a child tree and signals each one. A descendant can be reaped while the walk reads it.
  - `SystemTable` now treats three errors of a reaped process as "gone": a gone error while it iterates `/proc/{pid}/task`, ESRCH from `/proc/{pid}/task/{tid}/children`, and EINVAL from `pidfd_open`.
  - Before this mapping, `owned_process_group_terminates_descendants_and_closes_pipes` in `crates/mokly-platform/tests/process_tests.rs` failed when `group.kill()` returned ESRCH (Linux CI run 45448562116) or EINVAL. Local repeats under CPU load gave 3 such failures in 4,000 runs before the fix and none in 4,000 runs after it.
  - Only that stress test reaches the mapping, and only by chance. The unit tests of the walk use a mocked table.
- **Problem:** No test fails every time when one of the three mappings is reverted.
- **Impact if no action:** A regression of the mapping shows again only as a rare flaky failure of the process-group test.
- **Root question:** How does a test prove every time that the walk treats a process reaped during a read as gone?
- **Options:**
  - **A.** Add a Linux integration test through a small public test seam that exposes `SystemTable::signal`. The test starts `sh -c 'sleep 1000 & exit 0'` in its own process group, reaps the leader, signals the leader identity, and expects `Ok(())`, because the group keeps the leader PID referenced and `pidfd_open` gives EINVAL. It kills the group at the end. The ESRCH paths stay untested. Effort: Small.
  - **B.** Move the classification of each `/proc` and pidfd error into one pure function and unit-test it for each error code, and keep option A for the real system call. Effort: Small.
  - **C.** Add a fault-injection seam for the `/proc` reads, so the walk tests script ESRCH in the middle of a read. Effort: Medium.
- **Left out:** A unit test that starts a real process, because the `rust` skill forbids subprocesses in unit tests.
- **Wider fix:** B. One error classification makes every gone case testable without real processes.
- **Previous examples:** Commit `1ac39faf1` added the earlier gone handling, which only the mocked walk tests cover. On 2026-11-26, the macOS side of the class, a group signal that macOS refused while its members were in exit or in a fork, got a mocked test in `crates/mokly-platform/src/unix_process_tree/_tests_/outcome_tests.rs`. Its errno mapping became one function, `classify` in `crates/mokly-platform/src/unix_group_members.rs`, with a unit test for each result. That is option B of this item, for macOS.
- **Recommendation:** A. It tests the real system call that failed. B protects the codebase best.
- **Action:** fix after merge, apply A, because the flake fix is proven by repeats and the test needs a new public seam.
