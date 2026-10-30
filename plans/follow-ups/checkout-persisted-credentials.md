# Disable persisted credentials in CI checkouts

- **Severity:** Medium. **Effort:** Small (estimate).
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 164, from finding R3 of the final review.
- **Location:** `.github/workflows/ci.yml:68`, `:122`, `:172`, `:230`,
  `:275`, and `:335`.
- **Reason:** The plan recorded this item after the user's rule of
  2026-10-21 that new review items wait for the user after the merge.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Persisted credentials:** the checkout action's default of storing the
    job's GitHub token in `.git/config`, so that later Git commands can use
    it.
- **Background:**
  - The six checkout steps of `.github/workflows/ci.yml` use
    `useblacksmith/checkout` without `persist-credentials: false`.
  - The workflow grants `contents: read`, at `ci.yml:8-9`. The repository is
    public, and the same setting is on `main`.
  - Eight other workflows already set `persist-credentials: false`, for
    example `release.yml`, `release-check.yml`, and `dependency-audit.yml`.
  - Some workflow tests already assert the setting:
    `tests/dependency_audit_workflow.test.ts:60`,
    `tests/native_bootstrap_workflow.test.ts:133`, and
    `tests/release_matrix.test.ts:100`. No test covers `ci.yml`.
- **Problem:** Pull request code that runs in CI can read the stored token
  from `.git/config`.
- **Impact if no action:** Untrusted test code can copy a live GitHub token
  with read access while its job runs.
- **Root question:** How do the CI jobs keep the checkout token away from
  the code that they test?
- **Options:**
  - **A.** Set `persist-credentials: false` on all six checkout steps.
    Effort: Small (estimate).
  - **B.** Apply A, and add a policy test that rejects a checkout that
    persists credentials in any workflow. It adds a gate. Effort: Medium
    (estimate).
- **Left out:** Remove the checkout permission. The jobs need to read the
  source. Fewer than three approaches exist, because the token is either
  stored or not, and a test can guard the choice.
- **Wider fix:** B. The policy test stops the setting from coming back.
- **Previous examples:** The release, release-check, dependency audit, and
  native bootstrap workflows already set it, and their tests check it.
- **Recommendation:** A. It removes the stored token at once. B best
  protects the workflow class, and it needs the user's approval because it
  adds a gate.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review items wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6213).
