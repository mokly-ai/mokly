# Add source offset maps for template diagnostics

- **Severity:** Low. **Effort:** Large.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Source offset maps for diagnostics (wider fix of round 1 finding 1 and
round 2 finding 1). Give each text token and attribute value a map
from value offsets to source offsets, so that every `{{...}}` failure
points at its own characters. Severity Low, effort Large, category
product bug. It also covers the attribute value and character
reference locations of the outside-scope lines around it. Options: A,
keep the targeted span fixes, Small; B, the offset maps, Large.
Recommended: B. No option is applied.

- User decision (2026-10-28): C, the offset maps on a separate branch
  after this branch merges. Open follow-up.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5569).
