# Stripe Tax registrations wait for the owner

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Low. **Harder later:** Yes.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the first unchecked post-merge task of the deleted `plans/billing.md`, on the branch `calummoore/plans-skill-update`. On 2026-11-01 the merge of `main` into `calummoore/maseru` merged the duplicate item `stripe-tax-registrations-unset.md` into it.
- **Location:** The live and test modes of the Stripe account. `docs/ops/billing-smoke.md` gives the setup.
- **Reason:** The registrations depend on where Mokly must collect tax, and on 2026-10-30 the user chose to leave them for now.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the account state. The code still asks Stripe for automatic tax, but nobody read the registrations after 2026-10-30.

- **Terms:**
  - **Stripe Tax:** The Stripe feature that calculates and collects sales tax or VAT at Checkout for each registered place.
- **Background:** The list below gives the facts.
  - Mokly bills workspaces through Stripe Checkout and the Customer Portal. The billing plan's post-merge task asked to enable Stripe Tax with the required registrations.
  - On 2026-10-30 the operator set up the Customer Portal, Stripe Tax and the production webhook in both modes.
  - On that date the operator saw Stripe Tax active with a GB head office and no registration, so Checkout added no tax. That is a dated observation, not the current account state.
  - On 2026-10-30 the user chose to leave the registrations for now. That choice is a decision, not an open question, and it approves no registration.
  - Checkout still requests automatic tax and a billing address, in `crates/mkc-api/src/billing/checkout_input.rs:28-44`.
  - Nobody has established where Mokly owes tax.
- **Task:** When the owner reopens this task, read the current registrations of both modes. Then decide where Mokly must collect tax. Add each registration in Stripe Tax. Then confirm that a test-mode Checkout from a registered place shows the tax line.
- **Impact if no action:** If Mokly must collect tax in a place without a registration, Checkout collects none there. Later corrections then need back-dated tax work, so Harder later applies only after taxable sales.
- **Needs:** The owner's decision on the places of registration, and admin access to the Stripe account.
- **Done when:** Stripe Tax holds every required registration, and the billing runbook and the Billing section of `docs/ops/production.md` record them.

The user's choice of 2026-10-30 stays in force until the owner decides the registrations. Do not add them without that decision.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/billing.md?plain=1#L1090-L1106) of the deleted plan.
