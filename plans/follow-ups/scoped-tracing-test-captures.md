# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 196, the wider class of user item 193.
- **Location:** `crates/mokly-cli/src/_tests_/serve_trace_tests.rs:87`,
  `crates/mokly-graph/tests/routing_work_tests.rs:32`, and
  `crates/mokly-sidecar/src/_tests_/trace_capture.rs:15`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

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
- **Problem:** `serve_trace_tests.rs` and `routing_work_tests.rs` still
  capture spans with scoped subscribers and no guard. While parallel tests
  register and drop their subscribers, a thread without a capture can
  register a callsite first and cache `never`. The span then disappears
  from the capture.
- **Impact if no action:** Both tests can fail at random without a product
  change, as the sidecar test did.
- **Root question:** How should every span capture in the test suites see
  its spans while other tests run in parallel?
- **Options:**
  - **A.** Install the same once-per-process interest guard in both
    captures. Effort: Small (estimate).
  - **B.** Keep the scoped subscribers until one of the tests flakes.
    Effort: Small (estimate).
  - **C.** Move the trace capture and its guard into one shared test
    support crate that all three crates use. This adds a crate.
    Effort: Large (estimate).
- **Left out:** Running the suites one test at a time hides the shared
  state and slows verification.
- **Wider fix:** C. One shared capture gives every crate the guard. A
  removes the known cases at a smaller cost.
- **Previous examples:** The sidecar stop span loss above, fixed in
  `298ede89`. An earlier CI-gates run also saw zero stop spans in
  `cleanup_retirement_keeps_only_the_cause_after_active_or_idle_failure`.
- **Recommendation:** A. It applies the proven deterministic fix in a
  separate branch.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
