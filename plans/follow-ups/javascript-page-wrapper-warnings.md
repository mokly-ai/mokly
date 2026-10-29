# Report JavaScript page wrapper attribute warnings

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 138 (F22 decision): JavaScript page wrappers get no
attribute warning. Unknown attributes on ignore wrappers that a
`renderPage` callback returns are removed without the
`html-ignore-attribute` warning, because the sidecar contract has no
warning transport for callback HTML. Severity Medium, effort Large.
Options: A, add warning transport to the sidecar render record and one
`html-ignore-attribute` warning per page callback body and attribute,
Large; B, keep callback HTML warning-free and limit the warning to
authored bodies, Small (estimate). Recommended: A. The F22 branch
records this item as "Item 131", and integration batch 20 renumbers
that line to 138. Keep one line when both reach the plan.

- User decision 138 (2026-10-21): A, as work after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5800).
