//! Tick publication and live subscription contracts for relay adapters.

use std::collections::BTreeMap;

use mkc_domain::ids::ProjectId;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::error::Result;
use crate::messages::{ClientEvent, Notice};

/// The identity of a running hub. Each replica uses its own value.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(transparent)]
pub struct ReplicaId(
    /// The identity assigned by the replica's composition root.
    pub Uuid,
);

/// A notice with the project that must receive it.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct ProjectNotice {
    /// The project of the changed record.
    pub project: ProjectId,
    /// The contents of the socket notice.
    #[serde(flatten)]
    pub notice: Notice,
}

/// The events of one replica and project in one relay message.
#[derive(Clone, Debug, Deserialize, PartialEq, Eq, Serialize)]
pub struct RelayMessage {
    /// The hub that sent the events.
    pub replica: ReplicaId,
    /// The project of every event in this message.
    pub project: ProjectId,
    /// The events to send to the project's sockets.
    pub events: Vec<ClientEvent>,
}

/// The client events from one tick, grouped by project.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TickBatch {
    /// The hub that collected these events.
    pub replica: ReplicaId,
    /// The events to publish together, in receive order within each project.
    pub projects: BTreeMap<ProjectId, Vec<ClientEvent>>,
}

/// An item received from the relay.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InboundEvent {
    /// A committed change to a stored record.
    Notice(ProjectNotice),
    /// A batch of client events from one replica and project.
    Relay(RelayMessage),
    /// The listener subscribed again after it could have missed messages.
    Gap,
}

/// The transport for project notices and client events between replicas.
#[unimock::unimock(api = LiveRelayMock)]
pub trait LiveRelay: Send + Sync {
    /// Submit all events from one tick as a single publication.
    ///
    /// Return without waiting for transport I/O. The adapter can split the
    /// batch into messages for the same transport transaction. An empty batch
    /// needs no transport operation.
    fn publish(&self, batch: TickBatch) -> Result<()>;

    /// Subscribe to new notices, relay messages, and gaps.
    ///
    /// Keep the subscription open across listener reconnects. Send a gap
    /// after subscribing again. The hub also treats a lagged receiver as a gap.
    fn subscribe(&self) -> broadcast::Receiver<InboundEvent>;
}

#[cfg(test)]
#[path = "_tests_/relay_tests.rs"]
mod relay_tests;
