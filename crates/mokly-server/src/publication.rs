//! Atomic public state and ordered event delivery for rebuild integrations.

use std::sync::{Arc, Mutex};

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

fn event(snapshot: &Snapshot) -> PublicationEvent {
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

/// Atomic state source for watch and Changes publications.
pub trait Publications: Send + Sync {
    /// Get matching index, details, routes, backend, and capability.
    fn current(&self) -> Arc<Snapshot>;
    /// Install an update receiver and capture its handshake in one step.
    fn subscribe(&self) -> Subscription;
}

/// An immutable Serve publication for hosts without rebuild actions.
pub struct FixedPublication {
    snapshot: Arc<Snapshot>,
    updates: broadcast::Sender<PublicationEvent>,
}
impl FixedPublication {
    /// Create a state without rendering or starting background work.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            snapshot,
            updates: broadcast::channel(64).0,
        }
    }
}
impl Publications for FixedPublication {
    fn current(&self) -> Arc<Snapshot> {
        self.snapshot.clone()
    }
    fn subscribe(&self) -> Subscription {
        Subscription {
            current: event(&self.snapshot),
            updates: self.updates.subscribe(),
        }
    }
}

/// State replacement boundary for a serialized rebuild coordinator.
pub trait PublicationWriter: Send + Sync {
    /// Atomically install only the next revision of this process.
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool;
}

struct State {
    snapshot: Arc<Snapshot>,
    updates: broadcast::Sender<PublicationEvent>,
}

/// A lock fences state replacement and the event subscription handshake.
pub struct SharedPublication {
    state: Mutex<State>,
}
impl SharedPublication {
    /// Install the already validated first publication.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            state: Mutex::new(State {
                snapshot,
                updates: broadcast::channel(64).0,
            }),
        }
    }
}
impl Publications for SharedPublication {
    fn current(&self) -> Arc<Snapshot> {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .snapshot
            .clone()
    }
    fn subscribe(&self) -> Subscription {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        Subscription {
            current: event(&state.snapshot),
            updates: state.updates.subscribe(),
        }
    }
}
impl PublicationWriter for SharedPublication {
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let current = &state.snapshot;
        if current.index.deployment_id != snapshot.index.deployment_id
            || current.render_token != snapshot.render_token
            || current.index.revision.checked_add(1) != Some(snapshot.index.revision)
        {
            return false;
        }
        state.snapshot.lease.expire();
        state.snapshot = snapshot.clone();
        let _ = state.updates.send(event(&snapshot));
        true
    }
}
