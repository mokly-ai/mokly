# A late Stripe answer opens the browser after the reader left Billing

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from finding 2 of the round 1 review of `calummoore/stripe-loading-outside-app-mrlb`.
- **Location:** `apps/app/src/settings/panes/billing-stripe.ts` (`openStripe`), called after the API answers in `apps/app/src/settings/panes/billing-pane.tsx`.
- **Reason:** A rare Medium product bug gets `fix after merge` under the fix rule. The fix reaches the shared write layer.
- **Category:** Product bug.

- **Terms:**
  - **`useLeavePage`:** The shared hook that lets a screen hand the reader to another site only while that screen is still shown.
- **Background:** In the desktop app's window, Upgrade to Team and Manage billing open Stripe's page in the system browser. Each action waits for the API's answer first. A browser tab leaves for Stripe through the write's `leave`, which checks through `useLeavePage` that the Billing pane is still shown.
- **Problem:** The window path opens the browser with no such check. A reader who closes settings or opens another pane while the answer is pending still gets Stripe's page.
- **Impact if no action:** A payment page opens in the browser for an action that the reader abandoned.
- **Root question:** How does a late Stripe answer behave after the reader leaves Billing?
- **Options:**
  - **A.** Check in the Billing pane that it is still shown before it opens the popup. It repeats the check that `useLeavePage` holds. Effort: Small.
  - **B.** Give the write a second, screen-checked operation that opens a page beside the app, and use it from `openStripe`. Each caller still branches on the shell. Effort: Small.
  - **D.** Let `leave` with only an address open the page in the system browser in the window, after the same screen check, without keeping the write busy. Billing then calls `leave` in both places, and `openStripe` goes. GitHub trips keep the tab path. Effort: Small.
  - **F.** Apply D, and widen "Write in progress" in `docs/protocol/cloud/folio-chrome.md` to say that a write hands the reader to another site only while its screen is shown, also when the window opens the page in the browser. The sentence is a new requirement, so it needs the user's review. Effort: Small.
- **Left out:** Change nothing fails the goal. Stripe in the window breaks the decision in `docs/protocol/cloud/desktop-app.md` "Billing". Holding the reader on Billing while the write runs breaks "Write in progress". An empty popup opened at the press fails, because the shell denies every popup.
- **Wider fix:** D. One operation is correct in a tab and in the window, so no caller can skip the screen check. The same branch can gate `done` with the check and close `write-done-runs-after-unmount.md`.
- **Previous examples:** PR #390 fixed late GitHub answers through `useLeavePage`.
- **Recommendation:** D, then F when the user accepts the requirement sentence.
- **Action:** Fix after merge, apply D, because the bug needs uncommon timing and the fix reaches the shared write layer.
