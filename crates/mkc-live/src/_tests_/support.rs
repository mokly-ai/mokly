//! Test fixtures and message assertions shared by the live hub tests.

#![allow(clippy::unwrap_used)]

use std::future::{Future, poll_fn};
use std::num::NonZeroUsize;
use std::pin::pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::task::Poll;
use std::time::Duration;

use mkc_domain::ids::{ProjectId, UserId};
use mkc_live_interface::messages::{ClientEvent, Notice, ServerMessage, ServerSignal};
use mkc_live_interface::relay::{LiveRelay, ProjectNotice, ReplicaId};
use serde_json::{from_value, json};
use tokio::time::timeout;
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::Layer;
use tracing_subscriber::layer::Context;
use uuid::Uuid;

use crate::connection::{ClientEventKind, Connection};
use crate::hub::ReplicaHub;
use crate::outbound::Outbound;

pub(super) const PROJECT: ProjectId = ProjectId(Uuid::from_u128(1));
pub(super) const OTHER_PROJECT: ProjectId = ProjectId(Uuid::from_u128(2));
pub(super) const USER: UserId = UserId(Uuid::from_u128(3));
const RECORD: Uuid = Uuid::from_u128(4);

const KINDS: &[ClientEventKind] = &[
    ClientEventKind {
        name: "set",
        coalesce_key: Some("primary"),
    },
    ClientEventKind {
        name: "revise",
        coalesce_key: Some("primary"),
    },
    ClientEventKind {
        name: "other",
        coalesce_key: Some("secondary"),
    },
    ClientEventKind {
        name: "emit",
        coalesce_key: None,
    },
];

pub(super) fn hub(
    replica: u128,
    relay: Arc<dyn LiveRelay + Send + Sync>,
    capacity: usize,
) -> ReplicaHub {
    ReplicaHub::start(
        ReplicaId(Uuid::from_u128(replica)),
        relay,
        KINDS,
        NonZeroUsize::new(capacity).unwrap(),
    )
    .unwrap()
}

pub(super) fn notice(project: ProjectId, sequence: i64) -> ProjectNotice {
    ProjectNotice {
        project,
        notice: Notice {
            kind: "build".into(),
            id: RECORD,
            sequence,
        },
    }
}

pub(super) fn notice_message(sequence: i64) -> Option<Outbound> {
    outbound(ServerMessage::Signal(ServerSignal::Notice(
        notice(PROJECT, sequence).notice,
    )))
}

pub(super) fn resync_message() -> Option<Outbound> {
    outbound(ServerMessage::Signal(ServerSignal::Resync))
}

pub(super) fn client_event(kind: &str, value: u16) -> ClientEvent {
    from_value(json!({"type": kind, "value": value})).unwrap()
}

pub(super) fn client_message(kind: &str, value: u16) -> Option<Outbound> {
    outbound(ServerMessage::ClientEvent(client_event(kind, value)))
}

fn outbound(message: ServerMessage) -> Option<Outbound> {
    Some(Outbound::Message(Arc::new(message)))
}

pub(super) fn submit(socket: &mut Connection, kind: &str, value: u16) {
    let text = json!({"type": kind, "value": value}).to_string();
    socket.submit_text(&text).unwrap();
}

/// Test the received item with a deadline on the paused clock.
pub(super) async fn receive(socket: &mut Connection) -> Option<Outbound> {
    timeout(Duration::from_millis(1), socket.recv())
        .await
        .unwrap_or(None)
}

pub(super) async fn poll_receive(socket: &mut Connection) -> Poll<Option<Outbound>> {
    let mut recv = pin!(socket.recv());
    poll_fn(|cx| Poll::Ready(recv.as_mut().poll(cx))).await
}

#[derive(Clone, Default)]
pub(super) struct Warnings(Arc<AtomicUsize>);

impl Warnings {
    pub(super) fn count(&self) -> usize {
        self.0.load(Ordering::Relaxed)
    }
}

impl<S: Subscriber> Layer<S> for Warnings {
    fn on_event(&self, event: &Event<'_>, _context: Context<'_, S>) {
        if *event.metadata().level() == Level::WARN {
            self.0.fetch_add(1, Ordering::Relaxed);
        }
    }
}
