# Align strict-mode warning summaries

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The strict-mode summaries listed in this item and `crates/mokly-cli/src/grammar.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** docs or spec.
- **Background:** Strict mode fails on every build warning except `base-dependencies`. One protocol page owns that exception.
- **Problem:** Many short summaries still say that every warning fails. The CLI publish help makes the same claim.
- **Impact if no action:** Users can expect exit failure when only a base dependency warning exists.
- **Root question:** How should Mokly align strict-mode warning summaries?
- **Options:**
  - **A.** Name the exception or link to the strict-mode rule in each summary that states the policy. Effort: Small.
  - **B.** Remove universal policy claims from summaries and keep one linked home. Effort: Small.
- **Left out:** Changing strict behavior would be a separate product decision.
- **Wider fix:** None. The documentation skill already requires one source and aligned summaries.
- **Previous examples:** User item 186 lists the affected guides, protocols, README, mockup README, and CLI help.
- **Recommendation:** A. It keeps useful summaries and makes each one accurate.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6438).
