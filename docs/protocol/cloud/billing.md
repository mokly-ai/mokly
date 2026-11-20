# Billing

Billing puts every workspace on a plan and lets its owners pay for Team
through Stripe. This document owns the plan catalogue, seat counting, the
billing roles, and the copy each billing state shows.
[Billing plan gates](./billing-plan-gates.md) owns the writes a plan gates and
the downgrade; [Billing subscriptions](./billing-subscriptions.md) owns the
subscription shape, the trial, the Stripe Checkout and Portal flows, and the
configuration. Entities and roles are in
[Platform model](./platform-model.md); the HTTP surface is in
[REST API](./rest-api.md) and the [OpenAPI document](../../api/openapi.json);
the pane is in [Settings dialog](./settings-dialog.md). Tables are in
[Persistence boundaries](./persistence-boundaries.md).

## Plan Catalogue

This table is the one source of truth for plans, seat kinds, prices and the
trial. Prose never repeats a value the table carries.

| Plan   | For                           | Projects       | Seats                                            | Price                                                 |
| ------ | ----------------------------- | -------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `free` | Open-source catalogues        | Public only    | Unlimited                                        | Free                                                  |
| `team` | Teams with private catalogues | Public/private | Editor and Collaborator, billed monthly per seat | Editor `2000` USD cents, Collaborator `500` USD cents |

| Setting            | Value               |
| ------------------ | ------------------- |
| Billing interval   | `month`             |
| Usage type         | `licensed`          |
| Currency           | `usd`               |
| Trial              | `7` days, once      |
| Stripe API version | `2026-08-26.dahlia` |

New workspaces start on `free`, except for the configured preview account
when `MKC_PREVIEW_SIGN_IN_PLAN=team`. This optional setting accepts `free` and
`team`, defaults to `free`, and requires the preview sign-in secret, email and
capability. [Preview sign-in](./auth-sessions.md#preview-sign-in) defines its
validation. The API compares the creator's normalized email from the creation
transaction with `MKC_PREVIEW_SIGN_IN_EMAIL`. Only a match uses this initial
plan. Existing workspaces keep their plan; only billing changes it after
creation. The preview Team workspace has no subscription. Its new projects
default to private and private uploads are allowed by the existing entitlement
rules in [Billing plan gates](./billing-plan-gates.md). Seat counting is unchanged.

Stripe product and price identity is defined in the [Stripe billing catalogue](./billing-catalogue.md#identity).

Prices are tax-exclusive; Stripe Tax adds tax at Checkout. Customers pay in
USD; the Stripe account settles in its own default currency and the cloud
never sees or shows the converted amount. There is no annual price.

## Seats

A seat kind is derived from role and is never a separate setting. Owners,
admins and members occupy Editor seats; reviewers occupy Collaborator seats.
A direct project grant occupies a seat the same way: admin and member are
Editors, reviewer is a Collaborator. One user occupies one seat per
workspace, the stronger kind when they hold several roles across the
workspace and its projects. Pending invitations occupy no seat. A seat kind
chosen apart from role was rejected: the role already separates administering
and publishing from reading, so a second setting would have no permission
behind it until review features land.

The seat count is read inside the same transaction as the write that changes
it. It counts distinct active users with a workspace membership or a
direct grant in that workspace, grouped by derived kind. It never counts an
invitation, a user twice, or a grant whose project belongs to another
workspace.

Inviting a member on Team names the seat it adds and its monthly price beside
the control. A project-grant control will name the seat and monthly price the
same way when one exists.

## Roles

| Action                                       | Owner | Admin | Member | Reviewer |
| -------------------------------------------- | ----- | ----- | ------ | -------- |
| Read billing status, seats and renewal facts | Yes   | Yes   | No     | No       |
| Start Checkout, open the Customer Portal     | Yes   | No    | No     | No       |

Members and reviewers see the plan name as a fact on the Workspace pane
and do not see the Billing pane.

## Copy

| State                      | Headline and action                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Free plan                  | "Free for open-source catalogues" · **Upgrade to Team**                                                           |
| Team                       | Seats in use and the monthly total · **Manage billing**                                                           |
| Trial                      | "Team until <date>, then billed monthly" · **Manage billing**                                                     |
| Confirming after Checkout  | "Confirming your subscription…"                                                                                   |
| Confirmation delayed       | "Still confirming your subscription" · **Check again**                                                            |
| Billing read failed        | "Billing couldn’t load" with its reference · **Try again**                                                        |
| Payment failed             | "Payment failed" · **Update payment method** (opens the Portal)                                                   |
| Ending                     | "Team ends <date>" · **Manage billing**                                                                           |
| Billing unavailable        | "Billing opens soon"                                                                                              |
| Unverified price           | Team section without amounts · **Upgrade to Team** · **Pricing** link                                             |
| Admin reads                | "An owner manages billing." beside the facts, with no action                                                      |
| Private visibility on free | "Private projects are on Team" · owner: **Open billing**; others: "Ask an owner to upgrade to Team."              |
| Private upload on free     | "Publishing to private projects is on Team" · owner: **Open billing**; others: "Ask an owner to upgrade to Team." |
| Delete workspace on Team   | Confirmation adds "This ends Team now; the remaining days are not refunded"                                       |

Copy follows [Product copy](./product-copy.md): the outcome, then the one
action, and Stripe, price identifiers and subscription statuses stay out of
headline text.

Related: [Billing plan gates](./billing-plan-gates.md),
[Billing subscriptions](./billing-subscriptions.md),
[Billing workers](./billing-workers.md), [Stripe billing catalogue](./billing-catalogue.md),
[Stripe billing catalogue operations](./billing-catalogue-operations.md),
[Platform model](./platform-model.md), [REST API](./rest-api.md),
[Settings dialog](./settings-dialog.md), [Persistence](./persistence-boundaries.md),
[Publication ingest](./publication-ingest.md), [Site](./site.md).
