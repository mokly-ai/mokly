//! The relay call and client events produced by each tick.

#![allow(clippy::unwrap_used)]

use std::collections::BTreeMap;
use std::sync::Arc;
use std::task::Poll;
use std::time::Duration;

use mkc_live_interface::relay::{InboundEvent, LiveRelayMock, ReplicaId, TickBatch};
use tokio::sync::{broadcast, mpsc};
use tokio::time::{advance, timeout};
use unimock::{MockFn, Unimock, matching};
use uuid::Uuid;

use crate::hub::LiveHub;
use crate::test_support::{
    OTHER_PROJECT, PROJECT, USER, client_event, client_message, hub, notice, notice_message,
    poll_receive, receive, submit,
};

#[tokio::test(start_paused = true)]
async fn each_tick_publishes_one_batch_with_the_last_event_per_connection_and_key() {
    let inbound = broadcast::Sender::new(8);
    let (observed, mut batches) = mpsc::unbounded_channel();
    let relay = Unimock::new((
        LiveRelayMock::subscribe
            .some_call(matching!())
            .returns(inbound.subscribe()),
        LiveRelayMock::publish
            .each_call(matching!(_))
            .answers_arc(Arc::new(move |_, batch| {
                observed.send(batch).unwrap();
                Ok(())
            }))
            .n_times(3),
    ));
    let hub = hub(5, Arc::new(relay), 32);
    let mut first = hub.register(PROJECT, USER).unwrap();
    let mut second = hub.register(PROJECT, USER).unwrap();
    let mut peer = hub.register(PROJECT, USER).unwrap();
    let mut other_project = hub.register(OTHER_PROJECT, USER).unwrap();

    submit(&mut first, "set", 1);
    submit(&mut first, "emit", 2);
    submit(&mut second, "set", 3);
    submit(&mut first, "other", 4);
    submit(&mut other_project, "emit", 5);
    submit(&mut first, "emit", 6);
    advance(Duration::from_millis(49)).await;
    inbound
        .send(InboundEvent::Notice(notice(PROJECT, 9)))
        .unwrap();
    assert_eq!(receive(&mut peer).await, notice_message(9));
    assert_eq!(batches.try_recv(), Err(mpsc::error::TryRecvError::Empty));

    submit(&mut first, "revise", 7);
    advance(Duration::from_millis(1)).await;

    let replica = ReplicaId(Uuid::from_u128(5));
    assert_eq!(
        timeout(Duration::from_millis(1), batches.recv())
            .await
            .unwrap(),
        Some(TickBatch {
            replica,
            projects: BTreeMap::from([
                (
                    PROJECT,
                    vec![
                        client_event("emit", 2),
                        client_event("set", 3),
                        client_event("other", 4),
                        client_event("emit", 6),
                        client_event("revise", 7),
                    ],
                ),
                (OTHER_PROJECT, vec![client_event("emit", 5)]),
            ]),
        })
    );
    for (kind, value) in [
        ("emit", 2),
        ("set", 3),
        ("other", 4),
        ("emit", 6),
        ("revise", 7),
    ] {
        assert_eq!(
            receive(&mut peer).await,
            client_message(kind, value),
            "{kind} {value}"
        );
    }
    assert_eq!(poll_receive(&mut peer).await, Poll::Pending);
    assert_eq!(batches.try_recv(), Err(mpsc::error::TryRecvError::Empty));

    submit(&mut first, "set", 8);
    advance(Duration::from_millis(50)).await;
    assert_eq!(
        timeout(Duration::from_millis(1), batches.recv())
            .await
            .unwrap(),
        Some(TickBatch {
            replica,
            projects: BTreeMap::from([(PROJECT, vec![client_event("set", 8)])]),
        })
    );

    advance(Duration::from_millis(50)).await;
    assert_eq!(
        timeout(Duration::from_millis(1), batches.recv())
            .await
            .unwrap(),
        Some(TickBatch {
            replica,
            projects: BTreeMap::new(),
        })
    );
    assert_eq!(batches.try_recv(), Err(mpsc::error::TryRecvError::Empty));
}
