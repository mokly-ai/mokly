# Define saved variant slot element checks

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-catalogue/src/validate_templates.rs` and `docs/protocol/mokly-html-components.md`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** Saved component variants can supply slot elements. Catalogue checks currently validate those elements like other authored slot content.
- **Problem:** The protocol does not state whether every current element check applies to saved variant slots.
- **Impact if no action:** A future refactor can remove checks or warnings without a clear requirement.
- **Root question:** How should Mokly define saved variant slot element checks?
- **Options:**
  - **A.** Keep the current checks and state the rule in the HTML components contract. Effort: Small.
  - **B.** Keep only `html-ignore-attribute` and `html-foster-parented` warnings for saved variant slots. Effort: Small.
- **Left out:** Skipping all checks would allow invalid saved slot markup without required warnings.
- **Wider fix:** A. One authored-slot rule prevents format-specific validation drift.
- **Previous examples:** F21 recorded this as user item 128.
- **Recommendation:** A. It documents and preserves the existing behavior.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6018).
