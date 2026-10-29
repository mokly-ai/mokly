# Exclude nested matches from own-preview changes

- **Severity:** High. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** Own-page CSS reduction and comparison classification in `crates/mokly-compare`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** A component can render a nested copy of itself through another component. Stylesheet matches then exist at nested and own-page depths.
- **Problem:** Nested-only records can mark the component's own previews Changed and add dependency reasons to consumers.
- **Impact if no action:** Changes can show wrong rows and reasons for nested-only CSS matches.
- **Root question:** How should Mokly exclude nested matches from own-preview changes?
- **Options:**
  - **A.** Add one page-level nested-only flag. Mixed nested and own sources remain ambiguous. Effort: Medium.
  - **B.** Carry kept own-page stylesheet paths through reduction and classification. Keep nested records in Details. Effort: Large.
- **Left out:** Dropping nested records loses valid Details evidence.
- **Wider fix:** B. Per-path evidence distinguishes nested and own sources in mixed pages.
- **Previous examples:** Hub review 3 confirmed option B. The current code carries B pending the user's decision.
- **Recommendation:** B. It gives classification the exact own-page evidence.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5938).
