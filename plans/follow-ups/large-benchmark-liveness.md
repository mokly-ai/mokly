# Use progress as the large benchmark liveness signal

- **Severity:** Low. **Effort:** Medium (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 162, from the harness note of integration batch 25.
- **Location:** `scripts/large/benchmark.ts:68` and `:113`,
  `scripts/large/process.ts:90`, and `tests/fixtures/large/README.md:94`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Design.
- **Category:** Test.
- **Terms:**
  - **Large benchmark:** the opt-in harness `npm run benchmark:large`, which
    measures build, Serve, Changes, and watch on the generated large
    fixture.
  - **Liveness deadline:** a time limit that stops a run that seems stuck.
    It is not a speed budget.
- **Background:**
  - The build scenario waits at most 300 seconds by default:
    `buildDeadlineMs` defaults to `300_000` at `benchmark.ts:68` and `:113`.
    The listening wait uses the same value at `process.ts:90`.
    `tests/fixtures/large/README.md:94` states it.
  - Measured large fixture builds with `--strict --base` take 467 seconds
    for HTML and 921 seconds for React.
  - So `npm run benchmark:large -- --scenario build` stops at the deadline
    on the full-size fixture.
- **Problem:** A healthy build can pass the fixed deadline without being
  stuck.
- **Impact if no action:** The benchmark fails before it produces a build
  measurement on the full-size fixture.
- **Root question:** How does the benchmark tell a slow build from a stuck
  one?
- **Options:**
  - **A.** Raise the build scenario's deadline above the measured build
    times. Effort: Small.
  - **B.** Make the deadline a liveness limit that each progress line
    resets. Effort: Medium (estimate).
- **Left out:** Remove the deadline. It loses the detection of a stuck
  process. Fewer than three approaches exist, because the limit is either
  fixed or reset by progress.
- **Wider fix:** B. A progress-based limit adapts to any catalogue size,
  and it decides no pass or fail by elapsed time.
- **Previous examples:** The watch scenario already uses a separate
  30-minute browser liveness allowance, stated in
  `tests/fixtures/large/README.md:95-98`.
- **Related:** [large-build-benchmark-overhead.md](large-build-benchmark-overhead.md)
  is about the time that the harness adds to a build. Both concern the
  build scenario of the same harness, so one branch can handle both.
- **Recommendation:** B. It tells slow progress from a hung build.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6197).
