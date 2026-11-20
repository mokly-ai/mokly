# Stripe Billing Catalogue Operations

This contract owns the Stripe catalogue command surface, deployment jobs,
credential boundary, and exact failure lines. The
[Stripe billing catalogue](./billing-catalogue.md) owns identity, reconciliation
decisions, idempotency, and runtime resolution; [Infrastructure
promotion](./infrastructure-promotion.md) owns release ordering;
[Billing smoke](../../ops/billing-smoke.md) owns the operator procedure.

## Command

`cargo xtask stripe-catalogue check` is offline: it validates the identity
against the typed catalogue and prints the product first, then one price per
identity-table row, without a key or network access. Its exact line forms are:

```text
product <product-key> intended name=<JSON-string> active=true metadata.mokly_lookup_key=<product-key>
price <price-key> intended product=<product-key> currency=<billing-currency> unit_amount=<billing-minor-units> recurring.interval=<billing-interval> recurring.usage_type=<billing-usage-type> tax_behavior=exclusive nickname=<JSON-string> metadata.mokly_seat_kind=<seat-kind>
```

The four `<billing-…>` values come directly from
[Billing's tables](./billing.md#plan-catalogue). For example:
`product mokly_team intended name="Mokly Team" active=true metadata.mokly_lookup_key=mokly_team`.

### Sync

`cargo xtask stripe-catalogue sync --environment <main-preview|production>
[--apply]` reads Stripe and is a no-write dry run unless `--apply` is present.
The report forms are:

```text
product <key> <would create|would update ID|created ID|updated ID|validated ID>
price <key> <would create|would update ID|created ID|updated ID|validated ID>
price <key> <would replace OLD -> pending|replaced OLD -> NEW>
```

The product comes first and prices follow identity-table order. `sync` never
prints `archived`; other dry-run actions use `would`, while `validated` is the
same in both modes. After an apply has converged, a rerun reports every
catalogue object `validated`.

Each price normally contributes one report line. When an immutable difference
requires replacement and the predecessor's `nickname` or
`metadata[mokly_seat_kind]` also differs, the grammar permits the adjacent pair
`price <key> would update OLD` then
`price <key> would replace OLD -> pending` in a dry run, or
`price <key> updated OLD` then `price <key> replaced OLD -> NEW` in apply mode.
No other report line may occur between the pair.

`sync` requires `MKC_STRIPE_CATALOGUE_KEY`, which is never printed.
`MKC_STRIPE_API_ORIGIN` defaults to `https://api.stripe.com`; an override is an
`https` origin or `http://127.0.0.1:<port>` / `http://localhost:<port>` for
tests, with no path other than `/`, user info, query, or fragment.

Before any request, both `sync` and `archive` require a restricted key:
`main-preview` accepts only a key starting `rk_test_`, and production accepts
only a key starting `rk_live_`. A key that starts with neither `rk_test_` nor
`rk_live_`, including every `sk_` key, fails with
`error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted`.
A restricted key for the other mode fails with
`error wrong-key-mode environment=<environment> expected=<test|live>`.

Success exits 0. Failure exits nonzero and writes exactly one typed line from
[Failure Modes](#failure-modes) to stderr; no error includes a key or response
body.

### Archive

`cargo xtask stripe-catalogue archive --environment
<main-preview|production> [--apply]` uses the same inputs and pre-request key
validation as `sync`. It is a no-write dry run unless `--apply` is present and
follows the [archive decision rules](./billing-catalogue.md#archive), including
the command's optional manual-clean-up boundary.

For each seat in identity-table order, `archive` writes its current price to
stdout first, then its superseded prices in bytewise identifier order:

```text
price <key> current <ID>
price <key> archived <OLD>
price <key> would archive <OLD>
price <key> kept <OLD> until <T>
```

Apply uses `archived`, dry run uses `would archive`, and the 24-hour hold uses
`kept` in either mode. `<T>` is the current price's `created` plus 24 hours,
rendered as UTC RFC 3339 with second precision and a `Z` suffix, for example
`2026-09-28T14:05:09Z`. A seat with no superseded price prints only its
`current` line, so a dry run against a converged catalogue with no superseded
prices prints one `current` line per seat and nothing else. A failure stops
after completed stdout lines and writes exactly one error line to stderr, as
`sync` does.

An operator must not run `sync --apply` or `archive --apply` while a deploy is
running.

## Deploy Jobs

`catalogue-main-preview` and `catalogue-production` each run after their
environment's `apply-*` job and only when its `applied` output is `true`. Each
runs `cargo xtask stripe-catalogue check`, passes the common credential gate,
and reads `billing.enabled` from the reviewed `plan-<environment>` release
values. When billing is disabled, the job prints a notice and completes without
authenticating or reading a key.

When billing is enabled, the job authenticates as the deploy identity, reads
the latest version of `mkc-<environment>-stripe-catalogue-key`, and runs
`sync --environment <environment> --apply` with the key in that step's
environment only. A missing secret or version fails the job. The matching
`release-*` job waits for the catalogue job to complete. The `required`
aggregate lists both catalogue jobs and rejects failed, cancelled, or
unexpectedly skipped runs exactly as it does for plan, apply, and rollout. PR
previews never sync.

No job in the deployment workflow runs `stripe-catalogue archive`, and the
`required` aggregate has no archive-job dependency or archive result. Operators
may run the separate command by hand under its
[manual-clean-up rules](./billing-catalogue.md#archive).

## Key Per Environment

Each stable environment has `stripe-catalogue-key`:
`mkc-main-preview-stripe-catalogue-key` is test mode and
`mkc-production-stripe-catalogue-key` is live mode. It is a restricted key with
Products write and Prices write only. The deploy identity is its sole reader;
no workload reads it, and the API's `stripe-secret-key` never enters the
workflow. Reusing the API's runtime key for the sync was rejected: the
separate key keeps the API's key out of GitHub Actions and gives the sync the
least access it needs. Provisioning and rotation are in [Secrets](../../ops/secrets.md).

Neither command verifies which Stripe account owns the key because doing so
would require an additional account-read permission; the key retains only
Products write and Prices write.

## Failure Modes

A 403 response is a definite refusal, reported as `permission-denied`.
Every refusal carries sanitized Stripe error type and code: type is
`api_error`, `card_error`, `idempotency_error`, or `invalid_request_error`,
`unknown` for another value, and `none` when absent; code is retained only when
it matches `^[a-z0-9_]{1,64}$`, otherwise it is `none`. The boundary never
retains Stripe's message, response body, or the key in a refusal.

### Command failure lines

The exact command failure contract below applies. Angle-bracket values are
single tokens. `<comma-separated-ids>` contains every active candidate in
bytewise order without spaces. Provider writes are `product-create`,
`product-update`, `price-create`, `price-replace`, `price-update`, and
`price-archive`; provider reads are `list-products`, `list-prices`,
`list-product-prices`, and `retrieve-price`. A write target is its idempotency
target. Read targets are `catalogue` for `list-products` and `list-prices`, the
product identifier for `list-product-prices`, and the price identifier for
`retrieve-price`.

| Typed error line                                                                                                                                                          | Recovery                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `error missing-key variable=MKC_STRIPE_CATALOGUE_KEY`                                                                                                                     | Supply the environment's restricted key                           |
| `error wrong-key-kind variable=MKC_STRIPE_CATALOGUE_KEY expected=restricted`                                                                                              | Create a restricted key with Products write and Prices write only |
| `error wrong-key-mode environment=<environment> expected=<test\|live>`                                                                                                    | Select the matching account-mode key                              |
| `error invalid-origin variable=MKC_STRIPE_API_ORIGIN`                                                                                                                     | Supply an allowed exact origin                                    |
| `error duplicate-active-products lookup_key=<key> products=<comma-separated-ids>`                                                                                         | Archive all but the intended product                              |
| `error missing-product lookup_key=<key>`                                                                                                                                  | Run `sync --apply`, then rerun `archive`                          |
| `error missing-current-price lookup_key=<key>`                                                                                                                            | Run `sync --apply`, then rerun `archive`                          |
| `error provider-refused operation=<operation> target=<target> reason=<invalid-request\|unauthorized\|permission-denied\|not-found\|rate-limited> type=<type> code=<code>` | Fix the request or access, or wait out the limit, then rerun      |
| `error provider-unavailable operation=<operation> target=<target>`                                                                                                        | Wait for provider recovery, then rerun                            |
| `error provider-failed operation=<operation> target=<target>`                                                                                                             | Check network access and Stripe's status, then rerun              |
| `error invalid-catalogue-identity field=<field>`                                                                                                                          | Align the typed and documented catalogue                          |

`missing-product` and `missing-current-price` are archive-only failures.
For `permission-denied`, grant the restricted key Products write and Prices
write, then rerun. `provider-unavailable` covers 5xx.
`provider-failed` covers an undecodable body, transport failure, or unexpected
status; none exposes adapter diagnostics in the command output.
