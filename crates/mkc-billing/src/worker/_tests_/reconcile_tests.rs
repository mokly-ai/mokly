//! Subscription binding conflicts remain fenced during reconciliation.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::sync::Arc;

use chrono::{Duration, TimeZone, Utc};
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_billing_interface::objects::{List, Subscription, SubscriptionStatus};
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_delivery::{BillingDeliveriesMock, BillingDelivery};
use mkc_store_interface::billing_state::SubscriptionStatus as StoredSubscriptionStatus;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionsMock};
use mkc_store_interface::github_state::DeliveryStatus;
use mkc_store_interface::store::{Decision, Store, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::worker::handlers::Prepared;
use crate::worker::retry::AttemptError;
use crate::worker::worker::DatabaseBillingDeliveryWorker;

#[test]
fn different_live_subscription_is_retained_as_a_conflict() {
    let now = Utc.with_ymd_and_hms(2026, 9, 22, 12, 0, 0).unwrap();
    let lease = Uuid::from_u128(10);
    let delivery = processing_delivery("evt_conflict", now, lease);
    let current_delivery = delivery.clone();
    let existing = bound_subscription(now);
    let store: Arc<dyn Store> = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let mut queries = Unimock::new((
                    BillingDeliveriesMock::billing_delivery
                        .next_call(matching!("evt_conflict"))
                        .returns(Ok(Some(current_delivery.clone()))),
                    BillingSubscriptionsMock::billing_subscription
                        .next_call(matching!(_))
                        .returns(Ok(Some(existing.clone()))),
                ));
                assert_eq!(work.run(&mut queries).unwrap(), Decision::Commit);
                Ok(())
            })),
    ));
    let worker = worker(store, 20);
    assert!(matches!(
        worker.apply(
            &delivery,
            lease,
            Prepared::Reconcile {
                organization: organization(),
                subscription: provider_subscription("sub_conflicting"),
                created: now,
            },
        ),
        Err(AttemptError::Conflict)
    ));
}

#[test]
fn stale_different_subscription_finishes_without_replacing_the_binding() {
    let now = Utc.with_ymd_and_hms(2026, 9, 22, 12, 0, 0).unwrap();
    let lease = Uuid::from_u128(30);
    let delivery = processing_delivery("evt_stale_conflict", now, lease);
    let current_delivery = delivery.clone();
    let existing = bound_subscription(now);
    let store: Arc<dyn Store> = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let mut queries = Unimock::new((
                    BillingDeliveriesMock::billing_delivery
                        .next_call(matching!("evt_stale_conflict"))
                        .returns(Ok(Some(current_delivery.clone()))),
                    BillingSubscriptionsMock::billing_subscription
                        .next_call(matching!(_))
                        .returns(Ok(Some(existing.clone()))),
                    BillingDeliveriesMock::save_billing_delivery
                        .next_call(matching!((saved) if
                            saved.status == DeliveryStatus::Done
                                && saved.last_failure.is_none()
                        ))
                        .returns(Ok(())),
                ));
                assert_eq!(work.run(&mut queries).unwrap(), Decision::Commit);
                Ok(())
            })),
    ));
    let worker = worker(store, 40);
    assert!(
        worker
            .apply(
                &delivery,
                lease,
                Prepared::Reconcile {
                    organization: organization(),
                    subscription: provider_subscription("sub_replaced"),
                    created: now - Duration::seconds(1),
                },
            )
            .is_ok()
    );
}

fn worker(store: Arc<dyn Store>, first_id: u128) -> DatabaseBillingDeliveryWorker {
    let runtime: Arc<dyn Runtime> = Arc::new(Unimock::new((
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(first_id)),
        RuntimeMock::id
            .next_call(matching!())
            .returns(Uuid::from_u128(first_id + 1)),
    )));
    let provider: Arc<dyn BillingProvider> = Arc::new(Unimock::new(()));
    DatabaseBillingDeliveryWorker::new(store, runtime, provider, None)
}

fn provider_subscription(id: &str) -> Subscription {
    Subscription {
        id: id.into(),
        customer: "cus_fixture".into(),
        status: SubscriptionStatus::Active,
        items: List {
            object: "list".into(),
            data: Vec::new(),
            has_more: Some(false),
            extra: BTreeMap::new(),
        },
        cancel_at_period_end: false,
        trial_end: None,
        latest_invoice: None,
        metadata: BTreeMap::new(),
        extra: BTreeMap::new(),
    }
}

fn organization() -> OrganizationId {
    Uuid::from_u128(1).into()
}

fn bound_subscription(now: chrono::DateTime<Utc>) -> BillingSubscription {
    BillingSubscription {
        organization_id: organization(),
        provider_subscription_id: "sub_bound".into(),
        status: StoredSubscriptionStatus::Active,
        current_period_end: Some(now + Duration::days(30)),
        trial_end: None,
        cancel_at_period_end: false,
        payment_failed_at: None,
        payment_updated_at: None,
        updated_at: now,
        seats_checked_at: None,
        version: 1,
    }
}

fn processing_delivery(id: &str, now: chrono::DateTime<Utc>, lease: Uuid) -> BillingDelivery {
    BillingDelivery {
        id: id.into(),
        event: "customer.subscription.created".into(),
        body: Vec::new(),
        received_at: now,
        due_at: now,
        attempts: 1,
        status: DeliveryStatus::Processing,
        lease: Some(lease),
        lease_until: Some(now + Duration::minutes(5)),
        last_failure: None,
    }
}
