# Name the slot owner consistently

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 161 (W2 decision 2): a slot line calls a screen
"this page". `packages/viewer/src/shell/workspace_props.tsx:163`
differs from the design's "Supplied by Welcome." in
`examples/basic/specs/design/components/parts/instance_details.tsx:81`.
Severity Low, effort not recorded. Options: A, keep it; B, name the
owner by its title, as the design does; C, a noun from the shared
entry wording, with a design first. Recommended: B.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6189).
