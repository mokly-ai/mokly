# A build request opens its build after the reader left

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the check of finding 81 of the round 1 review of `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/viewer/build-request.ts:26` (`send`).
- **Reason:** The file is unchanged since `origin/main`, so the fix belongs to a separate branch.
- **Category:** Product bug.

- **Background:** Publish and Try again request a build and then open the build or publication that the answer names.
- **Problem:** `send` does not check that the card is still shown when the answer arrives, so a reader who moved on, for example through the switcher, is taken to that build.
- **Impact if no action:** A slow answer moves a reader away from the place that they chose.
- **Root question:** Where does a build request lead when its card is gone?
- **Options:**
  - **A.** Open the answer's build only while the card that sent the request is still shown, as `docs/protocol/folio-chrome.md` (Write in progress) says for writes that leave. Effort: Small.
- **Left out:** Cancel the request on unmount. The build is still created, so the reader should be able to find it in the switcher.
- **Wider fix:** See `plans/follow-ups/write-done-runs-after-unmount.md`, the same class for every write.
- **Previous examples:** `ts/app/src/navigation/leave-page.ts`, which leaves only while its screen is shown.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the file is outside the change that found it.
