//! Immediate revision handshake and ordered publication messages.

use std::convert::Infallible;
use std::time::Duration;

use axum::body::Bytes;
use axum::http::{HeaderValue, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use tokio::sync::watch;

use crate::publication::Subscription;
use crate::response;

pub(crate) fn events(mut subscription: Subscription, mut stop: watch::Receiver<bool>) -> Response {
    let stream = async_stream::stream! {
        let mut state = subscription.current;
        loop {
            if *stop.borrow() { break; }
            let message = Event::default().id(state.revision.to_string()).data(&state.deployment_id);
            yield Ok::<_, Infallible>(message);
            tokio::select! {
                result = subscription.updates.recv() => { match result { Ok(next) => state = next, Err(_) => break } },
                _ = stop.changed() => break,
            }
        }
    };
    let mut response = response::bytes(StatusCode::OK, "text/event-stream", Bytes::new());
    response.headers_mut().remove("content-length");
    response
        .headers_mut()
        .insert("x-accel-buffering", HeaderValue::from_static("no"));
    *response.body_mut() = Sse::new(stream)
        .keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("keep-alive"),
        )
        .into_response()
        .into_body();
    response
}
#[cfg(test)]
#[path = "_tests_/live_tests.rs"]
mod live_tests;
