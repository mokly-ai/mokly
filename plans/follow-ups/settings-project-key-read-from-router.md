# Settings reads its project key from the router

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from branch `calummoore/header-bar-loading-issue-mqph`, review round 1.
- **Location:** `packages/app/src/settings/dialog-host.tsx:81`, `packages/app/src/settings/routes.ts:9`.
- **Reason:** The branch fixes a route remount and does not change how the settings dialog finds its project, so this fix needs its own branch.

- **Terms:**
  - **`settingsProject`:** the query key with which an account or onboarding route names the project that the settings dialog opens for.
  - **Router params:** the values that `useGlobalSearchParams` of Expo Router returns. They come from the router's navigation state, not from the address bar.
- **Background:** The app owns the query of the address. It writes query-only changes with `pushState` and `replaceState`, and the router does not see them. `SettingsDialogHost` reads the `settings` key from the address, but it reads `settingsProject` from the router params. Closing the dialog removes both keys from the address through `paneQuery` and `pageBeneath`.
- **Problem:** After the dialog closes, the router params can still hold the old `settingsProject`. A later open of the dialog on the same route then uses that old project id. The address no longer names it.
- **Impact if no action:** In a rare case, the dialog opens for a project that the address does not name. No reader report exists.
- **Root question:** Where does the settings dialog read the project that its address names?
- **Options:**
  - **A.** Read `settingsProject` from the address, with `readQuery(search)`, as the dialog already reads `settings`. Keep the router params for the path values. Effort: Small.
  - **B.** Do A, and read every query value of the dialog through one helper that takes the address search. Effort: Small.
- **Left out:** Route the dialog's query writes through the router. That is the open item `app-writes-query-history-itself.md`.
- **Wider fix:** B, because one helper keeps every query read on the address.
- **Previous examples:** None found.
- **Recommendation:** A. It removes the stale read with one line, and the dialog reads no other query value from the router.
- **Action:** fix after merge, apply A, because the remount fix does not touch this read.
