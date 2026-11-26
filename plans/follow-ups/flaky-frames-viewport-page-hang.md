# Frames viewport page stops replying after a pick

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Low. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the branch `calummoore/ci-speed-flaky-follow-ups-b-and-new-k3dt`, during its scan of the CI history.
- **Location:** `tests/browser/frames_viewport.spec.ts:87`, the test "the compact layout picks the wide canvas's viewport, and its pick sets the wide toggles".
- **Reason:** It failed once, in a run of a release branch, and its source is unknown.

- **Source:** Implementation.
- **Category:** Test.
- **Background:**
  - CI run 45639385443, job 139293557748, Browser shard 10 of 10, on the branch `release-please--branches--main--components--desktop` on 2026-11-25, failed the test. The run had one attempt.
  - The failure text: "Error: expect(page).toHaveURL(expected) failed. Expected pattern: /\?viewport=mobile$/. Received string: """, then "Tearing down "context" exceeded the test timeout of 60000ms" and "browserContext.close: Test timeout of 60000ms exceeded".
  - The trace shows that the page stopped answering after `selectOption`. `toHaveURL` logged nothing for 60 seconds, and the close of the page timed out. The trace has no protocol error and no "Promise was collected" reply, so this is not the evaluate-promise failure of `plans/follow-ups/browser-evaluate-promise-collected.md`.
  - The test uses the viewer fixture of `packages/viewer/tests/browser_fixture.ts`.
- **Problem:** The page of the test stopped answering Playwright, and no later step could read it.
- **Impact if no action:** A passing change can fail the Browser suite now and then.
- **Root question:** What stops the fixture page from answering after the viewport pick?
- **Options:**
  - **A.** Repeat the test under load with a trace, and read the renderer state when the page stops answering. Then fix the source. Effort: Medium.
  - **B.** Wait for a second failure before any work. Effort: Small.
- **Left out:** A retry or a longer time limit, because they hide a hung page.
- **Wider fix:** None until the source is known.
- **Previous examples:** None found.
- **Recommendation:** A. One failure with a hung renderer can be a product loop in the viewer.
- **Action:** ask the user, because the failure is not reproduced and its source is unknown.
