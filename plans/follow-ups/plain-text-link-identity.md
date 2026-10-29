# Separate plain-text link existence from content identity

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Possible later change (decision work review finding 2, option C): key
every plain-text link target only by whether it exists, which also
removes the `plans/` special case. Preparation must then decide which
targets are resources, and a missed target would stop an edited asset
from changing its document key. Not decided.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5543).
