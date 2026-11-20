# mkc-billing

Provider-independent billing policy and workers for Mokly Cloud. The crate sits
between the API (`mkc-api`), which maps its outcomes to HTTP, and the Stripe
adapter (`mkc-billing-stripe`), which it reaches only through the
`mkc-billing-interface` traits. Depend on it for transactional plan gates,
startup price verification, subscription cancellation before organization
deletion, the Stripe webhook worker, the seat reconciler, and dead-letter
recovery.

## Responsibilities

Read organization plans inside caller-owned transactions, resolve and verify
the two catalogue prices, cancel a live subscription before its organization is
deleted, apply durable Stripe deliveries, keep subscription seat items equal to
the role-derived seat counts, and requeue retained deliveries.

## What This Crate Does

`Entitlements` answers plan questions with the caller's own `Queries`, so a plan
gate and the write it protects share one transaction. `PriceVerifier` lists both
catalogue lookup keys in one request and keeps only prices whose every field
matches the typed catalogue in `mkc-domain`. `BillingLifecycle` cancels a live
subscription at Stripe before the deletion transaction runs. The two workers
implement [Billing workers](../../docs/protocol/cloud/billing-workers.md):
`BillingDeliveryWorker` claims one due delivery, reconciles the subscription,
its items, the trial and the plan, and schedules the retry; `SeatReconciler`
reserves one durable command per organization and seat kind and sends it to
Stripe. `BillingRecovery` requeues a failed delivery for the operator commands.
The crate never sees HTTP, Stripe signatures or request bodies; those stay in
`mkc-billing-stripe` and `mkc-api`.

## Quick Start

```rust
use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_billing::entitlements::{DatabaseEntitlements, Entitlements};
use mkc_billing::prices::{PriceVerifier, ProviderPriceVerifier};
use mkc_billing::seats::worker::{DatabaseSeatReconciler, SeatReconciler};
use mkc_billing::worker::worker::{BillingDeliveryWorker, DatabaseBillingDeliveryWorker};
use mkc_billing_interface::provider::BillingProvider;
use mkc_store_interface::store::Store;

/// Compose the plan gate and both workers at the application boundary.
fn compose(
    store: Arc<dyn Store>,
    runtime: Arc<dyn Runtime>,
    provider: Arc<dyn BillingProvider>,
) -> (
    Arc<dyn Entitlements>,
    Arc<dyn BillingDeliveryWorker>,
    Option<Arc<dyn SeatReconciler>>,
) {
    let verifier = ProviderPriceVerifier {
        provider: provider.clone(),
    };
    let identities = verifier.verify().identities();
    let deliveries = DatabaseBillingDeliveryWorker::new(
        store.clone(),
        runtime.clone(),
        provider.clone(),
        identities.clone(),
    );
    // The seat worker starts only when both catalogue prices verified.
    let seats = identities.map(|prices| {
        Arc::new(DatabaseSeatReconciler::new(store, runtime, provider, prices))
            as Arc<dyn SeatReconciler>
    });
    (Arc::new(DatabaseEntitlements), Arc::new(deliveries), seats)
}
```

Operators inspect and requeue retained deliveries through the API binary:

```sh
mkc-api billing-delivery-status
mkc-api requeue-billing-delivery --event evt_example
```

## Development

```sh
cargo test -p mkc-billing
cargo clippy -p mkc-billing --all-targets -- -D warnings
```

Unit tests drive the workers with unimock stores and providers; the Postgres
queries they call are tested in `mkc-store-pg`.

### Key Code

- [entitlements.rs](./src/entitlements.rs) — `Entitlements` and `DatabaseEntitlements`, the plan reads and the `plan-required` refusal evaluated inside the caller's transaction.
- [prices.rs](./src/prices.rs) — `PriceVerifier`, `ProviderPriceVerifier` and `VerifiedPrices`, the one startup listing that verifies both catalogue prices and records their identities.
- [lifecycle.rs](./src/lifecycle.rs) — `BillingLifecycle` and `SubscriptionLifecycle`, the subscription cancellation that precedes organization deletion.
- [worker/worker.rs](./src/worker/worker.rs) — `BillingDeliveryWorker` and `DatabaseBillingDeliveryWorker`, which claim one due delivery under a fenced lease and schedule its retry.
- [worker/plan.rs](./src/worker/plan.rs) — plan derivation from the subscription status and the seat-kind mapping of each subscription item.
- [worker/reconcile.rs](./src/worker/reconcile.rs) — the transaction that writes the subscription, its items, the trial and the plan together with the delivery's completion.
- [seats/worker.rs](./src/seats/worker.rs) — `SeatReconciler` and `DatabaseSeatReconciler`, which reserve one leased command per seat kind before each Stripe write.
- [recovery.rs](./src/recovery.rs) — `BillingRecovery` and `StoreBillingRecovery`, the dead-letter count and requeue behind the operator commands.
- [error.rs](./src/error.rs) — `Error`, the typed outcomes (`NotFound`, `PlanRequired`, `OperationUnavailable`, `ProviderUnavailable`) that `mkc-api` maps to HTTP.

### Related Docs

- [Billing](../../docs/protocol/cloud/billing.md), [Billing plan gates](../../docs/protocol/cloud/billing-plan-gates.md) and [Billing subscriptions](../../docs/protocol/cloud/billing-subscriptions.md)
- [Billing workers](../../docs/protocol/cloud/billing-workers.md)
- [Stripe billing catalogue](../../docs/protocol/cloud/billing-catalogue.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Billing smoke](../../docs/ops/billing-smoke.md) and [Delivery recovery](../../docs/ops/check-recovery.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
