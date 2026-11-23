# Billing Subscriptions

This document owns the Stripe subscription shape, how the plan derives from
the subscription, the trial, the Checkout and Portal flows, and the billing
configuration. The plan catalogue, seat counting, roles, and copy are in
[Billing](./billing.md); the writes a plan gates are in
[Billing plan gates](./billing-plan-gates.md); webhook processing and seat
reconciliation are in [Billing workers](./billing-workers.md).

## Subscription Shape And Plan Derivation

One Stripe customer and at most one Stripe subscription per workspace. The
subscription has at most two items, one per seat kind. Checkout and newly added
items use that kind's
[catalogue-resolved price](./billing-catalogue.md#runtime-resolution); existing
items can remain on a historical price as
[Price Integrity](./billing-workers.md#price-integrity) defines. Checkout carries
the Editor item at the live Editor count and the Collaborator item only when that
count is positive. Under the pinned API version the billing period lives on the
items, not the subscription, so the current period end is read from the items,
which share one period.

The plan derives only from the subscription status Stripe reports; the
[architecture doc](../../architecture/cloud-data-flows.md#billing) names the worker that applies
it:

| Subscription status                                                | Plan   |
| ------------------------------------------------------------------ | ------ |
| `trialing`, `active`, `past_due`                                   | `team` |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` | `free` |

A status outside this table is a malformed known event: the delivery is
retained and marked failed and the plan is left unchanged. `past_due` keeps
Team and shows the payment-failed state, whose one action opens the Portal.
`cancel_at_period_end` shows the date Team ends. Stripe's own emails carry
receipts, trial-ending and failed-payment notices; the cloud sends no billing
mail.

### Trial

Checkout for a workspace that has never trialed starts the trial in the
catalogue with the payment method collected up front. Binding the subscription
that the session produced consumes the trial even when a delayed delivery
first observes it as `active`; an abandoned session does not. When the trial
ends Stripe charges the payment method; a failure follows the `past_due` rules
above.

## Checkout And Portal

`POST /v1/workspaces/{workspaceId}/billing/checkout` (owner) creates the
customer when absent, then a Checkout session in `subscription` mode with the
trial when eligible, automatic tax with billing-address collection saved to
the customer, the line items above, `client_reference_id` and metadata naming
the workspace and the Checkout request, and the composed return URLs. It
returns the session URL; a later press reuses that exact request and URL until
its one-hour provider expiry, so two payable sessions never overlap. `POST
/v1/workspaces/{workspaceId}/billing/portal` (owner) creates a Customer
Portal session and returns its URL.

The cloud never handles card data. Stripe-hosted Checkout collects the payment
method, and the Stripe-hosted Customer Portal holds payment methods, invoices,
receipts and cancellation. The app renders no payment form and lists no
invoices.

Return URLs are composed by the API from `MKC_APP_ORIGIN`; the client never
supplies one:

| Return        | URL                                                                  |
| ------------- | -------------------------------------------------------------------- |
| Checkout done | `<app origin>/{workspaceSlug}/-/settings/billing?checkout=success`   |
| Checkout left | `<app origin>/{workspaceSlug}/-/settings/billing?checkout=cancelled` |
| Portal return | `<app origin>/{workspaceSlug}/-/settings/billing`                    |

A return URL never changes the plan. The success landing shows the confirming
state and re-reads billing until a read reports Team or a bounded wait of
thirty seconds ends. The
[Settings dialog](./settings-dialog.md#history-and-entry-points) defines the
deadline of that wait and the states that follow it. After a read that reports
Team, switching panes or closing settings uses the reconciled plan without a
page reload. The cancelled landing is the pane as it was.

The desktop app's window opens Checkout in the system browser, so the return
lands there, not in the window. The window's first focus after it opened
Checkout re-reads billing every two seconds until a read reports Team or the
same thirty seconds pass. It shows no confirming state, and a failed read ends
the wait with the pane's ordinary read. Any other focus re-reads billing once.

Decision: the window waits for the webhook on its next focus, because a reader
who comes back first would read Free and could press **Upgrade to Team** again.
A return from Stripe into the window was rejected, because it needs an API
field, a second `mokly://` address and an operating-system prompt.

`GET /v1/workspaces/{workspaceId}/billing` (owner, admin) returns the
plan, both seat kinds' counts in use with their verified unit amounts, the
subscription facts (status, trial end, the items' current period end, ending),
whether the caller can manage billing, and `checkoutAvailable`. Every value
comes from the database or the verified catalogue; the pane computes the
monthly total from the returned counts and amounts. `checkoutAvailable` is
true only when both catalogue prices are verified and no subscription is live.
Checkout is refused with `operation-unavailable` when price verification is
unavailable, and with `subscription-active` when a live subscription makes
Checkout unavailable. Seat writes use the same verified price identities;
failed verification starts neither Checkout nor the seat worker. Webhook
recovery, Portal access and subscription cancellation remain available.

Webhook processing and seat reconciliation are defined in
[Billing workers](./billing-workers.md); startup price verification is defined
in the [Stripe billing catalogue](./billing-catalogue.md#runtime-resolution).

## Configuration

| Setting                     | Meaning                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `MKC_BILLING`               | `stripe` enables billing; unset disables every billing operation      |
| `MKC_STRIPE_SECRET_KEY`     | Restricted or secret key for the account's test or live mode          |
| `MKC_STRIPE_WEBHOOK_SECRET` | Signing secret of the registered webhook endpoint                     |
| `MKC_STRIPE_API_ORIGIN`     | Defaults to `https://api.stripe.com`; loopback only under development |

When `MKC_BILLING` is unset the four billing operations return
`operation-unavailable`, the Billing pane says billing opens soon where it
says the same for GitHub, and the free plan's rules still apply except for
workspaces created by the preview account with `MKC_PREVIEW_SIGN_IN_PLAN=team`.
Those workspaces use Team entitlements without a subscription; the Billing
pane still reads “Billing opens soon”. When it is `stripe`, the secret key and
webhook secret are required, while prices
[resolve by lookup key](./billing-catalogue.md#runtime-resolution).
Validation fails before startup otherwise; secrets never appear in configuration
errors. PR preview environments run unconfigured. Every Stripe request sends the pinned
`Stripe-Version` from the catalogue, a bearer key, and on every write an
`Idempotency-Key`, except subscription-item `DELETE`, for which Stripe ignores
that header. The customer key derives from the workspace and the cancellation
key from the subscription, so a retried create or cancel replays one result. A
Checkout key derives from the identity of its Checkout request. The exact
stored request is replayed after an outcome-unknown response, provider success
that could not be recorded, or another press. A definite refusal (an HTTP 400,
401, 403, 404, 422 or 429 response) removes only that same uncompleted request
so a later press can reserve a new one. Permission denial does not change any
API HTTP response.

A stored provider session is returned without another provider call. It is
replaced only after the exact `expires_at` instant or when its resulting
subscription binds. Portal session keys are unique per request.

Related: [Billing](./billing.md), [Billing plan gates](./billing-plan-gates.md),
[Billing workers](./billing-workers.md), [Stripe billing catalogue](./billing-catalogue.md),
[REST API](./rest-api.md), [Settings dialog](./settings-dialog.md),
[Persistence](./persistence-boundaries.md).
