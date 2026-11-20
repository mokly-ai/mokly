//! Customer, Checkout, and Portal request contracts.

use std::collections::BTreeMap;

use mkc_billing_interface::http::Method;
use mkc_billing_interface::provider::{BillingProvider, CreateCheckout, CreateCustomer, LineItem};

use super::fixtures::{Expected, client, expected, recorded, response};

const ORGANIZATION: &str = "01998a00-0000-7000-8000-000000000001";

#[test]
fn customer_checkout_and_portal_writes_encode_exact_forms_and_keys() {
    let metadata = BTreeMap::from([("organization_id".to_owned(), ORGANIZATION.to_owned())]);
    let stripe = client(recorded(vec![
        (
            expected(
                Method::Post,
                "/v1/customers",
                Some(&format!("customer:{ORGANIZATION}")),
                vec![
                    ("name", "Fixture Organization"),
                    ("email", "owner@example.com"),
                    ("metadata[organization_id]", ORGANIZATION),
                ],
            ),
            response("customer"),
        ),
        (checkout_expected(), response("checkout-session")),
        (checkout_expected(), response("checkout-session")),
        (
            expected(
                Method::Post,
                "/v1/billing_portal/sessions",
                Some("portal:request-fixture"),
                vec![
                    ("customer", "cus_fixture"),
                    ("return_url", "https://app.example.com/settings/billing"),
                ],
            ),
            response("portal-session"),
        ),
    ]));

    let customer = stripe
        .create_customer(&CreateCustomer {
            name: "Fixture Organization".to_owned(),
            email: "owner@example.com".to_owned(),
            metadata: metadata.clone(),
        })
        .unwrap();
    assert_eq!(customer.id, "cus_fixture");
    assert_eq!(customer.extra.get("object").unwrap(), "customer");

    let checkout_input = CreateCheckout {
        customer: customer.id,
        client_reference_id: ORGANIZATION.to_owned(),
        success_url: "https://app.example.com/settings/billing?checkout=success".to_owned(),
        cancel_url: "https://app.example.com/settings/billing?checkout=cancelled".to_owned(),
        line_items: vec![
            LineItem {
                price: "price_editor_fixture".to_owned(),
                quantity: 3,
            },
            LineItem {
                price: "price_collaborator_fixture".to_owned(),
                quantity: 2,
            },
        ],
        trial_period_days: Some(7),
        automatic_tax: true,
        collect_billing_address: true,
        save_customer_address: true,
        expires_at: Some(1_800_001_800),
        metadata,
        idempotency_key: "checkout:request-fixture".to_owned(),
    };
    let checkout = stripe.create_checkout_session(&checkout_input).unwrap();
    assert_eq!(checkout.id, "cs_test_fixture");
    assert!(checkout.url.unwrap().contains("cs_test_fixture"));
    assert_eq!(
        stripe.create_checkout_session(&checkout_input).unwrap().id,
        "cs_test_fixture"
    );

    let portal = stripe
        .create_portal_session(
            "cus_fixture",
            "https://app.example.com/settings/billing",
            "portal:request-fixture",
        )
        .unwrap();
    assert_eq!(portal.id, "bps_fixture");
}

fn checkout_expected() -> Expected {
    expected(
        Method::Post,
        "/v1/checkout/sessions",
        Some("checkout:request-fixture"),
        vec![
            ("mode", "subscription"),
            ("customer", "cus_fixture"),
            ("client_reference_id", ORGANIZATION),
            (
                "success_url",
                "https://app.example.com/settings/billing?checkout=success",
            ),
            (
                "cancel_url",
                "https://app.example.com/settings/billing?checkout=cancelled",
            ),
            ("line_items[0][price]", "price_editor_fixture"),
            ("line_items[0][quantity]", "3"),
            ("line_items[1][price]", "price_collaborator_fixture"),
            ("line_items[1][quantity]", "2"),
            ("subscription_data[trial_period_days]", "7"),
            ("automatic_tax[enabled]", "true"),
            ("billing_address_collection", "required"),
            ("customer_update[address]", "auto"),
            ("expires_at", "1800001800"),
            ("metadata[organization_id]", ORGANIZATION),
            ("subscription_data[metadata][organization_id]", ORGANIZATION),
        ],
    )
}
