# mkc-billing-interface

Typed billing-provider contracts for Mokly Cloud. Depend on this crate from
services that need billing behavior; inject its traits without depending on the
Stripe HTTP implementation in `mkc-billing-stripe`.

## Responsibilities

Own customer, Checkout, Portal, subscription-item, catalogue product and price,
event, HTTP, secret, retry, and webhook-verification contracts shared by
billing services and catalogue tooling.

## What This Crate Does

`BillingProvider` exposes synchronous provider operations for Checkout, seat
reconciliation, and one bounded active-price lookup by up to ten lookup keys.
`CatalogueProvider` lists active and archived products and one product's active
prices with bounded cursor pagination, retrieves a price by identifier, then
creates and updates the product and prices through typed write intents. Every
catalogue write carries one validated 128-bit run identifier shared by its
command invocation. Checkout inputs carry one exact persisted provider expiry
and metadata copied to the resulting subscription. `WebhookVerifier`
authenticates original request bytes and separates malformed, stale, and
mismatched headers. `Http`, `Clock`, and `Sleeper` are replaceable seams, and
every behavior trait has a unimock API.

Stripe DTOs retain provider fields unknown to the pinned API version in one
flattened `extra` map. Catalogue prices type their creation time, lookup key,
nickname, metadata, tax behavior, and expandable product; products retain
active and archived state. Runtime lookup and catalogue reads share the same
enriched `objects::Price` DTO.

Subscription items carry the embedded price identifier, optional lookup key,
and metadata needed to recognize historical prices. Subscription reads model
the expandable latest invoice and its payment-attempt state. Event payload
objects remain raw only until the durable webhook handler selects the schema
for the typed event kind. `Secret` redacts `Debug` and cannot be serialized.
Handled invalid-input, authorization, permission, not-found, rate-limit, and
availability outcomes remain typed; definite refusals retain only a closed
error type and validated error code. Other sources are preserved in `Internal`.
`Error::request_outcome` classifies validation, authorization, permission,
not-found, and rate-limit responses as definitely rejected while outages and
internal transport, verification or serialization failures remain
outcome-unknown. Callers retain idempotency state for the latter.

## Quick Start

```rust
use std::sync::Arc;

use mkc_billing_interface::catalogue::Product;
use mkc_billing_interface::catalogue_provider::CatalogueProvider;
use mkc_billing_interface::error::Result;

fn catalogue_products(provider: Arc<dyn CatalogueProvider>) -> Result<Vec<Product>> {
    provider.list_products()
}
```

## Development

```sh
cargo test -p mkc-billing-interface -p mkc-billing-stripe
cargo clippy -p mkc-billing-interface --all-targets -- -D warnings
```

### Key Code

- [provider.rs](src/provider.rs) — the `BillingProvider` trait: provider operations and write inputs.
- [catalogue_provider.rs](src/catalogue_provider.rs) — the `CatalogueProvider` trait: catalogue writes and paged reads.
- [catalogue.rs](src/catalogue.rs) — products, expanded relations, recurrence, and tax behavior.
- [objects.rs](src/objects.rs) — forward-compatible Stripe DTOs, including the shared price, and event kinds.
- [webhooks.rs](src/webhooks.rs) — the `WebhookVerifier` trait: raw-body signature outcomes.
- [http.rs](src/http.rs) — transport-neutral form request boundary.
- [error.rs](src/error.rs) — `Error`, whose definite refusals `InvalidRequest` (HTTP 400 and 422), `Unauthorized` (401), `PermissionDenied` (403), `NotFound` (404) and `RateLimited` (429) are safe to retry under a new key, while `Unavailable` (5xx) and `Internal` are outcome-unknown.

### Related Docs

- [Billing](../../docs/protocol/cloud/billing.md), [Billing subscriptions](../../docs/protocol/cloud/billing-subscriptions.md) and [Billing workers](../../docs/protocol/cloud/billing-workers.md)
- [Stripe billing catalogue](../../docs/protocol/cloud/billing-catalogue.md)
- [REST API](../../docs/protocol/cloud/rest-api.md)
- [Stripe adapter](../mkc-billing-stripe/README.md) and [billing service](../mkc-billing/README.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
