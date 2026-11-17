# The Account pane drawing has two primary buttons

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-04, from task M2e of `plans/loading-states-match-content.md`, on the branch `calummoore/skeleton-sizing-mismatch`.
- **Location:** `docs/mockups/src/screens/product/settings/account-pane.tsx` (`GithubSection`, Connect GitHub around line 43) and `ts/app/src/settings/panes/account-pane.tsx`.
- **Reason:** The fix changes a drawing that is already on `origin/main` and decides which side of a mockup and app difference is right, which the user decides.
- **Category:** Mockup.

- **Terms:**
  - **Account pane:** The settings pane for the signed-in reader: their name, email and GitHub connection.
- **Background:** `docs/protocol/shared-control-registrations.md` says that a screen spends one `primary` and pairs it with at most one alternative. The Account pane has Save changes and, for a reader with no GitHub connection, Connect GitHub. The app draws Connect GitHub in the secondary tone. The drawings of the empty pane and of Connect GitHub's write (`product/settings/account/github-connecting`) draw it primary.
- **Problem:** Two drawings show two primary buttons on one screen, against the rule, and differ from the app.
- **Impact if no action:** The spec breaks its own rule, and a later change may copy the second primary into the app.
- **Root question:** Which tone does Connect GitHub take on the Account pane?
- **Options:**
  - **A.** Draw Connect GitHub in the secondary tone in both drawings, as the app does. Effort: Small.
  - **B.** Change nothing. Effort: Small.
- **Left out:** Make the app draw two primaries. It breaks the one-primary rule.
- **Wider fix:** None. A check for one primary per drawing would be a new lint, which needs the user's approval.
- **Previous examples:** None found.
- **Recommendation:** A. The rule settles the tone, and the app already follows it.
- **Action:** ask the user, because A changes a drawing on `origin/main` and decides which side of a mockup and app difference is right.
