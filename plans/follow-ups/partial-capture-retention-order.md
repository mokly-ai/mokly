# Define partial capture retention order

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The bounded static capture collector.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** A bounded capture can keep some rendered views and render the rest again. Summary charges grow as views arrive.
- **Problem:** A later view can stay while an earlier fitting view falls back to source. The docs do not define retention order.
- **Impact if no action:** Output stays correct, but memory pressure can change which views render again.
- **Root question:** How should Mokly define partial capture retention order?
- **Options:**
  - **A.** Document the current retention rule and default. Effort: Small.
  - **B.** Stop retaining later views after the first skip or trim. Effort: Small.
  - **C.** Reapply retention after final capacity is known and restore every earlier view that then fits. Effort: Medium.
- **Left out:** An unbounded capture breaks the memory contract.
- **Wider fix:** C. A final-capacity pass makes retention independent of growing summary charge.
- **Previous examples:** Collector review finding 2 recorded the ordering difference.
- **Recommendation:** A. Output is unchanged, and the current rule is already implemented. C best stabilizes retention.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5892).
