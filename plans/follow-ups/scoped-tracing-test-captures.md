# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 196, the wider class of user item 193.
- **Location:** `crates/mokly-cli/src/_tests_/serve_trace_tests.rs:87`,
  `crates/mokly-render/src/_tests_/stylesheet_trace_tests.rs:84`, and
  `crates/mokly-sidecar/src/_tests_/trace_capture.rs:15`.
- **Reason:** The Rust rebuild merged with this test risk open, and the shared
  capture adds a test support crate for three crates, so it needs a separate
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
- **Problem:** `serve_trace_tests.rs` and `stylesheet_trace_tests.rs` capture
  spans with scoped subscribers and no guard. PR #242 added
  `stylesheet_trace_tests.rs` on 2026-10-29. Both run in a test binary with
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
- **Impact if no action:** Both tests can fail at random without a product
  change, as the sidecar test did.
- **Root question:** How should every span capture in the test suites see
  its spans while other tests run in parallel?
- **Options:**
  - **A.** Install the same once-per-process interest guard in both
    captures. Effort: Small.
  - **B.** Keep the scoped subscribers until one of the tests flakes.
    Effort: Small.
  - **C.** Move the trace capture and its guard into one shared test
    support crate that all three crates use. This adds a crate.
    Effort: Large.
- **Left out:** Running the suites one test at a time hides the shared
  state and slows verification.
- **Wider fix:** C. One shared capture gives every crate the guard. A
  removes the known cases at a smaller cost.
- **Previous examples:** The sidecar stop span loss above, fixed in
  `298ede89`. An earlier CI-gates run also saw zero stop spans in
  `cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure`.
- **Recommendation:** C. One shared capture owns the existing interest guard for
  all three crates. Its wider migration affects effort, not approval.
- **Action:** fix after merge, apply C, because the shared capture changes only
  the test support of three crates, and it adds no gate.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
