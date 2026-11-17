# Onboarding test declares the wrong body type

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from an outside-the-scope note of the Milestone 5 review TODO in the deleted `plans/require-the-installation.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `ts/app/src/_tests_/onboarding.spec.ts:317-330`.
- **Reason:** The test predates PR #69's review scope, so that review left it for a separate branch. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The repositories route still checks its empty page with `satisfies ApiBody<"listInstallations">`.
- **Category:** Test.

- **Terms:**
  - **`ApiBody<op>`:** The test type that gives the response body of one API operation from the generated client types.
- **Background:** The test "a repository list that comes back empty offers the manage link" routes `GET /v1/github/installations/*/repositories` to an empty page. The body checks itself with `satisfies ApiBody<"listInstallations">`. The route answers the `listRepositories` operation.
- **Problem:** The type check compares the body with the installation list, not with the repository list that the route answers.
- **Impact if no action:** A change to the repository list shape does not fail this test's type check.
- **Root question:** Does each routed body check itself against the operation that its route answers?
- **Options:**
  - **A.** Change the type to `ApiBody<"listRepositories">`. Effort: Small.
  - **B.** Leave it, because both pages have the same envelope today. Effort: Small.
- **Left out:** A helper that derives the operation from the route pattern. It is a larger change for one wrong key.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. It is a one-word fix that restores the check.
- **Action:** ask the user, because condition 6 holds: the finding concerns a test, a category that the review-fix rule does not let an agent fix alone.

Source: [the Milestone 5 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/require-the-installation.md?plain=1#L244-L261) of the deleted plan.
