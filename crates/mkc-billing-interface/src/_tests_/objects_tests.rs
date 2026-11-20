//! Forward-compatible status and event classification at the typed boundary.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use serde_json::json;

use crate::objects::{
    Event, EventKind, ExpandableInvoice, InvoiceStatus, PriceRef, Subscription, SubscriptionStatus,
};

#[test]
fn unknown_subscription_status_decodes_without_becoming_known() {
    let subscription: Subscription = serde_json::from_value(json!({
        "id": "sub_fixture",
        "customer": "cus_fixture",
        "status": "future_status",
        "items": {"object": "list", "data": []},
        "cancel_at_period_end": false,
        "trial_end": null,
        "latest_invoice": null,
        "metadata": {},
        "future_field": true
    }))
    .unwrap();
    assert_eq!(subscription.status, SubscriptionStatus::Unknown);
    assert_eq!(subscription.extra.get("future_field"), Some(&json!(true)));
}

#[test]
fn embedded_price_metadata_defaults_and_decodes() {
    let absent: PriceRef = serde_json::from_value(json!({"id":"price_old"})).unwrap();
    assert!(absent.metadata.is_empty());
    let present: PriceRef = serde_json::from_value(json!({
        "id":"price_old",
        "metadata":{"mokly_seat_kind":"editor"}
    }))
    .unwrap();
    assert_eq!(present.metadata["mokly_seat_kind"], "editor");
}

#[test]
fn expanded_latest_invoice_decodes_typed_payment_state() {
    let subscription: Subscription = serde_json::from_value(json!({
        "id": "sub_fixture",
        "customer": "cus_fixture",
        "status": "active",
        "items": {"object": "list", "data": []},
        "cancel_at_period_end": false,
        "trial_end": null,
        "latest_invoice": {
            "id": "in_fixture",
            "attempted": true,
            "status": "open",
            "future_field": true
        },
        "metadata": {}
    }))
    .unwrap();
    let Some(ExpandableInvoice::Object(invoice)) = subscription.latest_invoice else {
        panic!("latest invoice was not expanded");
    };
    assert!(invoice.attempted);
    assert_eq!(invoice.status, Some(InvoiceStatus::Open));
    assert_eq!(invoice.extra.get("future_field"), Some(&json!(true)));
}

#[test]
fn event_names_map_to_the_six_typed_handlers_and_unknown() {
    let known = [
        (
            "checkout.session.completed",
            EventKind::CheckoutSessionCompleted,
        ),
        (
            "customer.subscription.created",
            EventKind::CustomerSubscriptionCreated,
        ),
        (
            "customer.subscription.updated",
            EventKind::CustomerSubscriptionUpdated,
        ),
        (
            "customer.subscription.deleted",
            EventKind::CustomerSubscriptionDeleted,
        ),
        ("invoice.paid", EventKind::InvoicePaid),
        ("invoice.payment_failed", EventKind::InvoicePaymentFailed),
    ];
    for (name, expected) in known {
        assert_eq!(EventKind::from_type(name), expected);
    }
    let event: Event = serde_json::from_value(json!({
        "id": "evt_fixture",
        "type": "customer.future_event",
        "created": 1,
        "data": {"object": {"id": "object_fixture"}}
    }))
    .unwrap();
    assert_eq!(event.kind(), EventKind::Unknown);
}
