# A failed settings home read repeats without a limit

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the check of finding 82 of the round 1 review of `calummoore/skeleton-sizing-mismatch`.
- **Location:** `packages/app/src/settings/layer-address.ts:69`.
- **Reason:** The code moved unchanged from `origin/main`, so the fix belongs to a separate branch.
- **Checked:** 2026-11-06, after the fix of review finding 82: on a wide surface, the settings dialog's wait now stays on screen during the repeated reads, instead of a blank page. The repeated reads remain.
- **Category:** Product bug.

- **Background:** The settings layer resolves the reader's home before it redirects; a failure clears its `redirecting` flag.
- **Problem:** When `resolveHome` fails, the effect runs again and sends the failed reads again, with no limit, and the page stays blank.
- **Impact if no action:** A failed read loops quietly and the reader sees nothing.
- **Root question:** What does the settings layer do when its home read fails?
- **Options:**
  - **A.** Stop after a failure and draw the settings error with one Try again, as other settings reads do. Effort: Small.
- **Left out:** Retry with a delay. It still hides the failure from the reader.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the code is outside the change that found it.
