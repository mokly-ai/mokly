# The window can read Free before Stripe's webhook writes Team

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from the check of finding 1 of the round 1 review of `calummoore/stripe-loading-outside-app-mrlb`. The user has not answered it.
- **Location:** `apps/app/src/settings/panes/billing-pane.tsx` (the read again on window focus) and `docs/protocol/cloud/desktop-app.md` "Billing".
- **Reason:** Each option other than A adds behaviour that the "Billing" section does not state.
- **Category:** Product bug.

- **Background:** In the desktop app's window, Checkout opens in the system browser. The window reads the Billing pane once each time it gets focus. Only Stripe's webhook writes the plan, through a worker. A browser tab's Checkout return instead reads again every 2 seconds for up to 30 seconds and shows "Confirming your subscription".
- **Problem:** A reader who pays and returns to the window before the webhook lands reads Free and Upgrade to Team again until the next focus.
- **Impact if no action:** The reader may think the payment failed, or press Upgrade to Team again, which the API refuses with `subscription-active` once the subscription is live.
- **Root question:** How does the window learn that a payment started from it has finished?
- **Options:**
  - **A.** Keep one read on each focus. The next focus shows Team. Effort: Small.
  - **B.** After the window opens Checkout, the next focus reads again every 2 seconds for up to 30 seconds until a read reports Team, without the confirming state. Effort: Medium.
  - **C.** Send the end of the payment back to the window through a second `mokly://` address, so the window runs the existing confirmation. It needs an API field and a new shell handoff. Effort: Large.
  - **D.** On each window focus, read again every mounted workspace and project read, whatever screen is open. It also covers upgrades made on the web. It changes the focus rule of "Web Setup". Effort: Medium.
- **Left out:** Return Stripe to the window breaks the user's request.
- **Wider fix:** D, for any plan change made outside the window.
- **Previous examples:** None found.
- **Recommendation:** B. It reuses the bounded wait that a browser tab already has, at Medium cost and with no new handoff.
- **Action:** Ask the user, because B, C and D add behaviour that no requirement states.
