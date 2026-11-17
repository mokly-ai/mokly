# The settings route wait drops a Checkout return's query

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, from the fix of review finding 83 on `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `apps/app/src/settings/route-wait.tsx:73` (a press on another rail entry while the wide durable route waits).
- **Reason:** Normal use does not meet it: the reader must press another pane during the short wait of a Checkout return, and the webhook must arrive after they open Billing.
- **Category:** Product bug.

- **Terms:**
  - **Checkout return:** The address that Stripe Checkout sends the reader back to, `/{workspace}/-/settings/billing?checkout=success`, which makes the Billing pane confirm the new plan.
- **Background:** On a wide surface, a durable settings route draws the dialog's wait until it hands over to the page beneath. A press on the route's own entry does nothing, so the query stays. A press on another entry opens that pane's durable route.
- **Problem:** That press drops the route's query, so a Checkout return loses `checkout=success`. If the reader then opens Billing before the webhook writes the plan, Billing reads Free.
- **Impact if no action:** Billing can offer Upgrade to Team right after a successful Checkout, which `docs/protocol/cloud/settings-dialog.md` says the success path never does.
- **Root question:** What happens to a Checkout return's query when the reader moves to another pane during the wait?
- **Options:**
  - **A.** Keep the route's query on a press on any rail entry, as the dialog's own rail does. Effort: Small.
  - **B.** Store the Checkout return outside the address, for example in session storage. Effort: Medium.
- **Left out:** Change nothing. It can offer Upgrade to Team after a successful Checkout.
- **Wider fix:** None.
- **Previous examples:** The dialog's own rail, which keeps the query.
- **Recommendation:** A. It matches the dialog's rail.
- **Action:** fix after merge, apply A, because the case needs a press during a short wait and a late webhook.
