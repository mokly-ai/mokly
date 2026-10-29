# Add the missing affected-component artboards

- **Severity:** Low. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `examples/basic/specs/design/components` and `docs/protocol/mokly-component-design.md`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** mockup.
- **Background:** Component mockups define Usage lists and comparison states before product work. The affected-screen artboard covers only the screen state.
- **Problem:** The mockups omit affected component variants and Unmodified affected views. The shared Usage list also names only screens.
- **Impact if no action:** Product work has no reviewed design for three affected-component states.
- **Root question:** How should Mokly add the missing affected-component artboards?
- **Options:**
  - **A.** Keep the component case in copy only. Correct the Usage list and component-design sentence. Effort: Small.
  - **B.** Draw the affected variant, Unmodified affected view, and component Affected list. Correct the shared copy and contract sentence. Effort: Large.
- **Left out:** Implementing the states before their mockups breaks the repository design-first rule.
- **Wider fix:** B. It defines the complete affected-component state system.
- **Previous examples:** The existing affected-screen artboard covers only the screen state. Review 103 C widened the required component states.
- **Recommendation:** B. It gives every product state a reviewed mockup.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5918).
