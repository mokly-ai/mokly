# mkc-billing-stripe

Stripe HTTP implementation of the `mkc-billing-interface` contracts for Mokly
Cloud. Construct its adapters at a composition root such as `mkc-api`, then
inject them into `mkc-billing` and the catalogue tooling as trait objects. The
crate holds no database state: delivery durability, plan derivation and seat
policy belong to `mkc-billing`.

## Responsibilities

Send typed Stripe runtime and catalogue requests over a bounded transport, pin
the provider API version, derive and send idempotency keys, classify provider
responses into the interface error contract, and verify webhook signatures over
the original request bytes.

## What This Crate Does

`StripeClient` implements `BillingProvider` and `CatalogueProvider` over an
injected `Http`. Reads use query fields; writes are form encoded and carry an
`Idempotency-Key`: the customer and cancellation keys derive from the
organization and the subscription, Checkout, Portal and seat writes carry the
caller's key, and catalogue writes derive the key that the
[Stripe billing catalogue](../../docs/protocol/cloud/billing-catalogue.md#idempotency-and-requests)
defines from the run identifier and the sorted body. Lookup-key reads fetch up
to ten active prices with their products expanded in one request; catalogue
listings follow `starting_after` for at most 100 pages before failing closed;
subscription reads expand the items and the latest invoice.

`ReqwestFactory` builds a blocking client bound to one exact API origin with a
caller-supplied timeout, no redirects, a 1 MiB response ceiling, bearer
authentication and the pinned `Stripe-Version` from
[Billing](../../docs/protocol/cloud/billing.md#plan-catalogue). `RetryingHttp` waits
once for a Stripe 429 delay of up to 60 seconds and otherwise returns the typed
rate-limit outcome. Statuses map to the interface errors: 400 and 422 to
`InvalidRequest`, 401 to `Unauthorized`, 403 to `PermissionDenied`, 404 to
`NotFound`, 429 to `RateLimited`, and 5xx to `Unavailable`; a refusal keeps only
the sanitized Stripe error type and code, never the response body.

`StripeSignatureVerifier` parses one Unix timestamp and one or more `v1`
signatures, ignores other schemes, applies the five-minute tolerance in either
direction, and accepts any constant-time HMAC-SHA256 match.

## Quick Start

```rust
use std::sync::Arc;

use mkc_billing_interface::credentials::{Secret, Sleeper};
use mkc_billing_interface::error::Result;
use mkc_billing_interface::http::Http;
use mkc_billing_interface::provider::BillingProvider;
use mkc_billing_interface::webhooks::WebhookVerifier;
use mkc_billing_stripe::client::StripeClient;
use mkc_billing_stripe::runtime::ThreadSleeper;
use mkc_billing_stripe::security::StripeSignatureVerifier;
use mkc_billing_stripe::transport::{
    HttpFactory, OPERATION_TIMEOUT, ReqwestFactory, RetryingHttp,
};

/// Compose the production provider and webhook verifier from validated settings.
fn compose(
    api_origin: &str,
    secret_key: String,
    webhook_secret: String,
) -> Result<(Arc<dyn BillingProvider>, Arc<dyn WebhookVerifier>)> {
    let sleeper: Arc<dyn Sleeper> = Arc::new(ThreadSleeper);
    let http: Arc<dyn Http> = Arc::new(RetryingHttp {
        http: ReqwestFactory.build(api_origin, OPERATION_TIMEOUT)?,
        sleeper,
    });
    let provider = StripeClient {
        http,
        key: Secret::new(secret_key),
    };
    let verifier = StripeSignatureVerifier {
        secret: Secret::new(webhook_secret),
    };
    Ok((Arc::new(provider), Arc::new(verifier)))
}
```

The API composes this provider with `OPERATION_TIMEOUT` and the retrying
transport for ordinary operations, and a second `StripeClient` over a plain
transport with `VERIFICATION_TIMEOUT` for startup price verification.

## Development

```sh
cargo test -p mkc-billing-stripe
cargo clippy -p mkc-billing-stripe --all-targets -- -D warnings
```

Unit tests replay sanitized response records through the `Http` seam and
inspect the reqwest request before transmission. Fixture provenance is
documented in [fixtures/README.md](fixtures/README.md).

### Key Code

- [client/mod.rs](src/client/mod.rs) — `StripeClient`, the one adapter behind both provider traits.
- [client/billing.rs](src/client/billing.rs) — the `BillingProvider` implementation: customers, Checkout and Portal sessions, subscriptions, seat items and lookup-key price reads.
- [client/catalogue.rs](src/client/catalogue.rs) — the `CatalogueProvider` implementation: paged product and price reads and the deterministic catalogue writes.
- [client/form.rs](src/client/form.rs) — the sorted form encoding and the catalogue idempotency key derived from the body digest.
- [transport.rs](src/transport.rs) — `ReqwestFactory`, `RetryingHttp`, `STRIPE_VERSION` and the two request deadlines.
- [response.rs](src/response.rs) — status classification into the interface error contract and typed decoding.
- [security.rs](src/security.rs) — `StripeSignatureVerifier`, the timestamped webhook HMAC verification.
- [runtime.rs](src/runtime.rs) — `SystemClock` and `ThreadSleeper`, the production clock and sleeper.

### Related Docs

- [Provider interface](../mkc-billing-interface/README.md) and [billing service](../mkc-billing/README.md)
- [Billing subscriptions](../../docs/protocol/cloud/billing-subscriptions.md) and [Billing workers](../../docs/protocol/cloud/billing-workers.md)
- [Stripe billing catalogue](../../docs/protocol/cloud/billing-catalogue.md)
- [Billing smoke procedure](../../docs/ops/billing-smoke.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
