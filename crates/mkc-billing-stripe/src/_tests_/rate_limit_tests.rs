//! One bounded retry follows Stripe's positive `Retry-After` delay.

use std::sync::Arc;
use std::time::Duration;

use mkc_billing_interface::credentials::{Secret, SleeperMock};
use mkc_billing_interface::error::Error;
use mkc_billing_interface::http::{Http, Method, Request};
use unimock::{MockFn, Unimock, matching};

use crate::transport::RetryingHttp;

use super::fixtures::{expected, recorded, response};

fn request() -> Request {
    Request {
        method: Method::Post,
        path: "/v1/customers".to_owned(),
        bearer: Secret::new("sk_test_fixture".to_owned()),
        idempotency_key: Some("customer:fixture".to_owned()),
        form: Vec::new(),
    }
}

#[test]
fn short_rate_limit_waits_once_and_replays_the_request() {
    let expected_request = || {
        expected(
            Method::Post,
            "/v1/customers",
            Some("customer:fixture"),
            Vec::new(),
        )
    };
    let http: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![
            (expected_request(), response("rate-limited")),
            (expected_request(), response("customer")),
        ])),
        sleeper: Arc::new(Unimock::new(
            SleeperMock::sleep
                .some_call(matching!(_))
                .answers(&|_, duration| assert_eq!(duration, Duration::from_secs(2))),
        )),
    };
    assert_eq!(http.send(&request()).unwrap().status, 200);
}

#[test]
fn long_or_repeated_rate_limits_return_the_typed_delay() {
    let mut long = response("rate-limited");
    long.headers
        .insert("retry-after".to_owned(), "61".to_owned());
    let no_wait: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![(
            expected(
                Method::Post,
                "/v1/customers",
                Some("customer:fixture"),
                Vec::new(),
            ),
            long,
        )])),
        sleeper: Arc::new(Unimock::new(())),
    };
    assert!(matches!(
        no_wait.send(&request()),
        Err(Error::RateLimited {
            retry_after: 61,
            ..
        })
    ));

    let expected_request = || {
        expected(
            Method::Post,
            "/v1/customers",
            Some("customer:fixture"),
            Vec::new(),
        )
    };
    let repeated: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![
            (expected_request(), response("rate-limited")),
            (expected_request(), response("rate-limited")),
        ])),
        sleeper: Arc::new(Unimock::new(
            SleeperMock::sleep
                .some_call(matching!(_))
                .answers(&|_, duration| assert_eq!(duration, Duration::from_secs(2))),
        )),
    };
    assert!(matches!(
        repeated.send(&request()),
        Err(Error::RateLimited { retry_after: 2, .. })
    ));
}
