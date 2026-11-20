//! Lease fencing for destructive refused-create cleanup.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::Runtime;
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::provider::BillingProvider;
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_seat_command::{
    BillingSeatCommand, BillingSeatCommandsMock, SeatCommandOperation,
};
use mkc_store_interface::store::{Decision, Store, StoreMock};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::prices::VerifiedPriceIds;
use crate::seats::worker::{DatabaseSeatReconciler, should_delete_refused_create};

#[test]
fn only_an_invalid_create_refusal_selects_destructive_cleanup() {
    let invalid = ProviderError::InvalidRequest {
        detail: ProviderDetail::none(),
    };
    assert!(should_delete_refused_create(
        SeatCommandOperation::Create,
        &invalid
    ));
    for operation in [SeatCommandOperation::Update, SeatCommandOperation::Delete] {
        assert!(!should_delete_refused_create(operation, &invalid));
    }
    for error in [
        ProviderError::Unauthorized {
            detail: ProviderDetail::none(),
        },
        ProviderError::PermissionDenied {
            detail: ProviderDetail::none(),
        },
        ProviderError::NotFound {
            detail: ProviderDetail::none(),
        },
        ProviderError::Unavailable,
    ] {
        assert!(!should_delete_refused_create(
            SeatCommandOperation::Create,
            &error
        ));
    }
}

#[test]
fn refused_create_is_not_deleted_after_another_worker_takes_the_lease() {
    let organization = OrganizationId(Uuid::from_u128(1));
    let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
    let claimed = command(organization, now, Uuid::from_u128(10));
    let current = command(organization, now, Uuid::from_u128(20));
    let store: Arc<dyn Store> = Arc::new(Unimock::new(
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work| {
                let mut queries = Unimock::new(
                    BillingSeatCommandsMock::billing_seat_command
                        .next_call(matching!(_, _))
                        .returns(Ok(Some(current.clone()))),
                );
                assert_eq!(work.run(&mut queries)?, Decision::Commit);
                Ok(())
            })),
    ));
    let runtime: Arc<dyn Runtime> = Arc::new(Unimock::new(()));
    let provider: Arc<dyn BillingProvider> = Arc::new(Unimock::new(()));
    let worker = DatabaseSeatReconciler::new(
        store,
        runtime,
        provider,
        VerifiedPriceIds {
            editor: "price_current".into(),
            collaborator: "price_collaborator".into(),
        },
    );

    worker
        .delete_refused_create(&claimed, Uuid::from_u128(10))
        .unwrap();
}

fn command(organization: OrganizationId, now: DateTime<Utc>, lease: Uuid) -> BillingSeatCommand {
    BillingSeatCommand {
        id: Uuid::from_u128(2),
        organization_id: organization,
        seat_kind: SeatKind::Editor,
        provider_subscription_id: "sub_fixture".into(),
        operation: SeatCommandOperation::Create,
        provider_item_id: None,
        price_id: "price_old".into(),
        quantity: 1,
        idempotency_key: format!("seats:{organization}:editor:2"),
        due_at: now,
        attempts: 1,
        lease: Some(lease),
        lease_until: Some(now + Duration::minutes(5)),
        created_at: now,
    }
}
