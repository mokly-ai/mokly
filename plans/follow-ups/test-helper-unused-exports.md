# Check test helper trees for unused exports

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 109 (F18 decision 39): extend the unused internal
export check to the test helper trees. It is a stricter check, so it
needs the user. Covers finding 36. Previous examples: `ec52f856` and
`fe3624df`. Severity Low, effort Medium. Options: A, keep the current
scope, Small (estimate); B, check `tests/browser`, `tests/helpers`,
and `packages/viewer/tests`, and leave the catalogue fixtures out,
Medium. F20 removed all 47 unused exports, so B starts with no
baseline entries. Recommended: B.

## Decision

- **Source:** Review.
- **Category:** process.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly check test helper trees for unused exports?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Medium.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** B.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** B. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5953).
