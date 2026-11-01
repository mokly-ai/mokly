//! Overlapping responses share verification while preserving their independent bytes.

use std::fs;
use std::future::poll_fn;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::body::{Body, HttpBody, to_bytes};
use axum::http::Method;
use tokio::sync::Barrier;

use crate::support::Harness;

use super::support::{
    CountedAssets, LENGTH, OTHER, ROUTE, fixture, generation, payload, request, router,
};

#[tokio::test]
async fn eight_get_and_head_requests_share_one_verified_copy() {
    let harness = Harness::with_edit(fixture).await;
    let copies = Arc::new(CountedAssets::default());
    let app = router(&harness, harness.generation.clone(), copies.clone());
    let first = request(&app, Method::GET, ROUTE).await;
    let start = Arc::new(Barrier::new(7));
    let mut requests = Vec::new();
    for index in 1..8 {
        let app = app.clone();
        let start = start.clone();
        requests.push(tokio::spawn(async move {
            start.wait().await;
            let method = if index == 7 {
                Method::HEAD
            } else {
                Method::GET
            };
            (index, request(&app, method, ROUTE).await)
        }));
    }
    let mut responses = vec![(0, first)];
    for request in requests {
        responses.push(request.await.unwrap());
    }
    assert_eq!(copies.0.load(Ordering::SeqCst), 1);
    for (index, response) in responses {
        assert_eq!(response.status(), 200);
        assert_eq!(response.headers()["content-length"], LENGTH.to_string());
        assert_eq!(response.headers()["content-type"], "image/svg+xml");
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let expected = if index == 7 { Vec::new() } else { payload() };
        assert_eq!(body.as_ref(), expected);
    }
    harness.close().await;
}

#[tokio::test]
async fn last_response_releases_copy_and_next_request_checks_source_again() {
    let harness = Harness::with_edit(fixture).await;
    let copies = Arc::new(CountedAssets::default());
    let app = router(&harness, harness.generation.clone(), copies.clone());
    let first = request(&app, Method::GET, ROUTE).await;
    fs::write(
        harness.root.path().join("css/opaque.svg"),
        vec![b'n'; LENGTH],
    )
    .unwrap();
    let second = request(&app, Method::GET, ROUTE).await;
    assert_eq!(second.status(), 200);
    assert_eq!(
        to_bytes(first.into_body(), usize::MAX)
            .await
            .unwrap()
            .as_ref(),
        payload()
    );
    let head = request(&app, Method::HEAD, ROUTE).await;
    assert_eq!(head.status(), 200);
    assert_eq!(head.headers()["content-length"], LENGTH.to_string());
    assert_eq!(
        to_bytes(second.into_body(), usize::MAX)
            .await
            .unwrap()
            .as_ref(),
        payload()
    );
    let later = request(&app, Method::GET, ROUTE).await;
    assert_eq!(later.status(), 500);
    assert_eq!(copies.0.load(Ordering::SeqCst), 2);
    harness.close().await;
}

#[tokio::test]
async fn routes_and_generations_keep_separate_copies_with_independent_read_positions() {
    let harness = Harness::with_edit(fixture).await;
    let copies = Arc::new(CountedAssets::default());
    let old = router(&harness, harness.generation.clone(), copies.clone());
    let mut first = request(&old, Method::GET, ROUTE).await.into_body();
    let mut second = request(&old, Method::GET, ROUTE).await.into_body();
    let other = request(&old, Method::GET, OTHER).await;
    let other_second = request(&old, Method::GET, OTHER).await;
    fs::write(
        harness.root.path().join("css/opaque.svg"),
        vec![b'n'; LENGTH],
    )
    .unwrap();
    let new = router(&harness, generation(harness.root.path()), copies.clone());
    let next = request(&new, Method::GET, ROUTE).await;
    let next_second = request(&new, Method::GET, ROUTE).await;
    assert_eq!(next.status(), 200);
    assert_eq!(next_second.status(), 200);
    assert_eq!(copies.0.load(Ordering::SeqCst), 3);
    let mut first_bytes = Vec::new();
    let mut second_bytes = Vec::new();
    loop {
        let (left, right) = tokio::join!(chunk(&mut first), chunk(&mut second));
        if left.is_none() && right.is_none() {
            break;
        }
        first_bytes.extend(left.unwrap_or_default());
        second_bytes.extend(right.unwrap_or_default());
    }
    assert_eq!(first_bytes, payload());
    assert_eq!(second_bytes, payload());
    for response in [other, other_second] {
        assert_eq!(
            to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap()
                .as_ref(),
            vec![b'o'; LENGTH]
        );
    }
    for response in [next, next_second] {
        assert_eq!(
            to_bytes(response.into_body(), usize::MAX)
                .await
                .unwrap()
                .as_ref(),
            vec![b'n'; LENGTH]
        );
    }
    harness.close().await;
}

async fn chunk(body: &mut Body) -> Option<Vec<u8>> {
    poll_fn(|context| Pin::new(&mut *body).poll_frame(context))
        .await
        .map(|frame| frame.unwrap().into_data().unwrap().to_vec())
}
