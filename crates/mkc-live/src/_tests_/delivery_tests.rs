//! Messages delivered to sockets on one or more replicas.

#![allow(clippy::unwrap_used)]

use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;

use mkc_live_interface::error::Error;
use tokio::time::advance;

use crate::hub::LiveHub;
use crate::memory::MemoryRelay;
use crate::outbound::Outbound;
use crate::test_support::{
    OTHER_PROJECT, PROJECT, USER, client_message, hub, notice, notice_message, poll_receive,
    receive, resync_message, submit,
};

#[tokio::test(start_paused = true)]
async fn a_notice_reaches_every_socket_of_its_project() {
    let relay = Arc::new(MemoryRelay::default());
    let hub = hub(1, relay.clone(), 8);
    let mut first = hub.register(PROJECT, USER).unwrap();
    let mut second = hub.register(PROJECT, USER).unwrap();
    let mut other = hub.register(OTHER_PROJECT, USER).unwrap();

    relay.inject_notice(notice(PROJECT, 17));

    assert_eq!(receive(&mut first).await, notice_message(17));
    assert_eq!(receive(&mut second).await, notice_message(17));
    assert_eq!(poll_receive(&mut other).await, Poll::Pending);
}

#[tokio::test(start_paused = true)]
async fn a_client_event_reaches_local_and_remote_peers_without_an_echo() {
    let relay = Arc::new(MemoryRelay::default());
    let local = hub(1, relay.clone(), 8);
    let remote = hub(2, relay.clone(), 8);
    let mut sender = local.register(PROJECT, USER).unwrap();
    let mut local_peer = local.register(PROJECT, USER).unwrap();
    let mut remote_peer = remote.register(PROJECT, USER).unwrap();
    let mut other_project = remote.register(OTHER_PROJECT, USER).unwrap();

    submit(&mut sender, "emit", 17);
    assert_eq!(poll_receive(&mut local_peer).await, Poll::Pending);
    advance(Duration::from_millis(50)).await;
    assert_eq!(receive(&mut local_peer).await, client_message("emit", 17));
    assert_eq!(receive(&mut remote_peer).await, client_message("emit", 17));

    relay.inject_notice(notice(PROJECT, 21));
    relay.inject_notice(notice(OTHER_PROJECT, 22));
    assert_eq!(receive(&mut sender).await, notice_message(21));
    assert_eq!(receive(&mut local_peer).await, notice_message(21));
    assert_eq!(receive(&mut remote_peer).await, notice_message(21));
    assert_eq!(receive(&mut other_project).await, notice_message(22));
}

#[tokio::test(start_paused = true)]
async fn a_relay_gap_resyncs_every_project_on_each_replica() {
    let relay = Arc::new(MemoryRelay::default());
    let local = hub(1, relay.clone(), 8);
    let remote = hub(2, relay.clone(), 8);
    let mut first = local.register(PROJECT, USER).unwrap();
    let mut second = local.register(OTHER_PROJECT, USER).unwrap();
    let mut remote = remote.register(PROJECT, USER).unwrap();

    relay.inject_gap();

    assert_eq!(receive(&mut first).await, resync_message());
    assert_eq!(receive(&mut second).await, resync_message());
    assert_eq!(receive(&mut remote).await, resync_message());
}

#[tokio::test(start_paused = true)]
async fn a_full_socket_queue_sends_resync_as_soon_as_it_drains() {
    let relay = Arc::new(MemoryRelay::default());
    let hub = hub(1, relay.clone(), 1);
    let mut slow = hub.register(PROJECT, USER).unwrap();
    let mut fast = hub.register(PROJECT, USER).unwrap();

    for sequence in 1..=3 {
        relay.inject_notice(notice(PROJECT, sequence));
        assert_eq!(receive(&mut fast).await, notice_message(sequence));
    }
    assert_eq!(receive(&mut slow).await, notice_message(1));
    assert_eq!(poll_receive(&mut slow).await, Poll::Ready(resync_message()));

    relay.inject_notice(notice(PROJECT, 4));
    assert_eq!(receive(&mut slow).await, notice_message(4));
    assert_eq!(receive(&mut fast).await, notice_message(4));
}

#[tokio::test(start_paused = true)]
async fn shutdown_closes_pending_and_empty_queues_with_1001() {
    let relay = Arc::new(MemoryRelay::default());
    let hub = hub(1, relay.clone(), 1);
    let mut pending = hub.register(PROJECT, USER).unwrap();
    let mut empty = hub.register(PROJECT, USER).unwrap();

    relay.inject_notice(notice(PROJECT, 17));
    assert_eq!(receive(&mut empty).await, notice_message(17));
    hub.shutdown();

    assert_eq!(
        poll_receive(&mut pending).await,
        Poll::Ready(Some(Outbound::Close(1001)))
    );
    assert_eq!(
        poll_receive(&mut empty).await,
        Poll::Ready(Some(Outbound::Close(1001)))
    );
    assert_eq!(poll_receive(&mut pending).await, Poll::Ready(None));
    assert!(matches!(
        hub.register(PROJECT, USER),
        Err(Error::HubStopped)
    ));
}
