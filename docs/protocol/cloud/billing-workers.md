# Billing Workers

This document owns Stripe webhook acceptance and reconciliation, seat
reconciliation, delivery retry, and the way the workers use verified prices.
[Billing](./billing.md) owns the plan catalogue, seat model, roles, and product
copy; [Billing plan gates](./billing-plan-gates.md) owns the plan-gated writes;
[Billing subscriptions](./billing-subscriptions.md) owns the subscription
shape, Checkout and Portal flows, and configuration; the
[Stripe billing catalogue](./billing-catalogue.md#runtime-resolution) owns
startup price verification.

## Webhooks

`POST /v1/billing/webhooks` is session-independent and has no CSRF or Origin
requirement. The router requires exactly one `Stripe-Signature` header and
reads at most 2 MiB; a missing or repeated header returns `validation-failed`,
as the GitHub route treats its headers. The header is `t=<unix seconds>`
followed by one or more `v1=<64 hex>` signatures, comma separated; other
schemes such as `v0` are ignored. Compute HMAC-SHA256 of `<t>.<raw body>` with
the configured secret and accept the delivery when `t` is within five minutes
of now and any `v1` value equals the result under constant-time comparison.
Stripe signs with two secrets while a rolled secret's predecessor is still
active, so one matching `v1` suffices. A header with no `t` or no `v1`, a
non-numeric or stale `t`, a `v1` that is not 64 hex characters, or no matching
`v1` returns `webhook-signature-invalid`. Verify before decoding or writing
anything.

Commit the original body, the Stripe event ID, the event type and the receive
time before 202. A duplicate event ID with identical bytes returns 202 without
duplicate effects; mismatched reuse returns `validation-failed`. Unknown event
types are stored, acknowledged and marked ignored, and so is a known event
whose customer the cloud does not know, which is how the deliveries that
follow a workspace's deletion settle. Malformed known events are retained
and marked failed.

| Event                           | Durable effect                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| `checkout.session.completed`    | Bind the customer and subscription to the workspace named in the session |
| `customer.subscription.created` | Reconcile the subscription, its items and the plan                       |
| `customer.subscription.updated` | Reconcile the subscription, its items, the plan and the ending date      |
| `customer.subscription.deleted` | Reconcile to `canceled`; the plan becomes `free`                         |
| `invoice.paid`                  | Clear the payment-failed fact                                            |
| `invoice.payment_failed`        | Record the payment-failed fact                                           |

Every handler verifies the provider object ID against the ID already bound to
the workspace before writing. Subscription reconciliation checks staleness
before the live-binding conflict guard: an event older than the stored provider
update is completed without changing the binding. When a current event names a
different subscription while the bound subscription is live, the live binding
is retained and the delivery is failed as `conflict`; a non-live binding may be
replaced. A replacement starts with no payment-failure fact or payment ordering
timestamp from the previous provider subscription.

Handlers that retrieve the current subscription expand its items and latest
invoice. Subscription facts reject events older than their provider update
time. Payment facts use an independent provider event time, and an
equal-second invoice event is still applied; its paid or failed value comes
from the canonical latest invoice rather than the event name. Delayed,
out-of-order, or equal-second delivery cannot regress either state.

Retry transient, rate-limited and internal failures up to eight attempts with
delays `5, 10, 20, 40, 80, 160, 320` seconds, honoring a longer provider retry
delay. A provider refusal Stripe will repeat (an HTTP 400, 401, 403, 404 or
422 response) and a conflicting live subscription are retained after one
attempt with their typed failure.

Exhausted deliveries stay inspectable by event ID with a typed failure and are
requeued with `mkc-api requeue-billing-delivery --event <id>`.

## Seat Reconciliation

Once per minute, one bounded pass examines the least recently checked live
subscriptions, so successive passes rotate through the complete live set. The
pass compares each workspace's seat counts with the item quantities Stripe
last reported and adds, updates or removes a kind's item so the subscription
matches.

Before a provider write, one durable command per workspace and seat kind
records the create, update or delete operation and every provider parameter.
Its key is `seats:{workspace}:{kind}:{command_id}`. At most one worker
executes a command at a time.

A success or outcome-unknown response retains the exact command and makes it
due one hour later until a webhook confirms its requested quantity. Rate limits
retain it until at least the provider's retry time. A changed desired count
waits behind that command; once reconciliation confirms or removes it, the next
pass reserves a fresh command for the newest count. A worker that lost its
claim cannot overwrite its successor's outcome. Create and update are Stripe
`POST` requests and reuse the command key. Stripe ignores idempotency keys on
`DELETE`, so deletion sends none; a missing item on a repeated deletion means
the requested state is already complete. Proration follows the subscription's
Stripe default. The seat worker never changes the workspace's plan.

A create command Stripe refuses as invalid (an HTTP 400 or 422 response) is
deleted, so the next pass can reserve a fresh command with the current
verified price. Every other failure keeps the retry behavior above.

## Price Integrity

Startup verification of both catalogue prices is defined in
[Runtime Resolution](./billing-catalogue.md#runtime-resolution). A verified
price records its `price_` identifier as that seat kind's verified identity;
an unverified price stays unverified until restart.

The mapping order is the embedded price's recognized `lookup_key`,
equality with a verified price identity, the embedded price's
`metadata[mokly_seat_kind]` naming a catalogue seat kind, then the seat kind
already stored for that provider item ID. No match is malformed. Superseded and
archived prices retain the metadata, so a delayed first webhook for a
subscription sold before a replacement still reconciles.

Seat reconciliation updates or removes an existing item regardless of which
price it carries and uses the verified identity only when adding a kind's item.
Seat commands compare existing state by seat kind and provider item, not price
identity, so a subscription on a replaced price keeps reconciling.

The pane offers Upgrade without an amount and links the site's pricing page
rather than showing a number Stripe would not charge when a catalogue price is
unverified. Verified identities are the only ones Checkout and price-bearing
seat writes use. If either price is unavailable, neither writer runs; webhook
reads, Portal sessions and cancellation still recover existing subscriptions.
Checkout availability and its refusal reasons are defined in
[Checkout And Portal](./billing-subscriptions.md#checkout-and-portal), and
Stripe identity is defined in the
[Stripe billing catalogue](./billing-catalogue.md).
