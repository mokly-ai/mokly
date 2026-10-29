# Remove parser mechanics from the HTML screens protocol

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `docs/protocol/mokly-html-screens.md`.
- **Reason:** The review found this problem outside the change that it reviewed.

The sentence “One parser and one renderer serve both” describes implementation mechanics, not observable behavior. Move or remove it.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5619).
