# Test script opt-in for each package manager

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** test.
- **Background:** Mokly can opt in to dependency lifecycle scripts for npm, pnpm, Yarn Classic, and Yarn Berry.
- **Problem:** No end-to-end case proves the opt-in for each manager.
- **Impact if no action:** One manager can ignore the option or run the wrong command without a failing test.
- **Root question:** How should Mokly test script opt-in for each package manager?
- **Options:**
  - **A.** Assert only the generated manager commands. Effort: Small.
  - **B.** Add one end-to-end marker fixture for each package manager. Effort: Medium.
- **Left out:** One shared fixture cannot prove each manager's different script controls.
- **Wider fix:** B.
- **Previous examples:** The package-manager guard review requested marker fixtures for related safety flags.
- **Recommendation:** B. It proves the behavior at the process boundary.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6141).
