# Make tracing captures safe in parallel tests

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-cli/src/_tests_/serve_trace_tests.rs` and `crates/mokly-graph/tests/routing_work_tests.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** Two Rust tests capture spans with scoped subscribers. Parallel tests can register and drop subscribers in the same process.
- **Problem:** A span callsite can cache disabled interest and disappear from a capture.
- **Impact if no action:** The tests can fail intermittently without a product regression.
- **Root question:** How should Mokly make tracing captures safe in parallel tests?
- **Options:**
  - **A.** Install the same once-per-process interest guard used by the sidecar trace tests. Effort: Small.
  - **B.** Keep the scoped subscribers until either test flakes. Effort: Small.
- **Left out:** Serializing the full test suites hides the shared-state defect and slows verification.
- **Wider fix:** A. One global interest guard removes the callsite registration race.
- **Previous examples:** User item 193 fixed the same class in sidecar trace capture.
- **Recommendation:** A. It applies the proven deterministic fix.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6531).
