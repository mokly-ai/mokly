# A late GitHub answer erases the current flow record

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from finding 42 of the round 1 review of `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `apps/app/src/navigation/github-flow.ts` (`storeGitHubFlow`), `apps/app/src/navigation/leave-page.ts:61`, and the six GitHub callers that store a flow and then leave: `screens/account/entry-screen.tsx:156`, `install-screen.tsx`, `connect-screen.tsx`, `github-install-screen.tsx`, `settings/panes/account-pane.tsx` and `settings/panes/github-pane.tsx`.
- **Reason:** The race needs an unusual order of answers, and the shared fix reaches every GitHub writer.
- **Category:** Product bug.

- **Terms:**
  - **GitHub flow record:** The state and the verifier that the app stores in the tab for one GitHub trip; the landing compares the returned state with it.
  - **`leave`:** The write's method that sends the page to another site only while the screen that started the write is still shown.
- **Background:** Starting a GitHub trip replaces every flow record in the tab, as `docs/protocol/cloud/auth-callbacks.md` says. On 2026-11-04 the branch made a write that leaves the page leave only while its screen is shown (`docs/protocol/cloud/folio-chrome.md`, Write in progress). Each GitHub caller still stores its record first and only then calls `leave`, which makes the check.
- **Problem:** A screen that the reader left can still store its late answer's record, after a newer screen started its own trip. The newer trip's callback then finds the older record and reports an invalid flow. A probe saw: trip B leaves, record A is stored, callback B returns `{"status":"invalid"}`.
- **Impact if no action:** A valid GitHub sign-in or installation return can fail, and the reader starts the GitHub process again.
- **Root question:** How does a newer GitHub trip survive an older request's late answer?
- **Options:**
  - **A.** Check that the screen is still shown before each caller stores its record, and add the answer-order regression case. Effort: Small.
  - **B.** One shared operation takes the purpose and the answer, and stores the record and leaves in one step while the screen is shown; no screen calls `storeGitHubFlow` itself, and the install landing uses it too. Replace the wait at `apps/app/src/_tests_/write-in-progress.spec.ts:158`, which expects the abandoned record. Effort: Medium.
  - **C.** Make the flow store refuse the answer of an older start: each caller takes a start number before its request, like the session generation of commit `cb282fac`. Effort: Small.
  - **D.** Abort each GitHub start request when its screen unmounts. Effort: Medium.
- **Left out:** Remove an abandoned record afterwards. It can also erase the newer record.
- **Wider fix:** B. No GitHub writer can store before the shown check.
- **Previous examples:** Commit `cb282fac` stopped an old session read from overwriting a newer sign-in.
- **Recommendation:** B. It removes the race for every GitHub writer in one place.
- **Action:** fix after merge, apply B, because the race needs an unusual answer order and the shared fix reaches every GitHub writer.
