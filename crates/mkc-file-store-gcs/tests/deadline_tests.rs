//! Credential acquisition consumes the same injected-clock request budget.

#![allow(clippy::unwrap_used)]

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use mkc_file_store_gcs::deadline::ClockMock;
use mkc_file_store_gcs::transport::{AccessTokenMock, Request, ReqwestHttpFactory};
use reqwest::Method;
use unimock::{MockFn, Unimock, matching};

#[test]
fn credential_time_exhausts_the_request_budget() {
    let now = Arc::new(Mutex::new(Instant::now()));
    let observed = now.clone();
    let clock = Unimock::new(
        ClockMock::now
            .each_call(matching!())
            .answers_arc(Arc::new(move |_| *observed.lock().unwrap())),
    );
    let advanced = now.clone();
    let credentials = Unimock::new(AccessTokenMock::token.next_call(matching!(_)).answers_arc(
        Arc::new(move |_, timeout| {
            assert_eq!(timeout, Duration::from_secs(60));
            *advanced.lock().unwrap() += Duration::from_secs(60);
            Ok("fixture-oauth".to_owned())
        }),
    ));
    let http = ReqwestHttpFactory
        .build_with_clock(Arc::new(credentials), Arc::new(clock))
        .unwrap();

    let result = http.execute(Request {
        method: Method::GET,
        url: "http://127.0.0.1:9/should-not-be-sent".into(),
        body: None,
        response_limit: 1,
        timeout: Duration::from_secs(60),
    });

    assert!(result.is_err());
}
