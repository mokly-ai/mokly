//! Subscription reads, cancellation, and item mutation request contracts.

use mkc_billing_interface::http::Method;
use mkc_billing_interface::objects::{ExpandableInvoice, InvoiceStatus, SubscriptionStatus};
use mkc_billing_interface::provider::BillingProvider;

use super::fixtures::{client, expected, recorded, response};

#[test]
fn subscription_and_item_operations_use_exact_paths_forms_and_idempotency_keys() {
    let stripe = client(recorded(vec![
        (
            expected(
                Method::Get,
                "/v1/subscriptions/sub_fixture",
                None,
                vec![("expand[]", "items"), ("expand[]", "latest_invoice")],
            ),
            response("subscription"),
        ),
        (
            expected(
                Method::Delete,
                "/v1/subscriptions/sub_fixture",
                Some("cancel:sub_fixture"),
                Vec::new(),
            ),
            response("canceled-subscription"),
        ),
        (
            expected(
                Method::Post,
                "/v1/subscription_items",
                Some("seats:create:fixture"),
                vec![
                    ("subscription", "sub_fixture"),
                    ("price", "price_collaborator_fixture"),
                    ("quantity", "2"),
                ],
            ),
            response("subscription-item-created"),
        ),
        (
            expected(
                Method::Post,
                "/v1/subscription_items/si_collaborator_fixture",
                Some("seats:update:fixture"),
                vec![("quantity", "4")],
            ),
            response("subscription-item-updated"),
        ),
        (
            expected(
                Method::Delete,
                "/v1/subscription_items/si_collaborator_fixture",
                None,
                Vec::new(),
            ),
            response("deleted-item"),
        ),
    ]));

    let subscription = stripe.retrieve_subscription("sub_fixture").unwrap();
    assert_eq!(subscription.status, SubscriptionStatus::Trialing);
    assert_eq!(subscription.items.data.len(), 2);
    assert_eq!(subscription.items.data[0].current_period_end, 1_790_596_800);
    assert_eq!(subscription.items.data[1].current_period_end, 1_790_596_800);
    assert_eq!(
        subscription.items.data[0].price.lookup_key.as_deref(),
        Some("mokly_team_editor_usd_month")
    );
    assert_eq!(
        subscription.items.data[1].price.lookup_key.as_deref(),
        Some("mokly_team_collaborator_usd_month")
    );
    let Some(ExpandableInvoice::Object(invoice)) = subscription.latest_invoice else {
        panic!("latest invoice was not expanded");
    };
    assert!(!invoice.attempted);
    assert_eq!(invoice.status, Some(InvoiceStatus::Draft));
    assert_eq!(subscription.items.has_more, Some(false));
    assert_eq!(
        subscription.items.data[0]
            .extra
            .get("object")
            .and_then(|value| value.as_str()),
        Some("subscription_item")
    );

    let canceled = stripe.cancel_subscription("sub_fixture").unwrap();
    assert_eq!(canceled.status, SubscriptionStatus::Canceled);

    let created = stripe
        .create_subscription_item(
            "sub_fixture",
            "price_collaborator_fixture",
            2,
            "seats:create:fixture",
        )
        .unwrap();
    assert_eq!(created.quantity, 2);
    assert_eq!(
        created.price.lookup_key.as_deref(),
        Some("mokly_team_collaborator_usd_month")
    );

    let updated = stripe
        .update_subscription_item("si_collaborator_fixture", 4, "seats:update:fixture")
        .unwrap();
    assert_eq!(updated.quantity, 4);
    assert_eq!(
        updated.price.lookup_key.as_deref(),
        Some("mokly_team_collaborator_usd_month")
    );

    stripe
        .delete_subscription_item("si_collaborator_fixture")
        .unwrap();
}

#[test]
fn invalid_path_segments_quantities_and_keys_fail_before_http() {
    let stripe = client(unimock::Unimock::new(()));
    assert!(stripe.retrieve_subscription("../subscriptions").is_err());
    assert!(
        stripe
            .create_subscription_item("sub_fixture", "price_fixture", 0, "key")
            .is_err()
    );
    assert!(
        stripe
            .update_subscription_item("si_fixture", 1, "")
            .is_err()
    );
    assert!(stripe.delete_subscription_item("").is_err());
}
