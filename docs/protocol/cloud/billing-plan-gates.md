# Billing Plan Gates

This document owns the writes that a workspace's plan gates and what
happens when a Team workspace returns to `free`. The plan catalogue, seat
counting, roles, and copy are in [Billing](./billing.md); the subscription
shape, plan derivation, Checkout, Portal, and configuration are in
[Billing subscriptions](./billing-subscriptions.md).

## Plan-Gated Writes

The plan gates project creation, a visibility change, an upload, a build
request and Checkout, and workspace deletion ends a live subscription. Every
check reads the workspace's current plan, and a plan change never races a
gated write: the write observes the plan either before or after the change.

| Write                                       | On `free`                                                | On `team`            |
| ------------------------------------------- | -------------------------------------------------------- | -------------------- |
| Create project                              | Created `public`; there is no visibility input on create | `private` by default |
| Change project visibility to `private`      | Refused with `plan-required`                             | Allowed              |
| Upload a publication to a `private` project | Refused with 403 `upload-plan-required` before the body  | Allowed              |
| `requestBuild` for a `private` project      | Refused with `plan-required`                             | Allowed              |
| Start Checkout with a live subscription     | Refused with `subscription-active`                       | Same                 |
| Delete a workspace with a live subscription | Cancels the subscription at Stripe, then deletes         | Same                 |

`plan-required` is `failed-precondition` 400 with
`data: {requiredPlan: "team", feature: "private-projects"}`. For a visibility
change, it is reported inside the visibility modal through the write-failure
composition, immediately above the **Make private** confirmation. An owner
gets **Open billing**, which leaves the modal for the Billing pane; everyone
else gets “Ask an owner to upgrade to Team.”
Invitations, grants and project counts are not limited on either plan.
Publication retention does not depend on the plan.

A live subscription is one whose status is `trialing`, `active` or
`past_due`; one that is ending (`cancel_at_period_end`) stays live until its
period ends. `subscription-active` is `failed-precondition` 400 with no data
and is returned only by Checkout.

Deleting a workspace with a live subscription first cancels that
subscription at Stripe immediately, with an idempotency key; a subscription
Stripe already reports as canceled counts as done. The remaining days are not
refunded, and the confirmation names that consequence. A failed provider call
returns `unavailable` and deletes nothing; with billing unconfigured the
deletion returns `operation-unavailable`. A subscription that becomes live
after that cancellation and before the deletion commits also returns
`unavailable`, and nothing is deleted. Refusing the deletion until a Portal
cancellation ends was rejected, because the Portal cancels at period end and
would hold the owner for up to a billing period. The customer record stays at Stripe
and carries no subscription; the deliveries Stripe then sends for it are
marked ignored, as the [worker contract](./billing-workers.md#webhooks)
defines.

## Downgrade

When a Team workspace returns to `free`, nothing is deleted or made public:
private projects stay private and their existing publications stay readable to
the people who could read them. New uploads to a private project are refused
with `upload-plan-required`, which the CLI reports through its existing 403
category. The project's viewer stage and the Workspace pane name the
situation, give an owner the way to Billing and everyone else one sentence to
ask an owner. Public projects are unaffected.

Related: [Billing](./billing.md),
[Billing subscriptions](./billing-subscriptions.md),
[Billing workers](./billing-workers.md),
[Publication ingest](./publication-ingest.md),
[Settings dialog](./settings-dialog.md), [Viewer chrome](./viewer-chrome.md).
