# Name the slot owner consistently

- **Severity:** Low. **Effort:** Small.
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

## Decision

- **Source:** Review.
- **Category:** UX wording.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly name the slot owner consistently?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
  - **C.** Use option C from the Task section. Effort: Large.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** C.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6189).
