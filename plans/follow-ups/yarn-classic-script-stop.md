# Stop Yarn Classic dependency scripts

- **Severity:** High. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

## Task

Resolve user item 150 (135 B review finding 42): Yarn Classic scripts
survive a stop. Yarn Classic 1.22.22 starts dependency scripts in a
new session on Linux and macOS, so the group signal misses them.
Severity High, product bug, effort Large. Options: A, document it,
effort not recorded; B, keep scripts off for Classic on Unix, with a
warning, effort not recorded; C, the platform process owner stops
every descendant, also in new sessions, Large. Recommended: C.

- Security: the hub recommends a decision before the first npm release.

## Decision

- **Source:** Review.
- **Category:** product bug.
- **Background:** The Task section preserves the completed plan's context, evidence, and recorded options.
- **Problem:** The completed plan left this item open.
- **Impact if no action:** The recorded defect, risk, or process gap remains until the user selects an option.
- **Root question:** How should Mokly stop Yarn Classic dependency scripts?
- **Options:**
  - **A.** Use option A from the Task section. Effort: Small.
  - **B.** Use option B from the Task section. Effort: Small.
  - **C.** Use option C from the Task section. Effort: Large.
- **Left out:** The completed plan found no third distinct implementation beyond the recorded direct and wider approaches.
- **Wider fix:** C.
- **Previous examples:** The completed plan record linked below.
- **Recommendation:** C. The Task section records this recommendation.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6109).
