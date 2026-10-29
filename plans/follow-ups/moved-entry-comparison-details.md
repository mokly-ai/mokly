# Show comparison details for a pure move

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 136 (viewer-103c decision 1): a pure move's Details
deny its comparison. For an entry that Changes lists only as a move,
the Details end with the terminal line "No changes to this screen.",
while its band offers the comparison of the changed components that
its views use. Severity Low, effort Large. Options: A, keep the terminal
line, Small (estimate); B, for an entry that Changes lists only as a
move, show the shared-component sentence in a wording without "no
independent entry in Changes", which the 84 B rewording can supply,
and draw the design first, Large; C, leave out the terminal line when
a shown view uses a changed component, design first, Large
(estimate). Recommended: B.

- User decision 136 (2026-10-21): B, as work after the merge. The rebuild
  branch records this item as the line "User decision 103 follow-up for
  the user" under item 104. Keep one line when both reach the plan.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5785).
