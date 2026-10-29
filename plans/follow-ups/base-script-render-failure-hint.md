# Show the install-scripts hint for render failures

- **Severity:** Medium. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-cli/src/changes_base.rs` and `crates/mokly-cli/src/changes_diagnostics.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Mokly shows a recovery hint when disabled base scripts cause dependency failures. Render failures use a separate diagnostic path.
- **Problem:** A render failure caused by disabled scripts does not show the recovery hint.
- **Impact if no action:** Users can see the failure without the option that can recover it.
- **Root question:** How should Mokly show the install-scripts hint for render failures?
- **Options:**
  - **B.** Add the hint where Changes classifies render failures. Effort: Medium.
  - **C.** Carry a typed scripts-disabled cause and use one helper for every related failure. Effort: Large.
- **Left out:** Option A was the direct diagnostic fix already in progress. This item keeps its wider delivery choices.
- **Wider fix:** C. A typed cause prevents each failure path from deciding the hint independently.
- **Previous examples:** The 135 B review found missing hints in several failure paths.
- **Recommendation:** C. It gives every applicable failure one source for the recovery action.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6127).
