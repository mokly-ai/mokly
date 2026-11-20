//! Paused-clock coverage for demand-started provider idleness.

#![allow(clippy::unwrap_used)]

use std::io;
use std::time::Duration;

use bytes::Bytes;
use futures_util::{StreamExt, poll, stream};

use super::IdleTimeout;

const IDLE: Duration = Duration::from_secs(60);

#[tokio::test(start_paused = true)]
async fn time_between_consumer_polls_does_not_count_as_provider_idle() {
    let inner = stream::iter([
        Ok::<_, io::Error>(Bytes::from_static(b"first")),
        Ok(Bytes::from_static(b"second")),
    ]);
    let mut body = IdleTimeout::new(inner, IDLE);

    assert_eq!(body.next().await.unwrap().unwrap(), b"first".as_slice());
    tokio::time::advance(Duration::from_secs(600)).await;
    assert_eq!(body.next().await.unwrap().unwrap(), b"second".as_slice());
}

#[tokio::test(start_paused = true)]
async fn pending_provider_times_out_once_and_then_ends() {
    let inner = stream::pending::<io::Result<Bytes>>();
    let mut body = IdleTimeout::new(inner, IDLE);
    let next = body.next();
    tokio::pin!(next);
    assert!(poll!(&mut next).is_pending());

    tokio::time::advance(IDLE).await;

    assert_eq!(
        next.await.unwrap().unwrap_err().kind(),
        io::ErrorKind::TimedOut
    );
    assert!(body.next().await.is_none());
}

#[tokio::test(start_paused = true)]
async fn each_provider_item_resets_the_idle_timer() {
    let inner = stream::unfold(0, |index| async move {
        if index == 2 {
            return None;
        }
        tokio::time::sleep(Duration::from_secs(40)).await;
        Some((Ok::<_, io::Error>(Bytes::from_static(b"item")), index + 1))
    });
    let mut body = IdleTimeout::new(inner, IDLE);

    for _ in 0..2 {
        let next = body.next();
        tokio::pin!(next);
        assert!(poll!(&mut next).is_pending());
        tokio::time::advance(Duration::from_secs(40)).await;
        assert_eq!(next.await.unwrap().unwrap(), b"item".as_slice());
    }
    assert!(body.next().await.is_none());
}
