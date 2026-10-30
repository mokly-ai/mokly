# Preserve failures after a CapturedPool mutex poison

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: a follow-up line outside the user items.
- **Location:** `crates/mokly-render/tests/integration/support.rs:48`.
- **Reason:** The rebuild recorded this test-support defect in its post-merge
  list, and no user decision approves a fix.

- **Source:** Review.
- **Category:** Test (estimate).
- **Terms:**
  - **`CapturedPool`:** the test double in
    `crates/mokly-render/tests/integration/support.rs` that records every
    sidecar call in a `calls` mutex before it forwards the call.
  - **Poisoned mutex:** a standard library mutex whose holder panicked.
    Each later `lock()` returns an error that holds the data.
- **Background:** The render integration tests wrap a real sidecar pool in
  `CapturedPool`. Its `release_generation`, `release_context`, and
  `request` methods call `self.calls.lock().unwrap()` before they forward
  the call. Those methods also run while a failed test unwinds, for example
  when a generation is released on drop.
- **Problem:** A test that fails while it holds the `calls` lock poisons
  the mutex. A later `unwrap` then panics during the unwinding, so the test
  binary aborts and the original failure messages are lost.
- **Impact if no action:** A failing render integration test can end with
  an abort instead of its assertion message, which slows the diagnosis.
- **Root question:** How should the render test doubles keep their
  recorded calls usable after a test panics?
- **Options:**
  - **A.** Use the poisoned value in the `CapturedPool` methods:
    `lock().unwrap_or_else(PoisonError::into_inner)`. Effort: Small (estimate).
  - **B.** Add one poison-tolerant lock helper to the render test support,
    and use it at every lock of recorded calls in the render tests.
    Effort: Small (estimate).
  - **C.** Use a lock type that cannot poison, such as `parking_lot::Mutex`.
    This adds a dependency. Effort: Large (estimate).
- **Left out:** Catching the panic in each test hides the failure that the
  test must report.
- **Wider fix:** B. One helper gives every recorded-call lock the same
  poison handling.
- **Previous examples:** `crates/mokly-cli/tests/serve_js/support.rs:237`
  already reads its log lines with `unwrap_or_else(|error| error.into_inner())`
  in a `Drop` implementation.
- **Recommendation:** B. (estimate) It applies the recorded fix, use the
  poisoned value, at every lock of the same kind. A is the smallest change.
- **Action:** ask the user, because condition 6 holds: the review-fix rule
  does not let an agent make a test-support change without the user. The
  rebuild's note that this was not a user item approves no fix.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6624).
