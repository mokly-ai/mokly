//! Admission and diagnostic limits for project sockets.

#![allow(clippy::unwrap_used)]

use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;

use mkc_live_interface::error::Error;
use tokio::time::advance;
use tracing::subscriber::with_default;
use tracing_subscriber::prelude::*;

use crate::hub::LiveHub;
use crate::limits::check_frame_size;
use crate::memory::MemoryRelay;
use crate::test_support::{
    PROJECT, USER, Warnings, client_message, hub, poll_receive, receive, submit,
};

#[tokio::test(start_paused = true)]
async fn a_client_frame_can_hold_4096_bytes() {
    assert!(matches!(check_frame_size(4_096), Ok(())));
    assert!(matches!(
        check_frame_size(4_097),
        Err(Error::FrameTooLarge { bytes: 4_097 })
    ));

    let hub = hub(1, Arc::new(MemoryRelay::default()), 8);
    let mut socket = hub.register(PROJECT, USER).unwrap();
    let oversized = "é".repeat(2_049);
    assert!(matches!(
        socket.submit_text(&oversized),
        Err(Error::FrameTooLarge { bytes: 4_098 })
    ));
}

#[tokio::test(start_paused = true)]
async fn unknown_and_malformed_messages_are_ignored_with_one_warning() {
    let hub = hub(1, Arc::new(MemoryRelay::default()), 8);
    let mut sender = hub.register(PROJECT, USER).unwrap();
    let mut peer = hub.register(PROJECT, USER).unwrap();
    let warnings = Warnings::default();

    with_default(
        tracing_subscriber::registry().with(warnings.clone()),
        || {
            sender.submit_binary(32).unwrap();
            sender.submit_text(r#"{"type":"unknown"}"#).unwrap();
            sender.submit_text(r#"[{"type":"emit"}]"#).unwrap();
            sender.submit_text(r#"{"type":13}"#).unwrap();
            sender.submit_text(r#"{"type":"resync"}"#).unwrap();
            submit(&mut sender, "emit", 17);
        },
    );
    advance(Duration::from_millis(50)).await;

    assert_eq!(receive(&mut peer).await, client_message("emit", 17));
    assert_eq!(poll_receive(&mut peer).await, Poll::Pending);
    assert_eq!(warnings.count(), 1);
}

#[tokio::test(start_paused = true)]
async fn a_socket_drops_messages_above_120_per_second_and_warns_once() {
    let hub = hub(1, Arc::new(MemoryRelay::default()), 256);
    let mut sender = hub.register(PROJECT, USER).unwrap();
    let mut peer = hub.register(PROJECT, USER).unwrap();
    let warnings = Warnings::default();

    with_default(
        tracing_subscriber::registry().with(warnings.clone()),
        || {
            for value in 0..123 {
                submit(&mut sender, "emit", value);
            }
            submit(&mut peer, "emit", 200);
        },
    );
    advance(Duration::from_millis(50)).await;
    for value in 0..120 {
        assert_eq!(receive(&mut peer).await, client_message("emit", value));
    }
    assert_eq!(poll_receive(&mut peer).await, Poll::Pending);
    assert_eq!(receive(&mut sender).await, client_message("emit", 200));
    assert_eq!(warnings.count(), 1);

    advance(Duration::from_millis(949)).await;
    with_default(
        tracing_subscriber::registry().with(warnings.clone()),
        || {
            submit(&mut sender, "emit", 201);
        },
    );
    advance(Duration::from_millis(1)).await;
    submit(&mut sender, "emit", 202);
    advance(Duration::from_millis(50)).await;

    assert_eq!(receive(&mut peer).await, client_message("emit", 202));
    assert_eq!(poll_receive(&mut peer).await, Poll::Pending);
    assert_eq!(warnings.count(), 1);
}
