# Main-preview billing smoke has no recorded result

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/billing.md` and `plans/stripe-catalogue-sync.md`, on the branch `calummoore/plans-skill-update`. On 2026-10-31 the validity audit merged the duplicate item `stripe-archive-dry-run-not-run.md` into it. On 2026-11-01 the merge of `main` into `calummoore/maseru` merged the duplicate items `billing-walkthrough-not-run.md` and `catalogue-archive-dry-run-not-run.md` into it.
- **Location:** `docs/ops/billing-smoke.md`, `docs/ops/deploy.md`, `xtask/src/stripe_catalogue/archive.rs` and `docs/protocol/billing-catalogue-operations.md`.
- **Reason:** The smoke needs the deployed `main-preview` with billing on and the Stripe test mode, not a branch checkout.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify whether the smoke ran. The repository holds no dated result of a complete live walk, and the audit read no Stripe state.

- **Terms:**
  - **Billing smoke:** The end-to-end procedure in `docs/ops/billing-smoke.md`: price verification, Checkout, webhooks, seats, the Portal and plan gates.
  - **Catalogue sync:** `cargo xtask stripe-catalogue sync`, which creates and checks the Stripe products and prices that the plans sell.
  - **Archive command:** `cargo xtask stripe-catalogue archive`, the optional manual command that archives superseded prices after a rollout.
- **Background:**
  - On 2026-10-30 the operator added the `main-preview` test-mode secrets and catalogue key and enabled billing there.
  - On 2026-10-30 one deploy created the test catalogue, and the next deploy reported every object `validated`.
  - The Billing Activation section of `docs/ops/deploy.md` records the `main-preview` Stripe objects, the deploy runs and the webhook checks of 2026-10-30. It says that the walkthrough has not run.
  - The user chose on 2026-10-30 to enable production billing before this smoke.
  - The user decided on 2026-09-27 to remove the automatic archive jobs. `archive` stays an optional manual command with a 24-hour hold. No deployment job runs it.
  - The first step of the smoke shows that the API verifies both prices. The plans sell one price for each of the two seat kinds.
  - The catalogue step of the smoke runs `archive` without `--apply`. This dry run must report one `current` line per seat and nothing else.
  - The catalogue validation and the deployment smoke do not prove Checkout, the Portal, seats, payments or the failure paths.
  - The repository records no complete live walk. An absent record does not prove that nobody ran it.
- **Task:**
  1. Run `docs/ops/billing-smoke.md` end to end on `main-preview`, with the failure and cancellation paths. Or collect the dated result of an earlier complete run.
  2. In the catalogue step, run `cargo xtask stripe-catalogue archive --environment main-preview` without `--apply`. Confirm that it lists both current prices and nothing to archive.
  3. Record the date, the workspace and Stripe object identifiers, and the result of each step in the Billing Activation section of `docs/ops/deploy.md`. Replace its sentence that says the walkthrough has not run.
- **Impact if no action:** A billing defect that only real Stripe shows can reach production customers first. The first real use of `archive` happens without a proof that it keeps the current prices.
- **Needs:** The `main-preview` environment with billing on, Stripe test-mode access, a test card, and a restricted test-mode catalogue key. Only the deploy identity can read the stored key version, so create a temporary key with the same permissions and delete it after the dry run. Do not use `--apply` for the archive proof. The paired Stripe CLI (`stripe ... -p mokly`) can do the Stripe-side steps of the smoke, such as ending a trial early or attaching a failing card. Step 6 also needs the `main-preview` API logs.
- **Done when:** `docs/ops/deploy.md` records a dated complete billing smoke, and its archive dry run lists both current prices and nothing to archive.

Before the merge, the archive item graded its dry run Low severity and Small effort (estimate).

Source: [the billing post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/billing.md?plain=1#L1090-L1106) and [the catalogue sync post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/stripe-catalogue-sync.md?plain=1#L548-L569) of the deleted plans.
