# Keep delegated commits buildable

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 130 (F21 review finding 7): intermediate delegate
commits that do not build. `mokly-catalogue` does not compile from
`06742270` to `c7260846` on `rebuild/followups-f21`. One test expects
the wrong position until `b1cc2dd6`, and two commit messages
misdescribe their change. Severity Low, process, effort Small.
Options: A, keep the history and record the range in the plan,
Small; B, rewrite the branch so that every commit builds, effort not
recorded; C, add a per-commit build step to delegate briefs, effort
not recorded. Recommended: A. C best protects later branches.

## Decision

- **Source:** Review.
- **Category:** process.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly keep delegated commits buildable?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **C.** Use option C from the Task section. Effort: Medium.
- **Left out:** Option B rewrites already merged history. It cannot protect later delegated work.
- **Wider fix:** C.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** A. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6043).
