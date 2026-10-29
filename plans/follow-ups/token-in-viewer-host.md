# Protect tokens in viewer URL hosts

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-publish/src/completion.rs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** Publication rejects a viewer URL that contains the token. URL parsing lowercases the host before the current check.
- **Problem:** A mixed-case token in the host can print in a lowercased form that the case-sensitive matcher misses.
- **Impact if no action:** A publication response can expose a recognizable token variant.
- **Root question:** How should Mokly protect tokens in viewer URL hosts?
- **Options:**
  - **A.** Match the token in the host without regard to letter case. Add a regression test. Effort: Small.
  - **B.** Reject any viewer URL whose host contains the token. Effort: Small.
- **Left out:** Matching the full URL case-insensitively can change path semantics and over-redact unrelated text.
- **Wider fix:** A. Host-only case folding matches URL parser behavior.
- **Previous examples:** The old check had the same untested host gap.
- **Recommendation:** A. It fixes the exposure without adding a new rejection.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6365).
