# Detect statement changes from bare CSS Module wrappers

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-css/src/rename_selectors.rs` and the module integrity fingerprint.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** The CSS Modules renamer removes bare `:global` and `:local` wrappers. The token check compares scanner fingerprints.
- **Problem:** Removing a wrapper can turn a rule into an at-rule or empty a statement. The current fingerprint misses both changes.
- **Impact if no action:** Mokly can accept CSS whose statement meaning changed during rewriting.
- **Root question:** How should Mokly detect statement changes from bare CSS Module wrappers?
- **Options:**
  - **A.** Keep the current behavior. Effort: Small.
  - **B.** Add each statement kind to the fingerprint and reject any rewrite that changes it. Effort: Small.
  - **C.** Keep a bare wrapper when no selector follows so the CSS parser reports it. This does not cover every wrapper form. Effort: Small.
- **Left out:** A special case for only `:global()` still leaves the bare form unprotected.
- **Wider fix:** B. Statement kind protects every rewrite that changes grammar.
- **Previous examples:** User item 112 includes at-rule and empty-statement examples.
- **Recommendation:** B. One fingerprint rule covers the full class.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5962).
