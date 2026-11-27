# The doors spec comment describes the onboarding walk

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from branch `calummoore/test-audit-app-and-cloud-rust-fl63`, review finding 11, which its finding check widened.
- **Location:** `packages/app/src/_tests_/settings/doors.spec.ts:102`.
- **Reason:** Another workspace owns `settings/doors.spec.ts`, so the test audit branch did not edit it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Onboarding walk:** the browser journey that creates a workspace, installs the GitHub App through the two recorded GitHub pages, chooses a repository, and reaches project setup.
- **Background:** On 2026-11-26 the App test audit changed `createProject` in `packages/app/src/_tests_/project-setup.ts` to create the project through the API, with `installThroughApi`. The four-screen walk stays as `walkToProject` for the onboarding specs. `packages/app/testing.md` describes both.
- **Problem:** The comment before `await page.unrouteAll()` in `settings/doors.spec.ts` says that "the walk that created the project answered GitHub's own pages". `createProject` no longer walks the screens or routes the GitHub pages, so the comment gives a wrong reason. The routes that `unrouteAll` now removes may be other routes, such as the build or sign-in doubles.
- **Impact if no action:** A reader may keep or change the `unrouteAll` call for a reason that no longer holds.
- **Root question:** What does the doors spec need to remove before a door leaves the page, now that project setup routes no GitHub pages?
- **Options:**
  - **A.** Correct the comment to name the routes that are still in force at that point, or to say that no route may answer for the page a door leaves for. Effort: Small.
  - **B.** Do A, and remove `unrouteAll` if no route is in force at that point, after a run of the spec that shows the same result. Effort: Small.
- **Left out:** None. The two options are the only changes.
- **Wider fix:** None. The `documentation` skill already says to correct comments that a behaviour change makes wrong.
- **Previous examples:** `packages/app/src/_tests_/build-scenario.ts` and `settings/installation.spec.ts` had the same stale wording, and the audit branch corrected them.
- **Recommendation:** B. It keeps only the cleanup that the spec still needs.
- **Action:** fix after merge, apply B, in the workspace that owns `settings/doors.spec.ts`.
