# Catalogue archive ignores the rollout time

- **Severity:** Medium. **Likelihood:** Rare (estimate). **Effort:** Large (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the final review of the deleted Stripe catalogue sync plan. That review reported it on 2026-09-27 as its Medium finding, and nobody applied it. Its text comes from the billing branch's merge reviews before PR #19 merged, which named it again.
- **Location:** `crates/mkc-billing-stripe/src/bin/stripe-catalogue/stripe_catalogue/archive_decision.rs:159`, `crates/mkc-billing-stripe/src/bin/stripe-catalogue/stripe_catalogue/archive.rs:168`, `docs/protocol/cloud/billing-catalogue.md` (Archive).
- **Reason:** Every option changes the archive contract or adds rollout state, so the user chooses.
- **Category:** Product bug.

- **Terms:**
  - **Superseded price:** An older Stripe price for a seat whose lookup key moved to a replacement price during a catalogue sync.
  - **Archive command:** `cargo xtask stripe-catalogue archive`, a manual clean-up that sets superseded prices to `active=false`.
- **Background:** A catalogue sync can replace a seat price. The old price stays active, because running processes, stored Checkout requests and seat commands can still carry its ID. The archive command later archives superseded prices by hand. It keeps them while the current price is less than 24 hours old, measured from the current price's `created` time. `docs/protocol/cloud/billing-catalogue.md` calls this hold a safety net, not a rollout timer. `docs/ops/billing-smoke.md` tells the operator to archive only after the rollout that made the current prices live has succeeded.
- **Problem:** The hold counts from when the replacement price was created, not from when the rollout finished. After a rollout that ends more than 24 hours after the sync, the operator can archive the predecessor at once. A stored Checkout request can still reference it during its one-hour retry window.
- **Impact if no action:** A Checkout attempt that Mokly could otherwise recover can fail, and the customer must start again.
- **Root question:** How does the archive command know that no live request still needs a superseded price?
- **Options:**
  - **A.** Remove the archive write path and leave superseded prices active. They harm nothing, because only prices that hold a catalogue lookup key are sold. Effort: Medium (estimate).
  - **B.** Record when each rollout succeeds, and archive only after both the 24-hour hold and a one-hour drain after that rollout. Add a regression test for a delayed rollout. Effort: Large (estimate).
  - **C.** Document a one-hour wait after the rollout, without enforcing it. Effort: Small (estimate).
- **Left out:** Changing nothing leaves the failure possible.
- **Wider fix:** B. It makes the command enforce the safe time instead of relying on the operator.
- **Previous examples:** None found.
- **Related:** [`plans/follow-ups/unidentified-review-findings-need-verification.md`](https://github.com/mokly-ai/mokly-cloud/blob/10834d30c83cb54b5bdfdb719b99b98febf56fd0/plans/follow-ups/unidentified-review-findings-need-verification.md) listed this finding without its text until 2026-11-01.
- **Recommendation:** B. Documentation alone cannot stop an unsafe run. The original review recommended B.
- **Action:** ask the user, because condition 3 holds: B is Large and adds rollout state.
