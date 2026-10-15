//! Immediate revision handshake and ordered publication messages.

use std::convert::Infallible;

use axum::body::Body;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use tokio::sync::watch;

use crate::publication::Subscription;
use crate::response;

pub(crate) fn events(mut subscription: Subscription, mut stop: watch::Receiver<bool>) -> Response {
    let stream = async_stream::stream! {
        let mut state = subscription.current;
        loop {
            if *stop.borrow() { break; }
            let message = format!("id: {}\ndata: {}\n\n", state.revision, state.deployment_id);
            yield Ok::<_, Infallible>(message);
            tokio::select! {
                result = subscription.updates.recv() => { match result { Ok(next) => state = next, Err(_) => break } },
                _ = stop.changed() => break,
            }
        }
    };
    let mut response = response::bytes(StatusCode::OK, "text/event-stream", Vec::new());
    response.headers_mut().remove("content-length");
    response
        .headers_mut()
        .insert("x-accel-buffering", HeaderValue::from_static("no"));
    *response.body_mut() = Body::from_stream(stream);
    response
}
