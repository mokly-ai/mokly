# Stabilize the PostCSS context release test

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #225 and its completed plan, which put the
  failure outside the scope of its review.
- **Location:** `crates/mokly-render/tests/integration/watch_lifetimes_tests.rs:13`,
  with the wait in `crates/mokly-render/tests/integration/process_counts.rs:59`.
- **Reason:** The test failed once in the CI of PR #225, which did not change
  it, and the next CI runs passed it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **PostCSS context:** one consumer PostCSS child process with its own
    plugin state. The render runtime starts it for a generation and stops it
    when the generation drops.
  - **`PostcssStop`:** the operation record that the test helper counts
    when a PostCSS context stops.
- **Background:**
  - The test `changed_class_maps_reuse_compiled_code_and_failed_candidates_release_once`
    starts at
    `crates/mokly-render/tests/integration/watch_lifetimes_tests.rs:13`. It
    runs real Node processes.
  - After the test drops the original generation, it waits until the
    process records hold the expected count of each operation. The wait in
    `crates/mokly-render/tests/integration/process_counts.rs:59` gives up
    after 30 seconds.
- **Problem:**
  - Failure: the test failed once on Windows in CI run 40674917367, during
    PR #225 on 2026-10-28.
  - Failure text: the 30-second wait saw no `PostcssStop` record after the
    test dropped the original generation. The exact panic text was not
    recorded.
  - Rerun outcome: the next full CI run passed it, and the CI of
    `origin/main` passed it.
  - Suspected source: the asynchronous PostCSS context release with real
    Node processes on a busy runner. Nobody confirmed it.
- **Impact if no action:** The native Windows suite can fail at random on a
  correct change. A real leak of a PostCSS context can hide behind a flake
  label.
- **Root question:** How does the test know that the PostCSS context has
  stopped, without a race against a busy runner?
- **Options:**
  - **A.** Reproduce the failure by repeating the test on Windows, and name
    the source. Then make the test wait for an explicit stop signal of the
    context instead of a polled count. Keep every assertion. Effort: Small.
  - **B.** Change nothing until the test fails again, and record the panic
    text then. Effort: Small.
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
- **Recommendation:** A. It removes the race and keeps every
  assertion.
- **Action:** ask the user, because the failure has not been reproduced with a
  confirmed cause. No fix is clearly best until reproduction identifies the
  source, as the flaky-test rule requires.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/parallel-background-pass.md?plain=1#L399).
