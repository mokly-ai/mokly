//! Ordered publication events and the race-free subscription handshake.

use tokio::sync::broadcast;

use crate::snapshot::Snapshot;

/// The only data retained by an update stream; it holds no render generation.
#[derive(Clone)]
pub struct PublicationEvent {
    /// Publication counter.
    pub revision: u64,
    /// Process deployment identity.
    pub deployment_id: String,
}

pub(crate) fn event(snapshot: &Snapshot) -> PublicationEvent {
    PublicationEvent {
        revision: snapshot.index.revision,
        deployment_id: snapshot.index.deployment_id.clone(),
    }
}

/// A race-free handshake followed by each publication after it.
pub struct Subscription {
    /// Current state captured while the update receiver was installed.
    pub current: PublicationEvent,
    /// Bounded ordered updates; a lagging stream reconnects for a new handshake.
    pub updates: broadcast::Receiver<PublicationEvent>,
}
