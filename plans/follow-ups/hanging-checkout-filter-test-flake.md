# Hanging checkout filter test flakes on macOS

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from branch `calummoore/ci-speed-fix-rust-flaky-tests-3snr`, flake analysis.
- **Location:** `crates/mokly-git/tests/checkout_tests.rs:145-166`, `crates/mokly-git/src/system.rs:159-198`, and `crates/mokly-git/src/checkout_output.rs:153-169`.
- **Reason:** The failure happened once, the log does not show the actual error, and the flaky-test branch could not reproduce it on Linux.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Checkout filter:** a Git clean or smudge filter that Mokly runs when it checks out a base commit. Mokly stops a filter that runs longer than `FILTER_TIMEOUT` (120 seconds).
- **Background:**
  - `a_hanging_checkout_filter_is_bounded` checks that a filter that never ends gives `Error::Conversion` with the source `Error::CheckoutTimeout`.
  - Its `FastClock` adds 5 ms on each `pause` and never waits. So the 120 second timeout and the 1 second grace period of the shutdown pass in microseconds of real time.
  - The test failed once, on `Native (macos-26)` in run 45443894288, attempt 1: `assertion failed: matches!(error, Error::Conversion { source, .. } if matches!(*source, Error::CheckoutTimeout))` at `checkout_tests.rs:145`. A rerun passed.
- **Problem:** The suspected source is a race. `terminate()` can reach the process tree while it still starts, and `kill()` while it still exits. If either call returns an error, `system.rs:159-164` stores it and `system.rs:192-193` returns `Error::Platform` before the `CheckoutTimeout` branch at `system.rs:196-198`. `conversion()` does not wrap `Platform`, so the assertion fails. Possible macOS error sources are an `info()` read during exit and a `killpg` EPERM while a member is not yet a zombie.
- **Impact if no action:** The test can fail again in rare CI runs.
- **Root question:** How does the test pass the filter deadline only after the filter runs, and what error did the failed run see?
- **Options:**
  - **A.** Print `{error:?}` in the assertion message, so the next failure names the error. Effort: Small.
  - **B.** Make the clock event-driven, as `HangClock` in `crates/mokly-git/tests/checkout_deadline_tests.rs:28-42` does: the filter writes a readiness line, and the clock passes the deadline only after that line exists. Keep the assertion. Effort: Small.
  - **C.** Also check the macOS process-tree calls for exit-transition errors, as the Linux process table now treats a reaped process as gone. Effort: Medium.
- **Left out:** A retry or a longer limit, because the testing rules forbid them.
- **Wider fix:** C. The process tree then treats each exit-transition error as a gone process on every platform.
- **Previous examples:** `owned_process_group_terminates_descendants_and_closes_pipes` failed from the same class of race on Linux. The flaky-test branch fixed it in `crates/mokly-platform/src/unix_process_table/linux.rs`.
- **Recommendation:** B. It removes the race in the test, and A confirms the cause if it fails again.
- **Action:** fix after merge, apply B, because the cause is not confirmed and the branch could not reproduce it.
