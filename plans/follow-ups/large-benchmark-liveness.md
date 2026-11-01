# Use progress as the large benchmark liveness signal

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 162, from the harness note of integration batch 25. Updated on
  2026-11-01 with the Changes wait, from an open item of the closed
  "perf: single pass render (follow on)" workspace. Narrowed on 2026-11-01
  to the Changes wait, after the branch
  `conductor/rust-rebuild-59-performance-follow-ups` fixed the build
  deadline.
- **Location:** `scripts/large/delivery.ts:114` and `:145`,
  `scripts/large/benchmark.ts:185`, and
  `tests/fixtures/large/README.md:96-97`.
- **Reason:** The Changes wait needs its own change and measurement runs of
  about five minutes each, so it follows the build deadline fix in a
  separate branch.

- **Source:** Design.
- **Category:** Test.
- **Terms:**
  - **Large benchmark:** the opt-in harness `npm run benchmark:large`, which
    measures build, Serve, Changes, and watch on the generated large
    fixture.
  - **Liveness deadline:** a time limit that stops a run that seems stuck.
    It is not a speed budget.
- **Background:**
  - Fixed on 2026-11-01: the build scenario's 300-second deadline is now a
    liveness window. Each complete line on standard output or standard
    error restarts it, in `scripts/large/build_liveness.ts`, and the build
    scenario builds and installs the release binary first. The coordinator
    chose this, option C, for the user on 2026-10-28. That answer covers the
    build deadline only.
  - The `changes` and `serve` scenarios wait at most 60 seconds for
    delivered Changes: `delivered` at `scripts/large/delivery.ts:114` and
    `changesVisible` at line 145. The browser default timeout of these
    scenarios is also 60 seconds, at `benchmark.ts:185`.
    `tests/fixtures/large/README.md:96-97` states "Browser operations allow
    60 seconds."
  - `docs/protocol/mokly-timings.md`, section Budgets, records
    `changesReadyMs` for each variant from the `serve` and `changes`
    scenarios. It sets no budget for it.
  - On 2026-10-26, Serve reached Changes ready on the large React fixture
    after about 617 seconds.
  - Measured on 2026-11-01 on an eight-CPU, 16 GiB machine with other heavy
    work idle: release build, default fixtures with 1,620 routes and 5,850
    documents, two sidecars.
    - `npm run benchmark:large -- --root {fixture} --scenario changes --sidecars 2 --memory-stop-kib 6291456`
      failed for both variants with
      `page.waitForFunction: Timeout 60000ms exceeded.` The React run
      failed in its cold pass. The HTML cold pass reached Changes ready
      63.8 seconds after the command start, and the warm pass failed.
    - The same Serve command and browser steps with a 30-minute wait
      reached Changes ready 305.5 seconds (React) and 66.6 seconds (HTML)
      after the command start.
    - Serve runs with `--debug-timings` in these scenarios. In those runs it
      wrote 343,455 (React) and 405,688 (HTML) output lines. Between the
      listening line and Changes ready, the longest time without a complete
      line was 3.3 seconds.
- **Problem:** A healthy Changes run passes the fixed 60-second wait on both
  default large fixtures, so the `changes` and `serve` scenarios fail
  before they record `changesReadyMs`.
- **Impact if no action:** The benchmark records no Changes measurement on
  the full-size fixtures, which the timings contract asks it to record.
- **Root question:** How does the benchmark tell a slow Changes run from a
  stuck one?
- **Options:**
  - **A.** Raise the Changes wait above the measured times, for example to
    30 minutes as the watch scenario does. Effort: Small.
  - **B.** Make the Changes wait a liveness limit that each Serve output
    line restarts, with the window of the build scenario's liveness helper.
    Effort: Medium (estimate).
- **Left out:** Remove the wait. It loses the detection of a stuck process.
  Fewer than three approaches exist, because the limit is either fixed or
  restarted by progress.
- **Wider fix:** B. A progress-based limit adapts to any catalogue size,
  and it decides no pass or fail by elapsed time.
- **Previous examples:** The build scenario's liveness window in
  `scripts/large/build_liveness.ts`. The watch scenario's 30-minute browser
  liveness allowance, stated in `tests/fixtures/large/README.md:97-100`.
- **Related:** [large-build-benchmark-overhead.md](large-build-benchmark-overhead.md)
  is about the time that the harness adds to a build. Both concern the same
  harness, but that item measures overhead and this item stops healthy
  runs.
- **Recommendation:** B. Serve already writes a line at least every few
  seconds, so the window that the build scenario uses tells slow progress
  from a stuck run.
- **Action:** fix after merge, apply B, because the change is Medium and
  needs measurement runs of its own. No condition of the decision test
  holds: B adds no gate and changes no protocol requirement, and the
  harness is an opt-in tool outside the product.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6197).
