# The settings session error's Try again reads nothing

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the check of finding 82 of the round 1 review of `calummoore/skeleton-sizing-mismatch`.
- **Location:** `ts/app/src/settings/layer-screen.tsx:174`.
- **Reason:** The lines are the same on `origin/main`, so the fix belongs to a separate branch.
- **Checked:** 2026-11-06, after the fix of review finding 82: on a wide surface, a failed session read on a durable settings route still draws nothing, the same as on `origin/main`.
- **Category:** Product bug.

- **Background:** When the session read fails, the compact settings route draws an error with Try again.
- **Problem:** Try again only calls `router.replace("/settings")`. The session provider reads the session only at mount and through `reload`, so the reader stays on the error and loses the pane's address.
- **Impact if no action:** A reader cannot recover from a failed session read without reloading the page.
- **Root question:** What does Try again do after a failed session read in settings?
- **Options:**
  - **A.** Call the session's `reload` and keep the pane's address. Effort: Small.
- **Left out:** Reload the whole page. It loses unsaved drafts that the settings guard protects.
- **Wider fix:** None.
- **Previous examples:** `ts/app/src/session/guard.tsx`, whose Try again calls `reload`.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because the lines are outside the change that found it.
