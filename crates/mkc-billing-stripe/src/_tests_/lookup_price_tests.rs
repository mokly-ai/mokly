//! Lookup-key price reads are single, bounded, expanded requests.

use mkc_billing_interface::catalogue::ExpandableProduct;
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::Method;
use mkc_billing_interface::provider::BillingProvider;

use super::fixtures::{client, expected, recorded, response};

fn lookup_keys() -> Vec<String> {
    vec![
        "mokly_team_editor_usd_month".to_owned(),
        "mokly_team_collaborator_usd_month".to_owned(),
    ]
}

fn lookup_request() -> super::fixtures::Expected {
    expected(
        Method::Get,
        "/v1/prices",
        None,
        vec![
            ("active", "true"),
            ("lookup_keys[]", "mokly_team_editor_usd_month"),
            ("lookup_keys[]", "mokly_team_collaborator_usd_month"),
            ("expand[]", "data.product"),
            ("limit", "10"),
        ],
    )
}

#[test]
fn lookup_key_read_decodes_both_expanded_prices() {
    let stripe = client(recorded(vec![(
        lookup_request(),
        response("prices-by-lookup-key"),
    )]));
    let prices = stripe.list_prices_by_lookup_keys(&lookup_keys()).unwrap();
    assert_eq!(prices.len(), 2);
    assert_eq!(
        prices[0].lookup_key.as_deref(),
        Some(lookup_keys()[0].as_str())
    );
    assert_eq!(
        prices[1].lookup_key.as_deref(),
        Some(lookup_keys()[1].as_str())
    );
    assert!(matches!(prices[0].product, ExpandableProduct::Object(_)));
    assert_eq!(prices[0].product.id(), prices[1].product.id());
}

#[test]
fn lookup_key_read_preserves_an_empty_result() {
    let stripe = client(recorded(vec![(
        lookup_request(),
        response("prices-by-lookup-key-empty"),
    )]));
    assert!(
        stripe
            .list_prices_by_lookup_keys(&lookup_keys())
            .unwrap()
            .is_empty()
    );
}

#[test]
fn lookup_key_read_rejects_an_impossible_extra_page() {
    let mut page = response("prices-by-lookup-key-empty");
    let mut body: serde_json::Value = serde_json::from_slice(&page.body).unwrap();
    body["has_more"] = serde_json::Value::Bool(true);
    page.body = serde_json::to_vec(&body).unwrap();
    let stripe = client(recorded(vec![(lookup_request(), page)]));
    assert!(matches!(
        stripe.list_prices_by_lookup_keys(&lookup_keys()),
        Err(Error::Internal(_))
    ));
}

#[test]
fn lookup_key_read_uses_existing_stripe_error_mapping() {
    let invalid = client(recorded(vec![(
        lookup_request(),
        response("invalid-request"),
    )]));
    assert!(matches!(
        invalid.list_prices_by_lookup_keys(&lookup_keys()),
        Err(Error::InvalidRequest { .. })
    ));

    let limited = client(recorded(vec![(lookup_request(), response("rate-limited"))]));
    assert!(matches!(
        limited.list_prices_by_lookup_keys(&lookup_keys()),
        Err(Error::RateLimited { retry_after: 2, .. })
    ));
}

#[test]
fn invalid_lookup_key_sets_fail_before_sending() {
    let stripe = client(unimock::Unimock::new(()));
    for keys in [
        Vec::new(),
        vec!["duplicate".to_owned(), "duplicate".to_owned()],
        vec![String::new()],
        vec!["x".repeat(201)],
        (0..11).map(|index| format!("key_{index}")).collect(),
    ] {
        assert!(matches!(
            stripe.list_prices_by_lookup_keys(&keys),
            Err(Error::InvalidRequest { .. })
        ));
    }
}
