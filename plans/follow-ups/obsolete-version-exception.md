# Remove the obsolete shared-version exception

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 197 (Low, process; open): the shared-version
check in `scripts/release/versions.mjs` still accepts CLI 0.15.0 with
viewer 0.6.0, the pair before the lockstep migration. No release can
return to that pair after 0.16.0. Options (estimate): A remove the
exception, so that the check requires one shared version (Small); B
keep it. Recommended: A. Removal needs the user's approval, because
the check is release functionality.

## Decision

- **Source:** Design.
- **Category:** process.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly remove the obsolete shared-version exception?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** A.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6540).
