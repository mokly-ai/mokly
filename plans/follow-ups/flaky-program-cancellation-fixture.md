# Cancellation test hangs after fixture start failure

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, while tracing the environment probe at commit `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd`.
- **Location:** `crates/mokly-compare/tests/program_tests.rs:181`, with fixture creation at line 192 and the FIFO read at line 228.
- **Reason:** This is a separate test and assertion from the environment-token probe that the branch fixes.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Cancellation test:** `cancellation_kills_a_script_child_tree`, which starts a real shell tree through `TimedCommands` and checks its cancellation.
  - **Fixture manager:** the executable shell script that this test writes into its temporary directory.
  - **FIFO:** the named pipe `child.pid`, through which the fixture reports the child PID before the test cancels it.
  - **`ETXTBSY`:** the Linux error `Text file busy`, returned when an executable remains open for writing.
- **Background:**
  - Mokly's base installer starts and stops owned package-manager process trees.
  - This integration test uses the real `SystemSpawner`, `TimedCommands`, process groups, and a local shell tree.
  - The test starts `mkfifo`, writes an executable `manager` script, and starts a worker that calls `commands.run`.
  - The script starts `sleep 1000`, writes its PID into the FIFO, and waits for it.
  - The test reads the FIFO before it cancels the token or joins the worker.
  - The other tests of this binary also start processes with default parallel threads.
  - The first three hangs occurred on Linux 6.8.0-117-generic with four CPUs on 2026-11-19.
  - The source was `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd` and had no investigation edits.
  - One untraced batch completed 519 whole-binary passes before run 520 hung.
  - All other six tests passed in run 520, including the environment probe.
  - An attached trace then showed the cancellation thread blocked in `openat("/tmp/.tmpbKNAqm/child.pid", O_RDONLY|O_CLOEXEC)`.
  - The process had two threads, no child processes, and only standard input, output, and error descriptors.
  - That run had no trace of the earlier manager start, so its exact start outcome is unknown.
  - A basic-trace batch completed 475 whole-binary passes before run 476 hung.
  - Its trace showed this exact failed syscall:

    ```text
    113550 1795117749.358165 execve("/tmp/.tmpY4LZdi/manager", ["/tmp/.tmpY4LZdi/manager"], ... /* 11 vars */) = -1 ETXTBSY (Text file busy)
    ```

  - The environment probe passed in this run.
  - The investigation runner was stopped during the hang, so it did not collect that attempt's exit status.
  - Its investigation-only timeout later stopped the traced test after 30 seconds.
  - A detailed-trace batch of an archived workspace-feature binary made 1,000 attempts.
  - It had 998 whole-binary passes, one environment-probe failure, and one cancellation hang at run 425.
  - The environment probe passed in run 425.
  - Its detailed trace showed this failed syscall:

    ```text
    141731 1795117872.376303 execve("/tmp/.tmpER5NEE/manager", ["/tmp/.tmpER5NEE/manager"], ... /* 11 vars */ <unfinished ...>
    141731 1795117872.376353 <... execve resumed>) = -1 ETXTBSY (Text file busy)
    ```

  - The same trace showed the FIFO read still pending until the investigation guard stopped the run with status 124.
  - The manager's writable open overlapped another test's clone of the `interpreter_probe` child.
  - The parent opened descriptor 12 at time `.374017`, and that other test entered `clone3` at `.374083`.
  - The parent closed descriptor 12 at `.374323`.
  - The interpreter child first attempted its exec at `.377556`, after the manager exec had failed at `.376353`.
  - Thus a sibling child could retain the fixture's inherited writer until its exec.
  - `O_CLOEXEC` closes a descriptor at exec, not at fork.
  - The product maps the failed spawn to `CommandUnavailable` and the worker returns without writing the FIFO.
  - Confirmed evidence names `ETXTBSY` for two hangs. It does not establish the first untraced run's cause.
  - A separate 1,000-run whole-binary baseline with debug information disabled passed every run.
  - This passing baseline does not remove the two traced fixture start failures.
  - Before the process-code merge, investigation counts included seven cancellation hangs across the before and after batches.
  - Four hangs have a traced manager exec failure with `ETXTBSY`.
  - The other three hangs have no trace of the manager start. Their exact start outcomes remain unknown.
  - The final unchanged workspace-feature baseline made 1,000 untraced attempts during actual workspace test execution.
  - It had 997 whole-binary passes, one environment-probe failure, one interpreter failure, and one cancellation hang at run 97.
  - The after-change detailed batch made 1,000 attempts, with 998 whole-binary passes and two cancellation hangs.
  - Its token probe passed in all 1,000 attempts.
  - Those two manager exec failures were:

    ```text
    313321 1795118518.230579 execve("/tmp/.tmphX8C90/manager", ["/tmp/.tmphX8C90/manager"], ... /* 11 vars */) = -1 ETXTBSY (Text file busy)
    336444 1795118572.007121 <... execve resumed>) = -1 ETXTBSY (Text file busy)
    ```

  - The matched after-change workspace-feature batch made 1,000 untraced attempts during workspace test execution.
  - It had 998 whole-binary passes, one interpreter failure, and one cancellation hang at run 560.
  - Its token probe passed in all 1,000 attempts.
  - These after batches changed only the token fixture setup. They left the cancellation test unchanged.
  - Together, untraced runs 520, 97, and 560 have unknown manager start outcomes.
  - After the bounded-stop and background-reaper changes merged from `main` at `c05a9d47b`, another 1,000 fixed whole-binary runs had 999 complete passes and one cancellation hang.
  - The environment-token probe passed all 1,000 attempts.
  - The manager fixture again failed to start with `ETXTBSY`, before the new reaper could start.
  - The test then waited on its FIFO before cancellation.
  - This raises the recorded total to eight hangs, with five traced `ETXTBSY` starts and three unknown start outcomes.
- **Problem:** A failed fixture start leaves the test waiting on the FIFO before it can inspect the worker result. Parallel child starts can inherit the fixture's writable descriptor and cause `ETXTBSY`.
- **Impact if no action:** A required Rust test can wait forever until an outside job guard stops it. The gate loses the fixture start error.
- **Root question:** How does the cancellation test start its shell tree without a writable executable shared with parallel process starts?
- **Options:**
  - **A.** Start the system `/bin/sh` directly and pass the fixture body through its arguments. Pass the FIFO path as a separate argument. Keep the real spawner, child tree, cancellation, and every assertion. This removes the temporary writable executable. Effort: Small.
  - **B.** Run the existing cancellation body in one selected child of the same test binary. Write the fixture only inside that isolated child. This adds one child process per test. Effort: Small.
  - **C.** Store a read-only executable fixture in the repository and pass the FIFO path as an argument. This adds a fixture file and its executable mode to maintain. Effort: Small.
- **Left out:**
  - A retry, sleep, repeat, skip, quarantine, or longer time limit hides the start defect and violates the testing rules.
  - One thread for the whole test binary changes runner configuration and names no fixture ownership rule.
  - Changing the product's process adapter cannot stop unrelated test child processes from inheriting a fixture writer.
  - Only surfacing the worker error can stop the silent hang, but it leaves the confirmed fixture start race.
  - Change nothing leaves the required test dependent on an outside job guard.
- **Wider fix:** A removes the writable executable from this test's setup. The other script fixtures need their own confirmed evidence before wider edits.
- **Previous examples:** The environment-token probe in the same file failed with `ETXTBSY` from an inherited fixture writer. Its fix moves fixture creation into its selected child test.
- **Related:**
  - [flaky-program-interpreter-probe.md](./flaky-program-interpreter-probe.md)
    records another failure in the same test file. Its source remains unknown.
  - The bounded stop in `crates/mokly-compare/src/process.rs` concerns
    surviving children that hold output pipes after a stop. This failure
    has no running manager and blocks before cancellation. The bounded
    stop does not settle it.
- **Recommendation:** A. It removes the writer race with one test setup change and keeps the tested cancellation behaviour.
- **Action:** fix after merge, apply A, because this separate test predates the probe fix and needs its own branch.

Assumptions: Keep the real process tree and all existing assertions, as the testing rules require. Keep default parallel test execution, as the existing test runner does.
