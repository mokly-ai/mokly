# Remove trailing spaces from the Serve marker fixture

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `packages/viewer/tests/serve_marker_documents.ts`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** repository rule.
- **Background:** A Serve HTML fixture stores exact bytes in a template string. Six lines contain trailing spaces.
- **Problem:** `git diff --check` reports those spaces, but no repository gate runs that command.
- **Impact if no action:** Routine diff audits report noise and can hide new whitespace defects.
- **Root question:** How should Mokly remove trailing spaces from the Serve marker fixture?
- **Options:**
  - **A.** Remove the trailing spaces and update exact-byte assertions if needed. Effort: Small.
  - **B.** Add a narrow whitespace exception for this fixture. Effort: Small.
- **Left out:** Adding a repository-wide diff gate is a separate stricter validation decision.
- **Wider fix:** A. The fixture does not need trailing spaces, so removing them eliminates the class at this location.
- **Previous examples:** Final review R2 found all six lines.
- **Recommendation:** A. It removes the unnecessary bytes without weakening a check.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6205).
