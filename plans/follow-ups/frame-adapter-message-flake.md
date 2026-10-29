# Wait for the frame adapter navigation message

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `tests/browser/frame_adapter_navigation.spec.ts`.
- **Reason:** The review found this problem outside the change that it reviewed.

The posted-message assertion returned no navigation event once and passed unchanged on rerun. Wait for the message event without removing assertions.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4696).
