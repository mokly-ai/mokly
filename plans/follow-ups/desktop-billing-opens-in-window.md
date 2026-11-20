# Desktop billing cannot use saved payments

- **Severity:** Low. **Likelihood:** Common. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from decision 3 of the desktop browser sign-in plan on the branch `calummoore/desktop-browser-authentication`. The user has not answered it.
- **Location:** `apps/desktop/src/navigation.ts:8-11` and `docs/protocol/cloud/desktop-app.md` "Navigation".
- **Reason:** Each change moves billing out of the desktop app's window, which changes the navigation requirement.

- **Terms:**
  - **Round-trip host:** a host that the desktop app's window may load at the top level, because its page returns to the product. Only `https://checkout.stripe.com` and `https://billing.stripe.com` remain.
- **Background:**
  - On 2026-11-06 the user chose desktop sign-in through the browser. GitHub pages no longer load in the window, and GitHub setup opens on the web.
  - For billing, the app's session asks the API for a Stripe Checkout or customer portal session, and the window opens Stripe's page. Stripe returns to the billing pane on the public app origin. Only Stripe's webhook changes the plan (`docs/protocol/cloud/billing-subscriptions.md`).
  - The window re-reads account data when it gets focus.
- **Problem:** The window cannot use cards saved in the browser, and it cannot offer Apple Pay or Google Pay.
- **Impact if no action:** Readers type their card details into the app to upgrade.
- **Root question:** Where does Stripe's page open when the reader pays or manages billing from the desktop app?
- **Options:**
  - **A.** Keep Stripe in the window. Effort: Small.
  - **B.** Open the billing pane on the web. The payment then applies to the browser's account, which can differ from the app's. Effort: Medium.
  - **C.** Remove the two Stripe hosts from the round-trip hosts, so the window opens Stripe's page in the browser. The app's session still creates the payment session for the app's workspace, and the app code does not change. The return page opens in the browser, which can ask the reader to sign in. The app shows the new plan after focus. The billing actions in the window may need the external glyph and a mockup variant. Effort: Small.
- **Left out:** None.
- **Wider fix:** C. With browser sign-in, no third-party page then loads in the window.
- **Previous examples:** PR #42 allowed the Stripe hosts in the window.
- **Recommendation:** C. One press opens Stripe in the browser with saved cards, Apple Pay and Google Pay, and the payment goes to the app's own workspace.
- **Action:** Ask the user, because B and C change the navigation requirement in `docs/protocol/cloud/desktop-app.md`.
