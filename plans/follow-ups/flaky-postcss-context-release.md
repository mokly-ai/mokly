# Stabilize the PostCSS context release test

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #225 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `crates/mokly-render/tests/integration/watch_lifetimes_tests.rs:13`,
  with the wait in `crates/mokly-render/tests/integration/process_counts.rs:59`.
- **Reason:** On 2026-11-03 the user chose option A, a reproduction on
  Windows before the fix, and asked for it in a later branch. On
  2026-11-18, 100 isolated Windows repetitions passed, and a CI audit found
  no later failure. The source remains unknown, so the Work list requires
  another user decision before a code change.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own
    plugin state. The render runtime starts it for a generation and stops it
    when the generation drops.
  - **`PostcssStop`:** the operation record that the test helper counts
    when a PostCSS context stops.
  - **Windows native job:** the job `Native (windows-2025)` of
    `.github/workflows/ci.yml`, on GitHub-hosted `windows-2025`. Its step
    `Run native verification` runs the Rust tests of the workspace. The
    original failure, the reproduction, and the run of option D below ran on
    the earlier runner, `blacksmith-8vcpu-windows-2025`.
  - **`CapturedPool`:** the integration test wrapper in
    `crates/mokly-render/tests/integration/support.rs` that records sidecar
    calls before it forwards them.
- **Background:**
  - The test `changed_class_maps_reuse_compiled_code_and_failed_candidates_release_once`
    starts at
    `crates/mokly-render/tests/integration/watch_lifetimes_tests.rs:13`. It
    runs real Node processes.
  - After the test drops the original generation, it waits until the
    process records hold the expected count of each operation. The wait in
    `crates/mokly-render/tests/integration/process_counts.rs:59` gives up
    after 30 seconds.
  - On 2026-11-03 the user chose option A.
- **Problem:**
  - Failure: the test failed once in a Windows native job, in attempt 1 of
    CI run 40674917367, during PR #225, at commit
    `07ce397d57d51aaef339062d4c84376f0e889d41`. The panic came at
    2026-10-28T10:59:01.7714771Z, in
    [job 122770867358](https://github.com/mokly-ai/mokly/actions/runs/40674917367/job/122770867358).
    The `integration_tests` binary of `mokly-render` reported 80 passed and
    1 failed in 51.82 seconds.
  - Failure text: the 30-second wait saw no `PostcssStop` record after the
    test dropped the original generation. On 2026-11-18, the original log
    confirmed ``assertion `left == right` failed``, with the observed
    `left: 0` and the expected `right: 1`, at `process_counts.rs:68:9`.
  - Rerun outcome: attempt 2 of run 40674917367 was cancelled before this
    test gave a result, so it is not a passing rerun. The next CI run of
    PR #225, run 40680216662 on a later commit, passed the test on
    2026-10-28. The CI of `origin/main` passed it too.
  - Suspected source: the asynchronous PostCSS context release with real
    Node processes on a busy runner. Nobody confirmed it.
  - Reproduction on 2026-11-18: 100 of 100 isolated repetitions passed on
    `blacksmith-8vcpu-windows-2025`, with Node 22.15.0 and Rust 1.95.0.
    [CI run 44317218307](https://github.com/mokly-ai/mokly/actions/runs/44317218307)
    passed at temporary commit `3469453aa0e9bd344f6b494ee705e754fc5e6615`.
    Each repetition ran exactly one test. None failed or skipped. These
    isolated passes do not rule out a failure under full suite load.
  - The current helper uses a condition variable that receives operation
    notifications. The investigation found no confirmed lost notification.
  - CI audit of Windows native jobs, in the UTC range from
    2026-10-28T00:00:00Z to 2026-11-18T14:07:52Z, both ends included:
    - The range holds 411 runs of `.github/workflows/ci.yml`, with 441 run
      attempts. In those attempts, 413 Windows native jobs ran: 360
      succeeded, 16 failed, and 37 were cancelled. None timed out or was
      still running.
    - Each counted job has its own job ID, so a rerun attempt adds a
      separate job, and no job counts twice. Attempt 2 of the original run
      is one of the 37 cancelled jobs.
    - The count leaves out 12 cancelled jobs with no executed step, and one
      job that started after the range.
    - Of the 413 jobs, 412 were normal full-native jobs. The other job is the
      isolated reproduction above. It counts as one job, not as 100.
    - Not every counted job ran this test. Only 397 full-suite jobs reached
      `Run native verification`. The other 15 were cancelled before that
      step.
    - The audit read the logs of all 16 failed and all 37 cancelled jobs.
      In the failed jobs, the test failed in one, passed in 13, and gave no
      result in two whose native build failed. In the cancelled jobs, it
      passed in two and gave no result in 35. The audit did not count
      individual test passes in successful jobs.
    - Result: the original failure is the only confirmed failure of this
      test. The audit found no later failure of it. The counts are a fixed
      snapshot. They give no failure rate, and CI after the range is
      outside them.
- **Impact if no action:** The native Windows suite can fail at random on a
  correct change. A real leak of a PostCSS context can hide behind a flake
  label.
- **Root question:** What work should follow the unreproduced Windows
  PostCSS context release failure?
- **Options:**
  - **A.** Reproduce the failure by repeating the test on Windows, and name
    the source. Then make the test wait for an explicit stop signal of the
    context instead of an operation count. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the panic
    text then. Effort: Small.
  - **D.** Repeat the whole `integration_tests` binary of `mokly-render` on
    the Windows runner, for example 20 times, with normal test parallelism.
    Use no test name filter, and stop at the first failure. The test then
    runs under the suite load of the original failure, which the isolated
    repetitions left out. A temporary workflow commit runs the experiment,
    and no product or test code changes. On 2026-11-18, one run of this
    binary passed 102 tests in 58.53 seconds, in
    [job 134848902890](https://github.com/mokly-ai/mokly/actions/runs/44317917693/job/134848902890).
    At that rate, 20 runs take about 20 minutes, plus setup and build.
    Effort: Small.
  - **E.** Add failure details to the existing test, then wait for another
    failure, as B says. In `process_counts.rs`, report the operation records
    for each process and the process start count. In this test, also report
    the context release calls that `CapturedPool` in `support.rs` records.
    Keep the 30-second wait and every assertion. This test-only change can
    narrow a later investigation, but it does not fix the failure or prove
    its source. Effort: Small.
  - **C.** If the reproduction shows that a context can stay alive after its
    generation drops, add a failing test first. Then fix the release in the
    render runtime. Effort: Medium.
- **Left out:** A longer wait, a retry, or a sleep. The
  `testing` skill forbids them, because they hide the source.
- **Wider fix:** None. The `testing` skill already requires an
  explicit readiness signal, and the fix is specific to this release path.
- **Previous examples:** PR #222 fixed another Windows-only failure of a
  timing-layer test on 2026-10-28. Its cache mock was released on another
  thread. That failure had a different cause.
- **Recommendation:** B. Keep the test unchanged until another failure
  gives evidence of the source. The basis is that 100 isolated Windows
  repetitions passed, and the audit found no later failure in Windows
  native jobs. This basis does not show that the cause is fixed, because
  the source is still unknown. The user chose A on 2026-11-03, but its
  required Windows reproduction did not fail on 2026-11-18.
- **Action:** ask the user, because the Work list requires another
  decision when Windows repetitions do not fail. The source remains
  unknown.
- **Work:**
  - Repeat the test on Windows until it fails, and record the pass counts
    under `.context/`, as the flaky-test rule of the `testing` skill says.
  - Name the source. When it is in the render runtime, the flaky-test rule
    makes it a product bug: add a failing test first, then fix the release,
    as option C says.
  - When the repeats do not reproduce the failure, record the run count and
    the runner in this item, and ask the user again. Change no code.
  - Delete this item in the branch that fixes the test.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L399).
