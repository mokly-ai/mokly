# Show comparison details for a pure move

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The moved-entry Details design and viewer presentation.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** mockup.
- **Background:** A pure move can use changed shared components. Its band offers that component comparison.
- **Problem:** Details still ends with “No changes to this screen.” for the moved entry.
- **Impact if no action:** The page offers a comparison and denies it in the same state.
- **Root question:** How should Mokly show comparison details for a pure move?
- **Options:**
  - **A.** Keep the terminal line. Effort: Small.
  - **B.** Design and show shared-component wording for a pure move. Effort: Large.
  - **C.** Omit the terminal line when a shown view uses a changed component. Effort: Large.
- **Left out:** Changing copy without the required design skips the mockup rule.
- **Wider fix:** B. The design gives the state one affirmative explanation.
- **Previous examples:** Viewer decision 103 C opened this item for pure moves.
- **Recommendation:** B. It keeps Details and the comparison band consistent.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5785).
