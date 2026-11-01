# Stabilize the hanging checkout filter test

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch
  `conductor/rust-rebuild-64-opaque-asset-digests`, which recorded a failure
  in the CI of PR #270.
- **Location:** `crates/mokly-git/tests/checkout_tests.rs:124`, with the
  assertion at line 145. The time limit of the Git runner is at
  `crates/mokly-git/src/system.rs:129`, and its signal and wait failure
  paths are at lines 132-147 and 162.
- **Reason:** The test failed once in the CI of PR #270, which did not
  change it, and the rerun of the same job passed.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Smudge filter:** a command that Git runs when it converts a committed
    file for checkout. The attributes of the commit select it.
  - **`FastClock`:** the test clock at
    `crates/mokly-git/tests/checkout_tests.rs:152`. Each pause of the
    runner advances it at once, with no real wait.
  - **`CheckoutTimeout`:** the error that the Git runner returns when a
    conversion process reaches its 120-second time limit.
- **Background:**
  - The test `a_hanging_checkout_filter_is_bounded` runs only on Unix. It
    sets the required smudge filter `sh -c 'sleep 60'` for `*.wait` files,
    commits `value.wait`, and reads that file from the commit.
  - The runner uses `FastClock`. Each loop step of the runner pauses for
    5 ms, so the 120-second limit passes after about 24,000 steps, with no
    real wait.
  - The test expects `Error::Conversion` with the source
    `Error::CheckoutTimeout`.
  - When the limit passes, the runner stops the process group and returns
    `CheckoutTimeout`, at `crates/mokly-git/src/system.rs:168`. When a signal
    to the group or a wait for the child fails, the runner returns that
    error instead, at lines 132-147 and 162.
  - Neither PR #270 nor the branch that recorded the failure changes the
    test, the runner, or `crates/mokly-platform`.
- **Problem:**
  - Failure: PR #270, CI run 41327522823, job "Native
    (blacksmith-6vcpu-macos-26)", attempt 1, at head `4b246644`, a merge
    commit of the branch `conductor/rust-rebuild-134-watch-event-loss`, on
    2026-11-01:
    https://github.com/mokly-ai/mokly/actions/runs/41327522823/job/124910641138.
  - Failure text:

    ```text
    thread 'a_hanging_checkout_filter_is_bounded' panicked at crates/mokly-git/tests/checkout_tests.rs:145:5:
    assertion failed: matches!(error, Error::Conversion { source, .. } if
        matches!(*source, Error::CheckoutTimeout))
    ```

  - Rerun outcome: attempt 2 of the same job on the same head passed:
    https://github.com/mokly-ai/mokly/actions/runs/41327522823/job/124912766467.
    The same macOS job passed on other heads of the branch
    `conductor/rust-rebuild-64-opaque-asset-digests`.
  - Suspected source, not confirmed by anyone:
    - On macOS, the filter process can end in another way before the fast
      clock reaches the limit, for example through a broken pipe or a
      signal. The read then returns another error.
    - Or a signal to the process group fails on macOS.
      `crates/mokly-platform/src/unix.rs:97-108` accepts a macOS `EPERM`
      only when no live member is left in the group. So a member that exits
      during the signal can turn the timeout into `Error::Platform`.
  - The assertion does not print the actual error, so the failed run does
    not show which error the read returned.
- **Impact if no action:** The native macOS suite can fail at random on a
  correct change. A real defect of the conversion time limit can hide behind
  a flake label.
- **Root question:** How does the test prove the time limit of a hanging
  checkout filter on every Unix runner, and how does a failure show its
  cause?
- **Options:**
  - **A.** Make the assertion print the actual error. Reproduce the failure
    by repeating the test on macOS, and name the source. Then make the
    timeout path deterministic, and keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again. Effort: Small.
  - **C.** If the reproduction shows that the runner returns another error
    after its time limit, add a failing test first. Then fix the runner or
    the platform code. Effort: Medium.
- **Left out:** A retry, a sleep, or a longer time limit. The `testing`
  skill forbids them, because they hide the source.
- **Wider fix:** None. The `testing` skill already requires a fake clock for
  timeout outcomes, and the fix is specific to this test.
- **Previous examples:**
  [flaky-postcss-context-release.md](./flaky-postcss-context-release.md)
  records another native test that failed once in CI and passed on the
  rerun. It has a different test and a different suspected source.
- **Recommendation:** A. The next run then names the actual error, and the
  reproduction can remove the race.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.
