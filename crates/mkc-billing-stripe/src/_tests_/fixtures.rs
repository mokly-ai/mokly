//! Sanitized recorded responses and strict request-script helpers.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};

use mkc_billing_interface::credentials::Secret;
use mkc_billing_interface::http::{HttpMock, Method, Request, Response};
use serde::Deserialize;
use serde_json::Value;
use unimock::{MockFn, Unimock, matching};

use crate::client::StripeClient;

#[derive(Deserialize)]
struct Recorded {
    status: u16,
    headers: BTreeMap<String, String>,
    body: Value,
}

pub(super) struct Expected {
    pub(super) method: Method,
    pub(super) path: String,
    pub(super) idempotency_key: Option<String>,
    pub(super) form: Vec<(String, String)>,
}

pub(super) fn response(name: &str) -> Response {
    let source = match name {
        "customer" => include_str!("../../fixtures/customer.json"),
        "checkout-session" => include_str!("../../fixtures/checkout-session.json"),
        "portal-session" => include_str!("../../fixtures/portal-session.json"),
        "subscription" => include_str!("../../fixtures/subscription.json"),
        "canceled-subscription" => include_str!("../../fixtures/canceled-subscription.json"),
        "products-page" => include_str!("../../fixtures/products-page.json"),
        "products-page-last" => include_str!("../../fixtures/products-page-last.json"),
        "product-created" => include_str!("../../fixtures/product-created.json"),
        "product-updated" => include_str!("../../fixtures/product-updated.json"),
        "prices-by-lookup-key" => {
            include_str!("../../fixtures/prices-by-lookup-key.json")
        }
        "prices-by-lookup-key-empty" => {
            include_str!("../../fixtures/prices-by-lookup-key-empty.json")
        }
        "product-prices-page" => include_str!("../../fixtures/product-prices-page.json"),
        "product-prices-page-last" => {
            include_str!("../../fixtures/product-prices-page-last.json")
        }
        "price-created" => include_str!("../../fixtures/price-created.json"),
        "price-updated" => include_str!("../../fixtures/price-updated.json"),
        "price-archived" => include_str!("../../fixtures/price-archived.json"),
        "price-retrieved" => include_str!("../../fixtures/price-retrieved.json"),
        "subscription-item-created" => {
            include_str!("../../fixtures/subscription-item-created.json")
        }
        "subscription-item-updated" => {
            include_str!("../../fixtures/subscription-item-updated.json")
        }
        "deleted-item" => include_str!("../../fixtures/deleted-item.json"),
        "rate-limited" => include_str!("../../fixtures/rate-limited.json"),
        "invalid-request" => include_str!("../../fixtures/invalid-request.json"),
        "forbidden" => include_str!("../../fixtures/forbidden.json"),
        "not-found" => include_str!("../../fixtures/not-found.json"),
        "unavailable" => include_str!("../../fixtures/unavailable.json"),
        _ => panic!("unknown Stripe recording: {name}"),
    };
    let record: Recorded = serde_json::from_str(source).unwrap();
    Response {
        status: record.status,
        headers: record.headers,
        body: serde_json::to_vec(&record.body).unwrap(),
    }
}

pub(super) fn recorded(steps: Vec<(Expected, Response)>) -> Unimock {
    let count = steps.len();
    let steps = Mutex::new(VecDeque::from(steps));
    Unimock::new(
        HttpMock::send
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, request: &Request| {
                let (expected, response) = steps
                    .lock()
                    .unwrap()
                    .pop_front()
                    .expect("extra Stripe request");
                assert_eq!(request.method, expected.method);
                assert_eq!(request.path, expected.path);
                assert_eq!(request.idempotency_key, expected.idempotency_key);
                assert_eq!(request.form, expected.form);
                assert_eq!(request.bearer.expose(), "sk_test_fixture");
                Ok(response)
            }))
            .n_times(count),
    )
}

pub(super) fn client(http: Unimock) -> StripeClient {
    StripeClient {
        http: Arc::new(http),
        key: Secret::new("sk_test_fixture".to_owned()),
    }
}

pub(super) fn expected(
    method: Method,
    path: &str,
    idempotency_key: Option<&str>,
    form: Vec<(&str, &str)>,
) -> Expected {
    Expected {
        method,
        path: path.to_owned(),
        idempotency_key: idempotency_key.map(str::to_owned),
        form: form
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value.to_owned()))
            .collect(),
    }
}
