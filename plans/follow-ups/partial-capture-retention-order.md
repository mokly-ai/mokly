# Define partial capture retention order

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 99 (collector review finding 2): partial capture can
drop an earlier view. The growing summary charge means that a later
view can stay while an earlier view that fits falls back to its
source. Output bytes do not change. Only the number of views that
render again when memory is tight changes. The docs do not define
which views a partial capture keeps. Severity Low, effort Small.
Options: A, record the rule and the default, which the collector
decision under the large fixture TODO now does, Small; B, make route
order strict, so that no later view stays after the first skip or
trim, which is simple to state and test but can keep fewer views,
Small (estimate); C, restore the old rule: apply it again when the
final capacity is known and render each dropped view that now fits,
Medium. Recommended: A.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5892).
