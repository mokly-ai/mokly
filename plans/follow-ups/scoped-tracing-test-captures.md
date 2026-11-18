# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 196, the wider class of user item 193.
- **Location:** `crates/mokly-cli/src/_tests_/serve_trace_tests.rs:87`,
  `crates/mokly-render/src/_tests_/stylesheet_trace_tests.rs:84`,
  `crates/mokly-compare/src/_tests_/scheduling/trace_tests.rs:82` and line 86,
  and `crates/mokly-sidecar/src/_tests_/trace_capture.rs:15`.
- **Reason:** The Rust rebuild merged with this test risk open, and the shared
  capture adds a test support crate for several crates, so it needs a separate
  branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Scoped subscriber:** a `tracing` subscriber that a test installs for
    one closure with `tracing::subscriber::with_default`.
  - **Callsite interest:** the cached answer of `tracing-core` that says
    whether a span callsite is enabled. The first thread that registers the
    callsite sets it.
- **Background:** The span captures of the Rust tests work as follows.
  - Some Rust tests capture spans to check their fields.
  - `crates/mokly-sidecar/src/_tests_/trace_capture.rs` installs one global
    `InterestGuard` dispatcher, once for each test process.
  - The guard enables nothing, but it keeps every callsite's interest at
    `sometimes`, so each span asks the dispatcher of its own thread.
  - A user decision of 2026-10-25 added that guard in `298ede89`.
  - Before it, a test in
    `crates/mokly-sidecar/src/_tests_/pool_release_timing_tests.rs` sometimes
    recorded no `sidecar.stop` span. That happened in a Linux integration run,
    and on hosted macOS in PR #200 run 40194214551, attempts 1 and 2.
  - `crates/mokly-graph/tests/routing_work_tests.rs` also captures spans.
    It is an integration test binary with one test, so its own process
    isolates its callsites, as its module comment says.
- **Problem:** `serve_trace_tests.rs`, `stylesheet_trace_tests.rs`, and
  `crates/mokly-compare/src/_tests_/scheduling/trace_tests.rs` capture spans
  with scoped subscribers and no guard. PR #242 added
  `stylesheet_trace_tests.rs` on 2026-10-29. Each runs in a test binary with
  many other tests. While parallel tests
  register and drop their subscribers, a thread without a capture can
  register a callsite first and cache `never`. The span then disappears
  from the capture. The first recorded failure of
  `stylesheet_trace_tests.rs` matches this cause:
  - On 2026-11-01 the test
    `stylesheet_cache::stylesheet_trace_tests::finding_4_real_bundles_report_each_miss_reason_and_hits_are_silent`
    failed in the CI job "Native (blacksmith-8vcpu-windows-2025)".
  - The job ran for pull request #265, in run 41329654962 and job
    124916923950, at the head `6cfc3ae1`.
  - The failure text, at
    `crates/mokly-render/src/_tests_/stylesheet_trace_tests.rs:103`, is:

    ```text
    assertion `left == right` failed
      left: []
     right: [Some("no-record")]
    ```

  - The capture saw no span. That pull request changes no file under
    `crates/mokly-render/`.
  - The same test passed in the Native Windows job on the head before,
    `90c383d6`. It also passed in the remote complete gate on `6cfc3ae1`.
  - The rerun of the job was cancelled, because a newer head of the pull
    request started its own CI run.
  - The confidence is High since 2026-11-01, because this log shows the
    problem.
  - On 2026-11-18 a later failure matched the same cause. The same test
    failed in a local Linux run of the complete gate, `cargo xtask check`,
    with the same text at the same line. The run was on the branch
    `calummoore/mokly-sidecar-generation-affinity-jmbb`, which changes no file
    under `crates/mokly-render/`. The `mokly-render` library tests gave 97
    passes and 1 failure. An earlier `cargo xtask check --suite repository` on
    that branch passed all 2545 Rust tests, this test included. One isolated
    rerun passed 1 of 1, with 97 filtered out and exit code 0:
    `cargo test -p mokly-render --lib stylesheet_cache::stylesheet_trace_tests::finding_4_real_bundles_report_each_miss_reason_and_hits_are_silent -- --exact --nocapture`.
  - Another recorded failure, in another capture without a guard, has the
    same symptom. Its cause is suspected, not proven:
    - On 2026-11-18 the test
      `scheduling_tests::trace_tests::closure_failure_marks_the_resource_graph_span_as_error_under_comparison`
      failed in the Windows job of CI run 44250631581, job 134620201655, in
      the step "Run native verification".
    - The job ran for pull request #314, at the head
      `4f41780f35add971b211f36211f59d7c1de75934`. `main` was at
      `24b238ca400e949684267636fff39785ddded399`, and the head was not behind
      it.
    - The failure text, at
      `crates/mokly-compare/src/_tests_/scheduling/trace_tests.rs:86`, is:

      ```text
      assertion `left == right` failed
        left: []
       right: [["review.compare-views", "review.resource-graph"]]
      ```

    - The crate result was 257 passed, 1 failed, and 0 ignored.
    - The capture saw no ERROR event. It installs its subscriber with
      `with_default`, records the entered spans of each thread, and has no
      interest guard. That pull request changes no file under
      `crates/mokly-compare/`.
    - The local complete gate passed on `2c46ed670`, and the local repository
      suite passed on `c0a72c7ae`, for the same pull request.
    - The job log is
      [CI job 134620201655](https://github.com/mokly-ai/mokly/actions/runs/44250631581/job/134620201655).
    - The suspected source is the callsite interest race above. Nobody has
      proved it for this failure.
    - The full CI run of the next head of pull request #314, which commits
      this record, counts as the one permitted Windows retest. Its outcome is
      pending.
- **Impact if no action:** These tests can fail at random without a product
  change, as the sidecar test did.
- **Root question:** How should every span capture in the test suites see
  its spans while other tests run in parallel?
- **Options:**
  - **A.** Install the same once-per-process interest guard in each
    capture that has no guard. Effort: Small.
  - **B.** Keep the scoped subscribers until one of the tests flakes.
    Effort: Small.
  - **C.** Move the trace capture and its guard into one shared test
    support crate that every crate with a span capture uses. This adds a
    crate. Effort: Large.
- **Left out:** Running the suites one test at a time hides the shared
  state and slows verification.
- **Wider fix:** C. One shared capture gives every crate the guard. A
  removes the known cases at a smaller cost.
- **Previous examples:** The sidecar stop span loss above, fixed in
  `298ede89`. An earlier CI-gates run also saw zero stop spans in
  `cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure`.
- **Recommendation:** C. One shared capture owns the existing interest guard for
  every crate with a span capture. Its wider migration affects effort, not
  approval.
- **Action:** fix after merge, apply C, because the shared capture changes only
  test support code, and it adds no gate.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
