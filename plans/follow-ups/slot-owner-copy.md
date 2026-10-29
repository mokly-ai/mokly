# Name the slot owner consistently

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/viewer/src/shell/workspace_props.tsx` and its design component.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** UX wording.
- **Background:** The slot detail line identifies the screen that supplied content. The product says “this page,” while the design names the owner.
- **Problem:** The product and design use different nouns for the same owner relationship.
- **Impact if no action:** Users can misread which entry supplied the slot.
- **Root question:** How should Mokly name the slot owner consistently?
- **Options:**
  - **A.** Keep “this page.” Effort: Small.
  - **B.** Name the owner by its title, as the design does. Effort: Small.
  - **C.** Design one shared entry noun and use it in every owner message. Effort: Large.
- **Left out:** Using an internal entry kind leaks implementation vocabulary.
- **Wider fix:** C. Shared entry wording prevents copy drift across screens and components.
- **Previous examples:** W2 decision 2 records the product and design strings.
- **Recommendation:** B. It gives the user the specific owner with no new design. C best protects the wording class.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6189).
