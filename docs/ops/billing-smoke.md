# Billing smoke procedure

The automated smoke uses native Postgres, a running API and a loopback Stripe
HTTP double with recorded responses. A live run uses the Stripe account's test
mode; this runbook records the operator inputs and expected evidence.

## Deployed inputs

Stable releases enable the chart with `billing.enabled: true`; PR releases keep
billing disabled. The release renderer reads this switch from the environment's
`MKC_*_APP_CONFIG` JSON and places the validated object in `values.json`:

```json
{
  "billing": {
    "enabled": true
  }
}
```

The API resolves the price identifiers from catalogue lookup keys.
The API mounts the environment's `mkc-<environment>-stripe-secret-key` and
`mkc-<environment>-stripe-webhook-secret` Secret Manager IDs through CSI; the
secret values never enter Helm values.

After rollout, the deployment smoke runs `billing-webhook-unsigned` and
`billing-webhook-forged` against `/v1/billing/webhooks`. They prove the final
400 `validation-failed` and 401 `webhook-signature-invalid` contracts. An
unconfigured environment, including every PR preview, answers 503
`operation-unavailable`; the smoke accepts only that reason for the 503 case.

## Account

The Stripe account is `acct_1UI7K0POK3tj6dqE`. `main-preview` uses its test
mode and production its live mode. Pair the Stripe CLI under its own profile
so another account's login is left alone:

```sh
stripe login --project-name mokly
stripe get /v1/account -p mokly
```

The account's default API version is the pinned `Stripe-Version` in
[Billing](../protocol/cloud/billing.md#plan-catalogue). Prices are created in USD;
the account settles in its default currency and no cloud setting depends on it.
The default currency stays GBP, and Stripe converts each USD payment. A USD
default would need a USD bank account, and Stripe would add a 1% settlement fee
and a $250 payout minimum.

Checkout enables automatic tax, so set up Stripe Tax in each mode with the head
office address. Stripe collects tax only where the account has a registration;
with no registration, Checkout adds no tax. The catalogue sets no product tax
code, so Stripe Tax uses the account's default tax code, `txcd_10103001`.

An explicit stable database reset deletes Mokly's billing rows but retains the
Stripe catalogue, customers and subscriptions. Remove unwanted provider-side
test objects separately before reusing a reset environment; never treat the
database reset as Stripe cleanup.

## Keys And Secrets

Each stable environment uses three Stripe values from its own mode. Create each
restricted key on the Dashboard's API keys page in that mode, start from no
permissions, and set every resource that the table does not name to None:

| Secret ID suffix        | Value                                  | Permissions                                                                                            |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `stripe-catalogue-key`  | Restricted key for the catalogue sync  | [Key Per Environment](../protocol/cloud/billing-catalogue-operations.md#key-per-environment)           |
| `stripe-secret-key`     | Restricted key for the API             | Customers, Checkout Sessions, Customer Portal and Subscriptions Write; Prices, Products, Invoices Read |
| `stripe-webhook-secret` | Signing secret of the webhook endpoint | None                                                                                                   |

The API reads each price with its product and each subscription with its latest
invoice, so its key needs Products and Invoices read. It never writes prices.
Stripe shows a new key once. On macOS, copy it and add it as a version without
printing it, then clear the clipboard:

```sh
pbpaste | gcloud secrets versions add mkc-<environment>-stripe-secret-key \
  --project mokly-508518 --data-file=-
pbcopy </dev/null
```

Editing a key's permissions keeps its value, so a stored version stays valid.
[Secrets](./secrets.md) gives the rotation.

## Customer Portal

The API opens Portal sessions without naming a configuration, so Stripe uses
the default configuration of the mode. Only a save on the Dashboard's Customer
Portal settings page creates that default. Save it once in each mode:

| Setting                                      | Value                                          |
| -------------------------------------------- | ---------------------------------------------- |
| Payment methods                              | Customers can update them                      |
| Customer information                         | Name, email, address and phone                 |
| Invoice history                              | Shown                                          |
| Cancellation                                 | At the end of the billing period, no proration |
| Plan switching, quantity changes and pausing | Off, because Mokly sets the seat quantities    |
| Login link                                   | On                                             |

Then, in the Checkout and Payment Links settings, turn on **Limit customers to
one subscription** with the redirect to the Customer Portal. Stripe keeps it on
only while the Portal login link is on, and no API reads it, so confirm it in
the Dashboard. Mokly's persisted session boundary prevents two open sessions
locally; Stripe's redirect is defense in depth if an external or
operator-created session already produced a live subscription.

Read the default back and confirm that `is_default` and `login_page.enabled`
are true. Add `--live` for live mode:

```sh
stripe get /v1/billing_portal/configurations -p mokly
```

## Catalogue Sync

Stable promotion runs the catalogue sync in apply mode from the reviewed
release values before each billing-enabled rollout. A disabled environment
completes this stage without reading a Stripe key. The
[sync contract](../protocol/cloud/billing-catalogue-operations.md#sync) gives the
report forms and the success rule.

Deployment does not run the catalogue archive command. It remains an optional
operator clean-up after a successful rollout.

For a workstation run, create the catalogue key as
[Keys And Secrets](#keys-and-secrets) shows. Before you store it, put it in
`MKC_STRIPE_CATALOGUE_KEY` on a secure workstation without printing it, then
run:

```sh
cargo xtask stripe-catalogue sync --environment main-preview
cargo xtask stripe-catalogue sync --environment main-preview --apply
cargo xtask stripe-catalogue sync --environment main-preview --apply
```

The first run is a dry run, the second applies, and the third must report the
product and both prices `validated`. Then run:

```sh
cargo xtask stripe-catalogue archive --environment main-preview
```

This dry run must report one `current` line per seat and nothing else.

After the rollout that made the current prices live has succeeded, optionally
apply the clean-up by hand:

```sh
cargo xtask stripe-catalogue archive --environment main-preview --apply
```

Never run it while a deploy is running. It is safe to omit; the
[archive contract](../protocol/cloud/billing-catalogue.md#archive) owns the retention
reasoning.

Confirm the product and price lookup keys in the Dashboard, then record their
identifiers in [Deployment](./deploy.md). Use `production` only with its
live-mode key. The complete command contract is [Stripe billing catalogue
operations](../protocol/cloud/billing-catalogue-operations.md#command).
Restart the API and confirm it resolves and verifies both lookup keys; Checkout
stays unavailable while either active price is missing or differs from the
catalogue.

## Webhook Endpoint

Register `<api-origin>/v1/billing/webhooks` in the same mode with Snapshot
payloads, the pinned API version from
[Billing](../protocol/cloud/billing.md#plan-catalogue) and exactly the event types
in the [webhook contract](../protocol/cloud/billing-workers.md#webhooks). Do not add
`customer.subscription.paused`: a subscription pauses only when a trial ends
without a payment method, which Checkout prevents, and the status change also
arrives as `customer.subscription.updated`. Store the endpoint's signing secret
as the environment's `stripe-webhook-secret`, as
[Keys And Secrets](#keys-and-secrets) shows. Roll the API after adding
versions.

In test mode, the paired CLI can create the endpoint with
`stripe post /v1/webhook_endpoints -p mokly` and the fields above. Only the
create response holds the secret, so pipe it straight into
`gcloud secrets versions add`. The CLI's live-mode key cannot create webhook
endpoints, so create the live endpoint in the Dashboard under Workbench →
Webhooks → Add destination, then copy its signing secret.

For a local run, forward test events to the development API instead:

```sh
stripe listen -p mokly --forward-to http://127.0.0.1:8080/v1/billing/webhooks
```

## Walkthrough

Run each step as an owner of a `main-preview` workspace and record the UTC
time, workspace ID and Stripe object IDs in `docs/ops/deploy.md`:

1. Open Settings → Billing on a free workspace; it offers Upgrade to Team
   with both seat prices. Start Checkout; Stripe shows the trial and
   collects a test card (`4242 4242 4242 4242`). Complete it and confirm the
   pane returns through `?checkout=success`, shows the confirming state, and
   then reads Team with the trial end date once the webhook lands. Before
   completing, press Upgrade again in another tab and confirm both presses
   return the same open Checkout session; change a member and confirm another
   press still returns that session rather than opening one with new inputs.
2. Invite a reviewer and confirm the seat sentence beside Invite names a
   Collaborator seat; confirm in Stripe that the subscription gains the
   Collaborator item at quantity one within the reconciliation interval.
3. Make a project private and publish to it with the CLI; both succeed.
4. In Stripe, end the trial early and attach a failing test card
   (`4000 0000 0000 0341`) so the first invoice fails; confirm the pane shows
   Payment failed with Update payment method, and that the plan stays Team.
5. Open the Portal, cancel at period end, and confirm the pane shows Team ends
   with the date. In Stripe test mode, advance the clock or cancel
   immediately; confirm the workspace returns to `free`, the private
   project stays private, and a CLI publish to it is refused with 403.
6. Force one delivery to dead-letter by making subscription retrieval return a
   persistent provider outage until all eight attempts are exhausted; inspect
   it by event ID, then requeue it with
   `mkc-api requeue-billing-delivery --event <id>` and confirm it settles as
   done once provider access is restored. A permanent provider refusal is
   retained after its first attempt.
7. Send a `POST` with a forged `Stripe-Signature` (a current `t` and a wrong
   64-hex `v1`) and confirm 401 `webhook-signature-invalid` with no queue row;
   send one without the header and confirm 400 `validation-failed`.
8. Create a second workspace, start Checkout and complete it, then delete
   the workspace with its name and version; confirm Stripe shows the
   subscription canceled immediately and that the deliveries it sends afterwards
   are marked ignored.

Use only Stripe test cards and test-mode objects; never enter a real card in
`main-preview`.
