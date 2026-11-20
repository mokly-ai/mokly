//! Provider subscriptions normalize to finite local status, items, and plans.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use std::collections::BTreeMap;
use std::io;

use chrono::{TimeZone, Utc};
use mkc_billing_interface::error::{Error as ProviderError, ProviderDetail};
use mkc_billing_interface::objects::{
    List, PriceRef, Subscription, SubscriptionItem, SubscriptionStatus,
};
use mkc_domain::ids::OrganizationId;
use mkc_domain::values::{Plan, SeatKind};
use mkc_store_interface::billing_state::BillingFailure;
use mkc_store_interface::billing_subscription::BillingSubscriptionItem;
use uuid::Uuid;

use crate::prices::VerifiedPriceIds;
use crate::retry::retry_deadline;
use crate::worker::plan::{item_seat_kind, normalize};
use crate::worker::retry::{AttemptError, due_at};

#[test]
fn live_subscription_normalizes_items_and_maximum_period() {
    let normalized = normalize(
        &subscription(SubscriptionStatus::Active),
        Some(&verified_prices()),
        &[],
    )
    .unwrap();
    assert_eq!(normalized.plan, Plan::Team);
    assert_eq!(normalized.items.len(), 2);
    assert_eq!(normalized.items[0].seat_kind, SeatKind::Editor);
    assert_eq!(
        normalized.current_period_end.unwrap().timestamp(),
        1_800_000_100
    );
}

#[test]
fn unknown_status_and_price_are_malformed() {
    assert!(
        normalize(
            &subscription(SubscriptionStatus::Unknown),
            Some(&verified_prices()),
            &[],
        )
        .is_err()
    );
    let mut unknown_price = subscription(SubscriptionStatus::Active);
    unknown_price.items.data[0].price.id = "price_other".into();
    unknown_price.items.data[0].price.lookup_key = None;
    assert!(normalize(&unknown_price, Some(&verified_prices()), &[]).is_err());
}

#[test]
fn replaced_price_uses_the_kind_stored_for_its_provider_item() {
    let provider_item = item(
        "si_editor",
        "price_replaced_without_lookup_key",
        1,
        1_800_000_000,
    );
    let stored = BillingSubscriptionItem {
        id: Uuid::from_u128(2),
        organization_id: organization(),
        seat_kind: SeatKind::Editor,
        provider_item_id: "si_editor".into(),
        price_id: "price_predecessor".into(),
        quantity: 1,
    };
    let prices = VerifiedPriceIds {
        editor: "price_editor".into(),
        collaborator: "price_collaborator".into(),
    };
    assert_eq!(
        item_seat_kind(&provider_item, Some(&prices), &[stored]),
        Some(SeatKind::Editor)
    );
}

#[test]
fn embedded_lookup_key_precedes_verified_and_stored_identities() {
    let mut provider_item = item("si_editor", "price_collaborator", 1, 1_800_000_000);
    provider_item.price.lookup_key = Some("mokly_team_editor_usd_month".into());
    provider_item
        .price
        .metadata
        .insert("mokly_seat_kind".into(), "collaborator".into());
    let stored = stored_item(SeatKind::Collaborator);
    assert_eq!(
        item_seat_kind(&provider_item, Some(&verified_prices()), &[stored]),
        Some(SeatKind::Editor)
    );
}

#[test]
fn verified_identity_precedes_the_stored_provider_item_kind() {
    let mut provider_item = item("si_editor", "price_editor", 1, 1_800_000_000);
    provider_item.price.lookup_key = None;
    provider_item
        .price
        .metadata
        .insert("mokly_seat_kind".into(), "collaborator".into());
    let stored = stored_item(SeatKind::Collaborator);
    assert_eq!(
        item_seat_kind(&provider_item, Some(&verified_prices()), &[stored]),
        Some(SeatKind::Editor)
    );
}

#[test]
fn embedded_seat_metadata_precedes_the_stored_provider_item_kind() {
    let mut provider_item = item("si_editor", "price_historical", 1, 1_800_000_000);
    provider_item
        .price
        .metadata
        .insert("mokly_seat_kind".into(), "editor".into());
    assert_eq!(
        item_seat_kind(
            &provider_item,
            Some(&verified_prices()),
            &[stored_item(SeatKind::Collaborator)],
        ),
        Some(SeatKind::Editor)
    );
}

#[test]
fn unknown_seat_metadata_falls_through_to_the_stored_kind() {
    let mut provider_item = item("si_editor", "price_historical", 1, 1_800_000_000);
    provider_item
        .price
        .metadata
        .insert("mokly_seat_kind".into(), "viewer".into());
    assert_eq!(
        item_seat_kind(
            &provider_item,
            Some(&verified_prices()),
            &[stored_item(SeatKind::Collaborator)],
        ),
        Some(SeatKind::Collaborator)
    );
}

#[test]
fn retry_schedule_is_exponential_and_honors_the_provider_minimum() {
    let now = Utc.with_ymd_and_hms(2026, 9, 22, 12, 0, 0).unwrap();
    let expected = [5, 10, 20, 40, 80, 160, 320, 320];
    for (attempt, delay) in (1..=8).zip(expected) {
        assert_eq!(due_at(now, attempt, 0).timestamp(), now.timestamp() + delay);
    }
    assert_eq!(due_at(now, 2, 45).timestamp(), now.timestamp() + 45);
    assert_eq!(
        retry_deadline(now, u64::MAX),
        chrono::DateTime::<Utc>::MAX_UTC
    );
}

#[test]
fn only_transient_provider_failures_enter_the_retry_queue() {
    let conflict = AttemptError::Conflict.policy();
    assert!(conflict.terminal);
    assert_eq!(conflict.category, BillingFailure::Conflict);
    for error in [
        ProviderError::InvalidRequest {
            detail: ProviderDetail::none(),
        },
        ProviderError::Unauthorized {
            detail: ProviderDetail::none(),
        },
        ProviderError::PermissionDenied {
            detail: ProviderDetail::none(),
        },
        ProviderError::NotFound {
            detail: ProviderDetail::none(),
        },
    ] {
        let policy = AttemptError::Provider(error).policy();
        assert!(policy.terminal);
        assert_eq!(policy.category, BillingFailure::Internal);
    }
    let unavailable = AttemptError::Provider(ProviderError::Unavailable).policy();
    assert!(!unavailable.terminal);
    assert_eq!(unavailable.category, BillingFailure::Unavailable);
    let internal =
        AttemptError::Provider(ProviderError::internal(io::Error::other("fixture"))).policy();
    assert!(!internal.terminal);
    assert_eq!(internal.category, BillingFailure::Internal);
}

fn subscription(status: SubscriptionStatus) -> Subscription {
    Subscription {
        id: "sub_fixture".into(),
        customer: "cus_fixture".into(),
        status,
        items: List {
            object: "list".into(),
            data: vec![
                item("si_editor", "price_editor", 1, 1_800_000_000),
                item("si_collaborator", "price_collaborator", 2, 1_800_000_100),
            ],
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

fn item(id: &str, price: &str, quantity: i64, period: i64) -> SubscriptionItem {
    SubscriptionItem {
        id: id.into(),
        price: PriceRef {
            id: price.into(),
            lookup_key: match price {
                "price_editor" => Some("mokly_team_editor_usd_month".into()),
                "price_collaborator" => Some("mokly_team_collaborator_usd_month".into()),
                _ => None,
            },
            metadata: BTreeMap::new(),
            extra: BTreeMap::new(),
        },
        quantity,
        current_period_end: period,
        extra: BTreeMap::new(),
    }
}

fn verified_prices() -> VerifiedPriceIds {
    VerifiedPriceIds {
        editor: "price_editor".into(),
        collaborator: "price_collaborator".into(),
    }
}

fn organization() -> OrganizationId {
    Uuid::from_u128(1).into()
}

fn stored_item(seat_kind: SeatKind) -> BillingSubscriptionItem {
    BillingSubscriptionItem {
        id: Uuid::from_u128(2),
        organization_id: organization(),
        seat_kind,
        provider_item_id: "si_editor".into(),
        price_id: "price_predecessor".into(),
        quantity: 1,
    }
}
