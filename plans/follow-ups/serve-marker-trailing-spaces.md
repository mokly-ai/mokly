# Remove trailing spaces from the Serve marker fixture

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 163, final review R2.
- **Location:** `packages/viewer/tests/serve_marker_documents.ts:18`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Repository rule.
- **Background:** `packages/viewer/tests/serve_marker_documents.ts` holds a
  Serve HTML fixture as exact bytes in a template string. Six of its lines
  end in spaces: lines 18, 29, 33, 36, 44, and 54 today.
- **Problem:** `git diff --check` reports those six lines. No repository
  gate runs `git diff --check`, so nothing fails.
- **Impact if no action:** Each diff audit that runs `git diff --check`
  reports noise, which can hide a new whitespace defect.
- **Root question:** How should the fixture keep its exact bytes without
  trailing whitespace?
- **Options:**
  - **A.** Remove the trailing spaces from the six lines, and update any
    exact-byte assertion that needs it. Effort: Small.
  - **B.** Add a narrow whitespace exception for this fixture. Effort: Small.
- **Left out:** A repository-wide `git diff --check` gate is a separate
  stricter-validation decision. Only two distinct approaches exist: change
  the bytes, or excuse them.
- **Wider fix:** None. The fixture needs no trailing spaces, so A removes
  the only case, and a new gate needs its own decision.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the needless bytes and weakens no check.
- **Action:** ask the user, because the user reserved the choice for each open
  review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6205).
