//! Recorded GitHub rate-limit headers drive bounded retries and typed delays.

use std::sync::Arc;
use std::time::Duration;

use mkc_github_interface::credentials::{ClockMock, SleeperMock};
use mkc_github_interface::error::Error;
use mkc_github_interface::http::{Http, Method, Request};
use unimock::{MockFn, Unimock, matching};

use crate::response;
use crate::transport::RetryingHttp;

use super::fixtures::response as fixture;
use super::fixtures::{api, now, recorded};

fn request() -> Request {
    Request {
        method: Method::Post,
        endpoint: api("/check"),
        bearer: None,
        body: Some("{}".into()),
    }
}

#[test]
fn secondary_403_honors_retry_after_and_retries_once() {
    let http: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![
            (Method::Post, api("/check"), fixture("secondary-limit")),
            (Method::Post, api("/check"), fixture("check-create")),
        ])),
        clock: Arc::new(Unimock::new(
            ClockMock::now.each_call(matching!()).returns(now()),
        )),
        sleeper: Arc::new(Unimock::new(
            SleeperMock::sleep
                .some_call(matching!(_))
                .answers(&|_, duration| assert_eq!(duration, Duration::from_secs(60))),
        )),
    };
    let mut request = request();
    request.bearer = Some(mkc_github_interface::credentials::Secret::new(
        "fixture".into(),
    ));
    assert_eq!(http.send(&request).unwrap().status, 201);
}

#[test]
fn primary_exhaustion_returns_the_reset_deadline_without_blocking() {
    let http: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![(
            Method::Post,
            api("/check"),
            fixture("primary-limit"),
        )])),
        clock: Arc::new(Unimock::new(
            ClockMock::now.some_call(matching!()).returns(now()),
        )),
        sleeper: Arc::new(Unimock::new(())),
    };
    let mut request = request();
    request.bearer = Some(mkc_github_interface::credentials::Secret::new(
        "fixture".into(),
    ));
    assert!(matches!(
        http.send(&request),
        Err(Error::RateLimited { retry_after: 3600 })
    ));
}

#[test]
fn secondary_without_retry_header_uses_sixty_seconds_and_permission_403_does_not_retry() {
    let mut secondary = fixture("secondary-limit");
    secondary.headers.remove("retry-after");
    assert_eq!(
        response::retry_after(&secondary, now().timestamp()),
        Some(60)
    );
    assert_eq!(
        response::retry_after(&fixture("forbidden"), now().timestamp()),
        None
    );
    assert!(matches!(
        response::checked(fixture("forbidden")),
        Err(Error::Forbidden)
    ));
}

#[test]
fn later_reset_wins_over_retry_after_and_zero_delays_become_positive() {
    let mut response = fixture("primary-limit");
    response.headers.insert("retry-after".into(), "1".into());
    assert_eq!(
        response::retry_after(&response, now().timestamp()),
        Some(3600)
    );
    response.headers.insert(
        "x-ratelimit-reset".into(),
        (now().timestamp() - 1).to_string(),
    );
    response.headers.insert("retry-after".into(), "0".into());
    assert_eq!(response::retry_after(&response, now().timestamp()), Some(1));
}

#[test]
fn repeated_secondary_limits_stop_after_one_wait() {
    let http: &dyn Http = &RetryingHttp {
        http: Arc::new(recorded(vec![
            (Method::Post, api("/check"), fixture("secondary-limit")),
            (Method::Post, api("/check"), fixture("secondary-limit")),
        ])),
        clock: Arc::new(Unimock::new(
            ClockMock::now.each_call(matching!()).returns(now()),
        )),
        sleeper: Arc::new(Unimock::new(
            SleeperMock::sleep
                .some_call(matching!(_))
                .answers(&|_, duration| assert_eq!(duration, Duration::from_secs(60))),
        )),
    };
    let mut request = request();
    request.bearer = Some(mkc_github_interface::credentials::Secret::new(
        "fixture".into(),
    ));
    assert!(matches!(
        http.send(&request),
        Err(Error::RateLimited { retry_after: 60 })
    ));
}
