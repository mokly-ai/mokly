# Stripe Billing Catalogue

This contract owns the Stripe identity of Mokly's plan catalogue, its reconciliation,
and runtime lookup-key resolution. [Billing](./billing.md) owns plans, prices,
the trial, and the pinned Stripe API version; [Billing workers](./billing-workers.md)
owns webhook and seat reconciliation; and [Infrastructure promotion](./infrastructure-promotion.md)
owns release ordering. The [catalogue operations contract](./billing-catalogue-operations.md)
owns commands, deployment jobs, credentials, failures, and the operator procedure.
Operators use [Billing smoke](../../ops/billing-smoke.md), [Secrets](../../ops/secrets.md),
and [Deployment](../../ops/deploy.md).

## Identity

| Plan   | Product lookup key | Product name | Seat kind      | Price lookup key                    | Price nickname      |
| ------ | ------------------ | ------------ | -------------- | ----------------------------------- | ------------------- |
| `team` | `mokly_team`       | `Mokly Team` | `editor`       | `mokly_team_editor_usd_month`       | `Editor seat`       |
| `team` | `mokly_team`       | `Mokly Team` | `collaborator` | `mokly_team_collaborator_usd_month` | `Collaborator seat` |

| Identity setting     | Value                                       |
| -------------------- | ------------------------------------------- |
| Product metadata key | `mokly_lookup_key`                          |
| Price metadata key   | `mokly_seat_kind` (`editor`/`collaborator`) |
| Tax behavior         | `exclusive`                                 |
| Key grammar          | `^mokly_[a-z0-9_]+$`                        |

Keys are unique by identity across the table; repeated `mokly_team` cells refer
to one product, and the free plan has no Stripe object. Stripe products have no
lookup key, so product identity is `metadata[mokly_lookup_key]`; price identity
is Stripe's `lookup_key`.

The typed catalogue, these tables and Billing's tables are the one source of
the catalogue. A separate JSON catalogue file was rejected, because it would be
a second source.

## Owned Objects And Written Fields

For a product, the sync owns `name`, `active=true`, and
`metadata[mokly_lookup_key]`. For a price, it owns `product`, `currency`,
`unit_amount`, `recurring[interval]`, `recurring[usage_type]`, `tax_behavior`,
`lookup_key`, `nickname`, and `metadata[mokly_seat_kind]`. Every price create
also sends `transfer_lookup_key=true`, so an existing holder cannot block the
key. Creates and product updates send the complete applicable list; price
updates send both `nickname` and `metadata[mokly_seat_kind]`. Unrelated metadata
remains intact.

A replacement create writes every owned price field and also
`metadata[mokly_replaces]=<old-price-id>`. That link is written only when a
replacement is created; reconciliation never compares or updates it later.
`sync` never sends `active=false`; only `archive` does, and its archive update
contains no other field.

The sync never deletes an object or changes customers, subscriptions, subscription items,
invoices, webhook endpoints, Stripe Tax settings, or Customer Portal
configuration. Existing subscriptions keep their price after a replacement.
The old price remains active after replacement because running processes,
stored Checkout requests, and seat commands may still carry its identifier.

## Decision Rules

Products are listed active and archived with cursor pagination:
`GET /v1/products?limit=100`, followed by
`starting_after=<last-id>` while `has_more`. Candidates have
`metadata[mokly_lookup_key]` equal to the table key. Two active candidates fail
with both identifiers; more than two fail with all identifiers. Exactly one is
adopted. With no active candidate, the archived candidate with greatest
`created`, then greatest bytewise identifier, is reactivated; with none, the
product is created. An adopted product whose owned fields differ is updated in
place (`updated`); otherwise it is `validated`.

### Sync

Prices use one request for both keys:
`GET /v1/prices?active=true&lookup_keys[]=<editor-key>&lookup_keys[]=<collaborator-key>&expand[]=data.product&limit=10`.
Stripe returns at most one price per lookup key. The immutable comparison is
product, currency, `unit_amount`, `recurring.interval`,
`recurring.usage_type`, and `tax_behavior`.

No active price is `created`. If an immutable field differs, `sync` creates a
replacement with every owned field, `transfer_lookup_key=true`, and
`metadata[mokly_replaces]=<old-price-id>`. Stripe transfers the lookup key, but
the predecessor remains active and loses only that lookup key. Apply reports
`price <key> replaced OLD -> NEW`; a dry run reports
`price <key> would replace OLD -> pending`. `sync` never reports `archived`.
Matching immutable fields with a differing `nickname` or
`metadata[mokly_seat_kind]` are updated with exactly those two fields; a
complete match is `validated`.

When an immutable field differs and either the predecessor's `nickname` or
`metadata[mokly_seat_kind]` also differs, `sync` first sends the ordinary price
update containing only the nickname and seat tag, then creates the replacement.
Apply reports `price <key> updated OLD` immediately followed by
`price <key> replaced OLD -> NEW`; a dry run reports
`price <key> would update OLD` immediately followed by
`price <key> would replace OLD -> pending`. An immutable difference whose
nickname and seat tag already match still reports only the replacement.

Order is product, then lookup-key prices in identity-table order. A failure
stops the run; earlier writes remain and a rerun converges.

### Archive

`archive` is an optional clean-up command an operator runs by hand to tidy the
Stripe Dashboard. Run it only after the rollout that made the current prices
live has succeeded, and never while a deploy is running; no deployment workflow
runs `archive`. Superseded prices may remain active indefinitely because only
prices holding catalogue lookup keys are ever sold, and existing subscriptions
continue billing on a superseded price whether it is active or archived.

#### Decision and retention rules

`archive` validates the catalogue identity, then lists products and applies the
same candidate rules as `sync` without writing. No active candidate fails with
`error missing-product lookup_key=<product-key>`; multiple active candidates
fail with `duplicate-active-products` as `sync` does. It makes the same single
lookup-key price listing as `sync`. In identity-table order, the listed price
holding a seat's lookup key is its current price; absence fails with
`error missing-current-price lookup_key=<price-key>` and the operator must run
`sync` first.

For each seat, the superseded set is the de-duplicated union below, excluding
both seats' current price identifiers:

1. The replacement chain starts at the current price. Read its
   `metadata[mokly_replaces]`, retrieve that identifier with
   `GET /v1/prices/<id>`, and repeat from the retrieved price. Stop at a price
   without the link, an identifier already visited, after 20 links, or when a
   retrieval returns 404. Every active retrieved price is superseded. An
   archived price is skipped but traversal continues through its link. A
   predecessor's product and seat-kind metadata do not constrain traversal.
2. The product sweep lists the adopted product's active prices with
   `GET /v1/prices?product=<id>&active=true&limit=100`, following the product
   listing's cursor rules and bound. A price is superseded for this seat when
   `metadata[mokly_seat_kind]` equals its seat kind and its lookup key is null
   or is not a catalogue price key.

A price that is on no replacement chain and lacks matching seat-kind metadata
is never touched. If the current price was created less than 24 hours before
the command's current time, every price in that seat's superseded set is kept.
Otherwise, each is archived with an update whose only field is `active=false`.
The 24-hour hold remains a safety net for a manual run made soon after `sync`;
it is not a rollout timer. Existing subscriptions continue billing on a
superseded or archived price; neither command moves them.

Product and product-price cursor listings stop after 100 pages and fail closed
when `has_more` remains true at the bound or a page supplies no last-object
cursor. The same bound applies when `archive` performs the product sweep.

## Idempotency And Requests

Every request sends the bearer key and the pinned `Stripe-Version` from
[Billing's catalogue settings](./billing.md#plan-catalogue).

Every catalogue write sends this header:

```text
Idempotency-Key: mokly-catalogue:<run>:<operation>:<target>:<digest>
```

`<operation>:<target>` is `product-create:<lookup-key>`;
`product-update:<product-id>` for an edit or reactivation;
`price-create:<lookup-key>` or, when the create names a price it replaces,
`price-replace:<replaced-id>`; and `price-archive:<price-id>` when an update's
only field is `active=false`, otherwise `price-update:<price-id>`.

The request body is the UTF-8 form pairs sorted by key bytes then value bytes,
each component encoded with the WHATWG `application/x-www-form-urlencoded`
serializer (space as `+`, uppercase `%HH` escapes), joined with `&`; those
exact bytes are sent. `<digest>` is the first 32 lowercase hexadecimal
characters of the SHA-256 of those bytes; duplicate equal pairs retain their
count.

Each command invocation generates one `<run>`: a random version-4 UUID written
as 32 lowercase hexadecimal characters, reused for every write in that
invocation. A transport retry within the run replays one result. A later
invocation re-reads Stripe and uses a fresh run, so it applies a new transition
instead of being pinned to an earlier cached response. Stripe retains a key's
first result, including a server error, for at least 24 hours. Keys stay within
Stripe's 255-character limit. The target is in the key for readability; the run
identifier provides cross-invocation uniqueness.

Runs must not overlap: the deploy workflow serializes them, and an operator
must not use `--apply` while a deploy runs.

## Runtime Resolution

At startup the API makes the same single active-price listing for both lookup
keys with `data.product` expanded, bounded to five seconds with no retry. For
each seat it verifies the lookup key, `unit_amount`, currency, interval, and
usage type against [Billing's tables](./billing.md#plan-catalogue), plus
`tax_behavior=exclusive`, price `active=true`, and an expanded active product
with `metadata[mokly_lookup_key]=mokly_team`. Both prices must share that one
product. A verified price records its `price_` identifier as the identity used
by Checkout and seat writes.

Verification also requires `metadata[mokly_seat_kind]` to equal the price's
catalogue seat kind. A mismatch is logged with
`field=metadata.mokly_seat_kind`. This ensures every price ever sold carries a
trustworthy seat tag, which the webhook worker's metadata mapping step relies
on for historical prices.

A missing key or mismatched field leaves that price unverified until restart,
makes Checkout unavailable, and prevents the seat worker from starting. The
log names the lookup key and field without a secret. Item mapping and use of
historical prices are defined by [Price Integrity](./billing-workers.md#price-integrity).

Commands, deployment, failures, and credentials are defined in
[Stripe billing catalogue operations](./billing-catalogue-operations.md); the
operator procedure is in [Billing smoke](../../ops/billing-smoke.md).
