//! Prepared reqwest requests prove headers, form encoding, and origin safety.

use std::time::Duration;

use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::{Method, Request};

use crate::transport::{HttpFactory, ReqwestFactory, STRIPE_VERSION, reqwest_http};

fn request(method: Method, path: &str) -> Request {
    Request {
        method,
        path: path.to_owned(),
        bearer: Secret::new("sk_test_fixture".to_owned()),
        idempotency_key: Some("fixture:key".to_owned()),
        form: vec![
            ("mode".to_owned(), "subscription".to_owned()),
            (
                "line_items[0][price]".to_owned(),
                "price_fixture".to_owned(),
            ),
        ],
    }
}

#[test]
fn write_request_has_exact_auth_version_idempotency_and_encoded_form() {
    let prepared = reqwest_http("https://api.stripe.com", Duration::from_secs(30))
        .unwrap()
        .prepare(&request(Method::Post, "/v1/checkout/sessions"))
        .unwrap();
    assert_eq!(prepared.method(), reqwest::Method::POST);
    assert_eq!(
        prepared.url().as_str(),
        "https://api.stripe.com/v1/checkout/sessions"
    );
    assert_eq!(
        prepared.headers()["authorization"],
        "Bearer sk_test_fixture"
    );
    assert_eq!(prepared.headers()["stripe-version"], STRIPE_VERSION);
    assert_eq!(prepared.headers()["idempotency-key"], "fixture:key");
    assert_eq!(prepared.headers()["user-agent"], "Mokly-Cloud-Billing");
    assert_eq!(
        prepared.headers()["content-type"],
        "application/x-www-form-urlencoded"
    );
    assert_eq!(
        prepared.body().unwrap().as_bytes().unwrap(),
        b"mode=subscription&line_items%5B0%5D%5Bprice%5D=price_fixture"
    );
}

#[test]
fn read_request_places_form_fields_in_the_query_without_a_body() {
    let mut input = request(Method::Get, "/v1/subscriptions/sub_fixture");
    input.idempotency_key = None;
    input.form = vec![("expand[]".to_owned(), "items".to_owned())];
    let prepared = reqwest_http("https://api.stripe.com", Duration::from_secs(30))
        .unwrap()
        .prepare(&input)
        .unwrap();
    assert_eq!(
        prepared.url().as_str(),
        "https://api.stripe.com/v1/subscriptions/sub_fixture?expand%5B%5D=items"
    );
    assert!(prepared.body().is_none());
    assert!(!prepared.headers().contains_key("content-type"));
}

#[test]
fn invalid_origins_and_paths_are_rejected_before_network_access() {
    for origin in [
        "not-an-origin",
        "https://user:secret@api.stripe.com",
        "https://api.stripe.com/root",
        "file:///tmp/stripe",
    ] {
        assert!(matches!(
            ReqwestFactory.build(origin, Duration::from_secs(30)),
            Err(Error::InvalidRequest { .. })
        ));
    }
    let http = reqwest_http("https://api.stripe.com", Duration::from_secs(30)).unwrap();
    for path in [
        "/v2/customers",
        "//evil.example/v1/customers",
        "/v1/../secret",
        "/v1/customers?key=value",
        "/v1/customers#fragment",
    ] {
        assert!(matches!(
            http.prepare(&request(Method::Post, path)),
            Err(Error::InvalidRequest { .. })
        ));
    }
}

#[test]
fn verification_transport_carries_the_short_timeout() {
    let prepared = reqwest_http("https://api.stripe.com", Duration::from_secs(5))
        .unwrap()
        .prepare(&request(Method::Get, "/v1/prices/price_fixture"))
        .unwrap();
    assert_eq!(prepared.timeout(), Some(&Duration::from_secs(5)));
}
