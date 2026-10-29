# Align CSS Module checks for custom-property-like rules

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-css/src/module_checks.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Three CSS Modules scanners classify statements in rule lists. One scanner skips blocks that start like custom properties.
- **Problem:** The module check can skip an `@value` inside `--x:{…}` while the renamer and token check read it as a rule.
- **Impact if no action:** An `@value` can pass at rule level in keyframes and document blocks.
- **Root question:** How should Mokly align CSS Module checks for custom-property-like rules?
- **Options:**
  - **A.** Keep the special skip. Effort: Small.
  - **B.** Delete the skip and apply the catalogued `@value` error at every rule level. Effort: Small.
- **Left out:** A new fourth classification would preserve the same disagreement.
- **Wider fix:** B. Every scanner then uses the same statement classification.
- **Previous examples:** User item 113 records the differential example.
- **Recommendation:** B. It removes the last scanner-only statement rule.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5982).
