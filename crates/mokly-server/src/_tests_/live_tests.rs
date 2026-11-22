//! Slow event bodies terminate and a reconnect starts at the current identity.

use std::future::{Future, poll_fn};
use std::pin::Pin;
use std::task::{Context, Poll, Waker};
use std::time::Duration;

use axum::body::Body;
use tokio::sync::{broadcast, watch};

use crate::live::events;
use crate::publication::{PublicationEvent, Subscription};

async fn next(body: &mut Body) -> Option<String> {
    poll_fn(|context| hyper::body::Body::poll_frame(Pin::new(&mut *body), context))
        .await
        .map(|frame| String::from_utf8(frame.unwrap().into_data().unwrap().to_vec()).unwrap())
}

#[tokio::test]
async fn lagged_stream_ends_and_reconnect_handshake_catches_up() {
    let (updates, receiver) = broadcast::channel(2);
    let (stop, stopping) = watch::channel(false);
    let event = |revision| PublicationEvent {
        revision,
        deployment_id: "process".into(),
    };
    let mut body = events(
        Subscription {
            current: event(1),
            updates: receiver,
        },
        stopping.clone(),
    )
    .into_body();
    for revision in 2..=4 {
        assert!(updates.send(event(revision)).is_ok());
    }
    assert_eq!(
        next(&mut body).await.as_deref(),
        Some("id: 1\ndata: process\n\n")
    );
    assert!(next(&mut body).await.is_none());
    let mut reconnect = events(
        Subscription {
            current: event(4),
            updates: updates.subscribe(),
        },
        stopping,
    )
    .into_body();
    assert_eq!(
        next(&mut reconnect).await.as_deref(),
        Some("id: 4\ndata: process\n\n")
    );
    stop.send_replace(true);
    assert!(next(&mut reconnect).await.is_none());
}

#[tokio::test(start_paused = true)]
async fn idle_comments_keep_the_transport_alive_without_a_publication() {
    let (updates, receiver) = broadcast::channel(2);
    let (stop, stopping) = watch::channel(false);
    let event = |revision| PublicationEvent {
        revision,
        deployment_id: "process".into(),
    };
    let mut body = events(
        Subscription {
            current: event(1),
            updates: receiver,
        },
        stopping,
    )
    .into_body();
    assert_eq!(
        next(&mut body).await.as_deref(),
        Some("id: 1\ndata: process\n\n")
    );
    for _ in 0..2 {
        let mut comment = Box::pin(next(&mut body));
        let mut context = Context::from_waker(Waker::noop());
        assert!(comment.as_mut().poll(&mut context).is_pending());
        tokio::time::advance(Duration::from_millis(14_999)).await;
        assert!(comment.as_mut().poll(&mut context).is_pending());
        tokio::time::advance(Duration::from_millis(1)).await;
        assert!(
            matches!(comment.as_mut().poll(&mut context), Poll::Ready(Some(value)) if value == ": keep-alive\n\n")
        );
    }
    assert!(updates.send(event(2)).is_ok());
    assert_eq!(
        next(&mut body).await.as_deref(),
        Some("id: 2\ndata: process\n\n")
    );
    stop.send_replace(true);
    assert!(next(&mut body).await.is_none());
}
