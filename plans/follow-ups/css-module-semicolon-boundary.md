# Align the CSS Modules semicolon boundary

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Follow-up (Low, from finding 2 of the `rebuild/port-111c` review): in a
rule list, the CSS Modules section reader ends a statement at `;`, but
cssparser ends a style rule or a keyframe only at its `{}` block. The
protocol page records the boundary. Aligning it, option B of the
finding, changes diagnostics and touches user item 113.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6652).
