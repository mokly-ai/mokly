//! Organization deletion cancellation uses store and provider trait boundaries.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::Utc;
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::provider::BillingProviderMock;
use mkc_domain::ids::OrganizationId;
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionsMock};
use mkc_store_interface::store::{Decision, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::error::Error;
use crate::lifecycle::{BillingLifecycle, SubscriptionLifecycle};

#[test]
fn live_subscription_requires_configuration() {
    let lifecycle = SubscriptionLifecycle {
        store: store_with(Some(subscription())),
        provider: None,
    };
    assert!(matches!(
        lifecycle.cancel_for_deletion(organization()),
        Err(Error::OperationUnavailable)
    ));
}

#[test]
fn provider_not_found_counts_as_already_canceled() {
    let provider = Unimock::new(
        BillingProviderMock::cancel_subscription
            .next_call(matching!("sub_fixture"))
            .returns(Err(ProviderError::NotFound {
                detail: ProviderDetail::none(),
            })),
    );
    let lifecycle = SubscriptionLifecycle {
        store: store_with(Some(subscription())),
        provider: Some(Arc::new(provider)),
    };
    assert_eq!(
        lifecycle
            .cancel_for_deletion(organization())
            .unwrap()
            .provider_subscription_id
            .as_deref(),
        Some("sub_fixture")
    );
}

fn store_with(
    subscription: Option<BillingSubscription>,
) -> Arc<dyn mkc_store_interface::store::Store> {
    Arc::new(Unimock::new(
        StoreMock::read
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work: &mut dyn Transaction| {
                let mut queries = Unimock::new(
                    BillingSubscriptionsMock::billing_subscription
                        .next_call(matching!(_))
                        .returns(Ok(subscription.clone())),
                );
                assert_eq!(work.run(&mut queries).unwrap(), Decision::Commit);
                Ok(())
            })),
    ))
}

fn organization() -> OrganizationId {
    Uuid::from_u128(1).into()
}

fn subscription() -> BillingSubscription {
    BillingSubscription {
        organization_id: organization(),
        provider_subscription_id: "sub_fixture".into(),
        status: SubscriptionStatus::Active,
        current_period_end: None,
        trial_end: None,
        cancel_at_period_end: false,
        payment_failed_at: None,
        payment_updated_at: None,
        updated_at: Utc::now(),
        seats_checked_at: None,
        version: 1,
    }
}
