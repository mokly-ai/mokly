# Checkout deadline test failed with OS error 22

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from the second complete gate of
  `calummoore/mokly-comparison-reuse-1see` at `effc33400`, which does not
  change `mokly-git` or `mokly-platform`.
- **Location:** `crates/mokly-git/tests/checkout_deadline_tests.rs:84-114`,
  `crates/mokly-git/src/system.rs:68-83` and `:137`,
  `crates/mokly-git/src/cancellation.rs:10-24`,
  `crates/mokly-platform/src/processes.rs:34-55`,
  `crates/mokly-platform/src/unix.rs:85-118`,
  `crates/mokly-platform/src/unix_process_tree/group.rs:143-170`, and
  `crates/mokly-platform/src/error.rs:38-62`.
- **Reason:** The test failed once without a change to its code, and it
  passed in a focused rerun, so its cause is unknown and a later branch
  investigates it.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Batch conversion:** one Git process that converts many checkout files
    through their filters, which falls back to one process for each file
    after a failure.
  - **Process-tree guard:** the `mokly-platform` handle that `attach` returns
    for a started Git process, which signals the whole process tree at a
    stop.
  - **Hang clock:** the test clock `HangClock`, which jumps past the
    conversion deadline once for each hang that the test filter logs.
- **Background:**
  - The test `a_batch_stopped_by_a_real_deadline_converts_each_file_alone`
    is Unix only. It makes a repository whose `b.txt` filter hangs once. Then
    it reads `a.txt`, `b.txt`, and `c.txt` through `read_many`, which uses a
    batch conversion. The hang clock ends the hang at once, so the batch
    reaches its deadline and each file converts alone.
  - It expects the three file contents from `read_many` at line 96, and one
    logged hang. Then it extracts the commit, expects the three files and two
    hangs, and expects no conversion warning.
  - The failure, from the second complete gate at `effc33400`:
    - The gate stopped in the Rust suite after 343.618 s, before the browser
      suites.
    - The test panicked at
      `crates/mokly-git/tests/checkout_deadline_tests.rs:96:14` with:

      ```text
      called `Result::unwrap()` on an `Err` value: Platform { source: Internal(Io { source: Os { code: 22, kind: InvalidInput, message: "Invalid argument" } }) }
      ```

    - The run then printed:

      ```text
      test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.25s
      [xtask/command] `cargo test --workspace` failed with status 101
      ```

    - The companion test of the file,
      `a_filter_that_always_hangs_waits_for_two_deadlines_in_an_extraction`,
      passed in the same run.
  - A focused rerun passed 1 of 1, with no skip and exit 0:

    ```bash
    cargo test -p mokly-git --test checkout_deadline_tests a_batch_stopped_by_a_real_deadline_converts_each_file_alone -- --exact --nocapture
    ```

  - The test also passed in the first complete gate of the same branch, at
    `f6eb7e0f8`.
  - The branch changes no file of `crates/mokly-git` or
    `crates/mokly-platform` against `main`, and no code, test, assertion, or
    timeout of this test.
  - Suspected boundary, from code reading only, and not proven:
    - The Git runner maps a `mokly-platform` error to `Error::Platform` in
      three places. They are `configure` before the spawn at `system.rs:73`,
      `attach` after the spawn at `system.rs:81`, and the stop signal of a
      deadline or a cancellation at `cancellation.rs:23`, which
      `system.rs:137` calls.
    - On Unix, `SystemProcessGroups::configure` and `configure_plain` always
      return `Ok`. So this error came from `attach` or from a stop signal of
      the process-tree guard.
    - This test reaches a real deadline, so its stop signals run. Every Git
      command of the test also runs `attach`.
    - The kill calls in `crates/mokly-git/src/pipes.rs` ignore their results,
      so they cannot give this error.
    - The error keeps no call site. Nobody knows which platform call returned
      OS error 22, or why.
  - On 2026-11-18, the user replaced a third uninterrupted gate with
    evidence for each suite, a static delivery run, and then a complete
    final CI run. A SIGINT stopped the early third gate on the clean
    `effc33400` tree with exit 130, during its repository checks, before
    the Rust suite. So this test did not run again in a complete gate.
  - The evidence of this item is therefore two facts: the failure of this
    unchanged test in the second gate, and its exact focused rerun, which
    passed 1 of 1.
- **Problem:** The test failed once with a platform error, and it passed in
  a focused rerun and in an earlier complete gate. The error does not name
  the platform call that failed, so its cause is unknown.
- **Impact if no action:** A complete gate can stop in the Rust suite on
  this test without a product change, and the next failure again shows no
  cause.
- **Root question:** How can a platform error in the checkout deadline test
  name its cause, so that a later branch can fix it?
- **Options:**
  - **A.** Change nothing, and wait for the next failure. Effort: Small.
  - **B.** Keep the call site of each platform IO error. For example,
    `IoResult::platform` is already `#[track_caller]`, so it could store the
    caller location in `InternalError::Io`. Show the location in the `Debug`
    output only, so the user-facing text stays the same. The next failure
    then names the platform call. Effort: Small.
  - **C.** B, then run the test in a loop under load, as in a complete gate,
    until it fails again. Fix the cause that the kept call site names, under
    the deterministic-test rules. Effort: Medium.
- **Left out:**
  - A retry, a sleep, or a longer timeout. The deterministic-test rules rule
    them out.
  - Skipping or ignoring the test. It weakens a gate check, and only the
    user can approve that.
  - A fix for a guessed system call or race. No kept evidence names the
    cause.
- **Wider fix:** B. Every platform IO error then names its call site, not
  only the error of this test.
- **Previous examples:** None found with this error.
- **Recommendation:** B. The next failure then names the platform call, and
  no cause can be found without that.
- **Action:** fix after merge, apply B, because the failure is outside the
  reuse diff, and a later branch must keep the call site before it can find
  the cause.
