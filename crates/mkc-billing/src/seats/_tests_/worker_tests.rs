//! Seat action selection derives exact create, update and delete operations.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};
use mkc_auth::runtime::{Runtime, RuntimeMock};
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::provider::{BillingProvider, BillingProviderMock};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::SeatKind;
use mkc_store_interface::billing_seat_command::{
    BillingSeatCommand, BillingSeatCommandsMock, SeatCommandOperation,
};
use mkc_store_interface::billing_state::SubscriptionStatus;
use mkc_store_interface::billing_subscription::BillingSubscriptionItem;
use mkc_store_interface::billing_subscription::{BillingSubscription, BillingSubscriptionsMock};
use mkc_store_interface::organization::{OrganizationsMock, SeatCounts};
use mkc_store_interface::store::{Decision, Store, StoreMock, Transaction};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::prices::VerifiedPriceIds;
use crate::seats::plan::{ActionKind, select};
use crate::seats::worker::DatabaseSeatReconciler;

#[test]
fn confirmed_quantity_needs_no_write() {
    assert!(
        select(
            SeatCounts {
                editors: 1,
                collaborators: 0,
            },
            &[item(SeatKind::Editor, 1)],
            SeatKind::Editor,
            "price_editor",
        )
        .is_none()
    );
}

#[test]
fn editor_changes_update_the_existing_item() {
    let mut existing = item(SeatKind::Editor, 1);
    existing.price_id = "price_replaced_editor".into();
    let action = select(
        SeatCounts {
            editors: 3,
            collaborators: 0,
        },
        &[existing],
        SeatKind::Editor,
        "price_editor",
    )
    .unwrap();
    assert_eq!(action.quantity, 3);
    assert_eq!(action.price_id, "price_replaced_editor");
    assert!(matches!(action.operation, ActionKind::Update { .. }));
}

#[test]
fn collaborator_creation_and_removal_follow_the_derived_count() {
    let create = select(
        SeatCounts {
            editors: 1,
            collaborators: 2,
        },
        &[],
        SeatKind::Collaborator,
        "price_collaborator",
    )
    .unwrap();
    assert!(matches!(create.operation, ActionKind::Create));
    assert_eq!(create.quantity, 2);

    let remove = select(
        SeatCounts {
            editors: 1,
            collaborators: 0,
        },
        &[item(SeatKind::Collaborator, 2)],
        SeatKind::Collaborator,
        "price_collaborator",
    )
    .unwrap();
    assert!(matches!(remove.operation, ActionKind::Delete { .. }));
    assert_eq!(remove.quantity, 0);
    assert_eq!(remove.price_id, "price_collaborator");
}

#[test]
fn refused_create_is_deleted_before_a_fresh_command_uses_the_current_price() {
    let organization = OrganizationId(Uuid::from_u128(1));
    let now = DateTime::from_timestamp(1_800_000_000, 0).unwrap();
    let first = command(organization, now, 10, 11, "price_old");
    let second = command(organization, now, 20, 21, "price_current");
    let first_reservation = first.clone();
    let first_deletion = first.clone();
    let second_reservation = second.clone();
    let store: Arc<dyn Store> = Arc::new(Unimock::new((
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work| {
                marked_reservation(work, &first_reservation)
            })),
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work| deletion(work, &first_deletion))),
        StoreMock::transaction
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, work| {
                marked_reservation(work, &second_reservation)
            })),
    )));
    let runtime: Arc<dyn Runtime> = Arc::new(Unimock::new((
        RuntimeMock::now.each_call(matching!()).returns(now),
        RuntimeMock::id.next_call(matching!()).returns(first.id),
        RuntimeMock::id
            .next_call(matching!())
            .returns(first.lease.unwrap()),
        RuntimeMock::id.next_call(matching!()).returns(second.id),
        RuntimeMock::id
            .next_call(matching!())
            .returns(second.lease.unwrap()),
    )));
    let provider: Arc<dyn BillingProvider> = Arc::new(Unimock::new(
        BillingProviderMock::create_subscription_item
            .next_call(matching!(("sub_fixture", "price_old", 1, _)))
            .returns(Err(ProviderError::InvalidRequest {
                detail: ProviderDetail::none(),
            })),
    ));
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
        .reconcile_kind(organization, SeatKind::Editor, "price_old", true)
        .unwrap();
    let fresh = worker
        .reserve_and_claim(organization, SeatKind::Editor, "price_current", true)
        .unwrap()
        .unwrap();
    assert_eq!(fresh.id, second.id);
    assert_eq!(fresh.price_id, "price_current");
}

fn marked_reservation(
    work: &mut dyn Transaction,
    claimed: &BillingSeatCommand,
) -> mkc_store_interface::error::Result<()> {
    let mut queries = reservation_queries(claimed);
    assert_eq!(work.run(&mut queries)?, Decision::Commit);
    Ok(())
}

fn reservation_queries(claimed: &BillingSeatCommand) -> Unimock {
    let reserved = BillingSeatCommand {
        lease: None,
        lease_until: None,
        attempts: 0,
        ..claimed.clone()
    };
    let returned = reserved.clone();
    let expected_price = reserved.price_id.clone();
    Unimock::new((
        BillingSubscriptionsMock::billing_subscription
            .next_call(matching!(_))
            .returns(Ok(Some(subscription(
                claimed.organization_id,
                claimed.due_at,
            )))),
        OrganizationsMock::seat_counts
            .next_call(matching!(_))
            .returns(Ok(SeatCounts {
                editors: 1,
                collaborators: 0,
            })),
        BillingSubscriptionsMock::billing_subscription_items
            .next_call(matching!(_))
            .returns(Ok(Vec::new())),
        BillingSubscriptionsMock::mark_seats_checked
            .each_call(matching!(_, _))
            .answers(&|_, _, _| Ok(())),
        BillingSeatCommandsMock::billing_seat_command
            .next_call(matching!(_, _))
            .returns(Ok(None)),
        BillingSeatCommandsMock::reserve_billing_seat_command
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, candidate| {
                assert_eq!(candidate.price_id, expected_price);
                Ok(returned.clone())
            })),
        BillingSeatCommandsMock::claim_billing_seat_command
            .next_call(matching!(_, _, _, _))
            .returns(Ok(Some(claimed.clone()))),
    ))
}

fn deletion(
    work: &mut dyn Transaction,
    claimed: &BillingSeatCommand,
) -> mkc_store_interface::error::Result<()> {
    let expected_id = claimed.id;
    let mut queries = Unimock::new((
        BillingSeatCommandsMock::billing_seat_command
            .next_call(matching!(_, _))
            .returns(Ok(Some(claimed.clone()))),
        BillingSeatCommandsMock::delete_billing_seat_command
            .next_call(matching!(_))
            .answers_arc(Arc::new(move |_, id| {
                assert_eq!(id, expected_id);
                Ok(())
            })),
    ));
    assert_eq!(work.run(&mut queries)?, Decision::Commit);
    Ok(())
}

fn command(
    organization: OrganizationId,
    now: DateTime<Utc>,
    id: u128,
    lease: u128,
    price: &str,
) -> BillingSeatCommand {
    BillingSeatCommand {
        id: Uuid::from_u128(id),
        organization_id: organization,
        seat_kind: SeatKind::Editor,
        provider_subscription_id: "sub_fixture".into(),
        operation: SeatCommandOperation::Create,
        provider_item_id: None,
        price_id: price.into(),
        quantity: 1,
        idempotency_key: format!("seats:{organization}:editor:{id}"),
        due_at: now,
        attempts: 1,
        lease: Some(Uuid::from_u128(lease)),
        lease_until: Some(now + Duration::minutes(5)),
        created_at: now,
    }
}

fn subscription(organization: OrganizationId, now: DateTime<Utc>) -> BillingSubscription {
    BillingSubscription {
        organization_id: organization,
        provider_subscription_id: "sub_fixture".into(),
        status: SubscriptionStatus::Active,
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

fn item(kind: SeatKind, quantity: i32) -> BillingSubscriptionItem {
    BillingSubscriptionItem {
        id: Uuid::from_u128(2),
        organization_id: OrganizationId(Uuid::from_u128(1)),
        seat_kind: kind,
        provider_item_id: format!("si_{}", kind.as_str()),
        price_id: format!("price_{}", kind.as_str()),
        quantity,
    }
}
