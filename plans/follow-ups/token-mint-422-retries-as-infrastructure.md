# Token mint 422 may retry as infrastructure

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from a finding check of the review of the branch `calummoore/builds-log-why-an-attempt-ends-as-9iep`.
- **Location:** `crates/mkc-publications/src/build_worker/execution.rs:47-80`, `crates/mkc-github/src/response.rs:30-40`, `docs/protocol/cloud/cloud-build-lifecycle.md:99-104`.
- **Reason:** The mapping is on `origin/main`, and the HTTP status that GitHub returns is not confirmed.

- **Terms:**
  - **Repository token:** The installation token, limited to one repository, that the build worker mints before each attempt.
  - **Repository unavailable:** The terminal build failure `repository-unavailable`, which needs no retry.
- **Background:**
  - The worker ends an attempt as repository unavailable only when the mint fails with `Forbidden` or `NotFound`. Every other mint error is an infrastructure retry, and the fifth one fails the build as "Build couldn't run".
  - `docs/protocol/cloud/cloud-build-lifecycle.md` says that loss of repository access ends the build `repository-unavailable`.
  - Reports outside the repository say that GitHub answers a token request for a repository that the installation cannot reach with HTTP 422, not 403 or 404. The check could not confirm this in the GitHub REST documentation.
  - `crates/mkc-github/src/response.rs` keeps an unclassified 4xx as `Http { status }`, so a 422 would retry five times.
  - Since the branch above, the worker logs one warning for each infrastructure ending. A 422 shows as the reason `repository token mint failed: [mkc-github-interface/error] HTTP 422`.
- **Problem:** A repository that the installation cannot reach may use up five attempts and end as "Build couldn't run" instead of "repository unavailable".
- **Impact if no action:** The user waits about 15 minutes for the wrong failure and does not learn that access is the cause.
- **Root question:** Which GitHub answers to a repository token request mean that the repository is unavailable?
- **Options:**
  - **A.** Change nothing, and use the new warning reasons to see whether a 422 occurs. Effort: Small.
  - **B.** Confirm the status with a live mint against a repository outside the installation. If it is 422, map it to repository unavailable for this request only, with a test. Effort: Small.
- **Left out:** Mapping every 4xx to repository unavailable, because a malformed request would then hide a real fault.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** B. One live request settles the question.
- **Action:** fix after merge, apply B, because the mapping is outside the scope of the branch and the status needs a live check.
