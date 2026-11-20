# Web setup can apply to another account

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from the options check of decision 1 of the desktop browser sign-in plan on the branch `calummoore/desktop-browser-authentication`. The user chose option B before the check added option D, and has not answered D.
- **Location:** `docs/protocol/cloud/desktop-app.md` "Web Setup" and `apps/app/src/navigation/web-setup.ts`.
- **Reason:** The fix adds a check at the account boundary that no requirement covers.

- **Terms:**
  - **Web setup:** in the desktop app, **Connect GitHub**, **Add GitHub account**, **Install on GitHub** and **Continue on GitHub** open their pages in the system browser, where the browser's Mokly session finishes them.
- **Background:**
  - The desktop app signs in through a Mokly page in the browser, so at sign-in the app and the browser use the same account.
  - Later, the default browser can hold a different account, for example in another browser profile, or after the reader switched accounts on the web.
  - Web setup applies to whatever account the browser holds. The window re-reads its own account data on focus.
- **Problem:** A reader can connect GitHub or install the GitHub App on another Mokly account, and nothing warns them.
- **Impact if no action:** The setup lands in the other account, and the app shows no change.
- **Root question:** How does web setup reach the account that the desktop app uses?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Open each setup page through one check with the app's user ID. On a match, it continues to the setup page. On a mismatch, it names the browser's account and offers **Use another account**. A signed-out browser signs in first. A user ID is not a credential. It needs a page state, mockups and copy. Effort: Medium.
  - **C.** Before setup, the app asks for a one-use link that signs the browser in to the app's account after a confirmation. It adds a second credential with the account-switch risk of `plans/follow-ups/magic-link-login-switches-account.md`. Effort: Large.
  - **D.** Relay GitHub's return from the browser back to the app, so setup stays bound to the app's session. It needs a second return path beside the grant. Effort: Large.
- **Left out:** None.
- **Wider fix:** B. One check covers every setup page.
- **Previous examples:** None found.
- **Recommendation:** B. It protects setup from an account mismatch for a small part of the cost of D.
- **Action:** Ask the user, because B adds behaviour at the account boundary that no requirement covers.
