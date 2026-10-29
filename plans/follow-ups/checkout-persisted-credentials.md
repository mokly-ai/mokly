# Disable persisted credentials in CI checkouts

- **Severity:** Medium. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `.github/workflows/ci.yml`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** security.
- **Background:** Six CI jobs use `useblacksmith/checkout`. Its default stores the checkout token in `.git/config`.
- **Problem:** Pull request code can read the stored token. The repository is public, and the token has `contents: read` access.
- **Impact if no action:** Untrusted test code can copy a live GitHub credential.
- **Root question:** How should Mokly disable persisted credentials in CI checkouts?
- **Options:**
  - **A.** Set `persist-credentials: false` on all six checkout steps. Effort: Small.
  - **B.** Apply A and add a policy test that rejects persisted checkout credentials. Effort: Medium.
- **Left out:** Removing checkout permissions would prevent required source access.
- **Wider fix:** B. The policy test prevents the setting from returning.
- **Previous examples:** Final review R3 found the same default on all six jobs.
- **Recommendation:** A. It removes the credential immediately. B best protects the workflow class.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6213).
