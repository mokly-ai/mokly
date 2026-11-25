//! Sender retry behaviour observed through relay publication.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeMap;
use std::future::ready;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use mkc_domain::ids::ProjectId;
use mkc_live_interface::error::Error;
use mkc_live_interface::relay::{LiveRelay, ReplicaId, TickBatch};
use serde_json::json;
use tokio::sync::{broadcast, mpsc};
use tokio::time::advance;
use uuid::Uuid;

use crate::sender::run_sender;

use super::{Failure, INBOUND_CAPACITY, PENDING_TICKS, PostgresRelay};

#[tokio::test(start_paused = true)]
async fn disconnected_sender_drains_ticks_and_backs_off_connection_attempts() {
    let attempts = Arc::new(AtomicUsize::new(0));
    let observed = attempts.clone();
    let (outbound, batches) = mpsc::channel(PENDING_TICKS);
    let sender = tokio::spawn(async move {
        run_sender(None, batches, &|| {
            observed.fetch_add(1, Ordering::Relaxed);
            Box::pin(ready(Err(Error::internal(Failure::SenderClosed))))
        })
        .await;
    });
    let relay = PostgresRelay {
        inbound: broadcast::Sender::new(INBOUND_CAPACITY),
        outbound,
        listener: tokio::spawn(ready(())),
        sender,
    };

    assert_eq!(publish_tick(&relay, &attempts).await, 1);
    for (index, delay_ms) in [500, 1_000, 2_000, 4_000, 8_000, 15_000, 15_000]
        .into_iter()
        .enumerate()
    {
        let before = index + 1;
        advance(Duration::from_millis(delay_ms - 1)).await;
        for _ in 0..3 {
            assert_eq!(
                publish_tick(&relay, &attempts).await,
                before,
                "tick before the {delay_ms} ms retry deadline"
            );
        }
        advance(Duration::from_millis(1)).await;
        assert_eq!(
            publish_tick(&relay, &attempts).await,
            before + 1,
            "tick at the {delay_ms} ms retry deadline"
        );
    }
    advance(Duration::from_secs(20)).await;
    assert_eq!(publish_tick(&relay, &attempts).await, 9);
}

async fn publish_tick(relay: &PostgresRelay, attempts: &AtomicUsize) -> usize {
    let event = serde_json::from_value(json!({"type": "test-event", "value": 1})).unwrap();
    relay
        .publish(TickBatch {
            replica: ReplicaId(Uuid::from_u128(1)),
            projects: BTreeMap::from([(ProjectId(Uuid::from_u128(2)), vec![event])]),
        })
        .unwrap();
    // The current-thread worker takes the tick and completes its immediate
    // connector before the publisher wakes for the freed queue slot.
    let _slot = relay.outbound.reserve().await.unwrap();
    attempts.load(Ordering::Relaxed)
}
