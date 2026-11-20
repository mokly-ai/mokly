# The drawing test merges distinct reader cards

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from open finding 5 of the Milestone 26 review TODO in the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `packages/app/src/_tests_/viewer/stage-problems.ts:142-178` and `packages/app/src/_tests_/viewer/stage-drawings.test.ts:94-118`.
- **Reason:** PR #45 merged on 2026-10-20 with the finding open. The review-fix rule leaves its category to the user.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. `shownBodies` and `bodyProblems` still key a body by its action and its line kind only.
- **Category:** Test.

- **Background:** The app test `packages/app/src/_tests_/viewer/stage-drawings.test.ts` checks that each build-card body maps to a drawing. `shownBodies` and `bodyProblems` in `stage-problems.ts` key a body by its action and its line kind. The key has no build state. The review of 2026-10-20 found that two distinct cards with the same body then count as one. The comment at `stage-drawings.test.ts:94` says that bodies that differ by state stay apart. The key does not prove that for the state.
- **Problem:** The test can pass while one of two distinct cards is not drawn.
- **Impact if no action:** A missing build card drawing stays unnoticed.
- **Root question:** How does the drawing test tell distinct reader cards apart?
- **Options:**
  - **B.** Change nothing. Effort: Small.
  - **A.** Add the build's state group to the body key. The change is test-only. It is Medium only if it adds a test or helper file. Effort: Small (estimate).
- **Left out:** Not recorded.
- **Wider fix:** None found.
- **Previous examples:** None found.
- **Recommendation:** A. The review recommended it.
- **Action:** ask the user, because condition 6 holds: the finding concerns a test, a category that the review-fix rule does not let an agent fix alone.

The review graded the finding Low severity and Medium effort. That effort grade is history. The effort scale does not count test lines.

Source: [the Milestone 26 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2192-L2244) of the deleted plan.
