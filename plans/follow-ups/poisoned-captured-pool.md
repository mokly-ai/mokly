# Preserve failures after a CapturedPool mutex poison

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Follow-up (Low, not a user item): `CapturedPool` in
`crates/mokly-render/tests/integration/support.rs` unwraps its `calls`
mutex. A test that fails while it holds the lock poisons the mutex, and
a later unwrap then aborts the test binary and hides the failure
messages. Use the poisoned value.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6624).
