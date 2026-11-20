# The Account pane's GitHub note differs from its drawing

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from task M2e of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `packages/app/src/settings/panes/account-pane.tsx` and `docs/mockups/src/screens/product/settings/account-pane.tsx` (`GithubSection`).
- **Reason:** The difference is already on `origin/main`, and choosing a side of a mockup and app difference is the user's.
- **Checked:** 2026-11-06, from the check of review finding 82: the drawing titles the connected note with a GitHub login, which the session does not carry; the app draws a "GitHub account" note with a status badge.
- **Category:** Mockup.

- **Terms:**
  - **GitHub note:** The block on the Account pane that says whether the reader's GitHub account is connected, with Connect GitHub or Disconnect GitHub.
- **Background:** The Account pane shows the reader's GitHub connection in a note. The drawing gives that note one title and layout. The app draws a different title and layout. For a connected reader, the drawing offers Disconnect GitHub, and the app keeps it disabled, because the app has no disconnect write.
- **Problem:** The app and the drawing disagree on the note's title, its layout and whether Disconnect GitHub works.
- **Impact if no action:** The spec shows a note and an action that the product does not have.
- **Root question:** What does the Account pane's GitHub note say and offer?
- **Options:**
  - **A.** Redraw the note as the app draws it, with Disconnect GitHub disabled or removed until a disconnect write exists. Effort: Small.
  - **B.** Change the app's note to the drawing's title and layout, and keep Disconnect GitHub disabled until the write exists. Effort: Small.
- **Left out:** Build a disconnect write. It is a new feature at the API boundary, outside this question.
- **Wider fix:** None.
- **Previous examples:** `plans/follow-ups/workspace-pane-mockup-lacks-role.md`, another settings pane that differs from its drawing.
- **Recommendation:** A. The app is what readers use, and a drawn action that does nothing misleads.
- **Action:** ask the user, because each option decides which side of a mockup and app difference is right.
