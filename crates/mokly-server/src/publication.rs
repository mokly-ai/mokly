//! Atomic public state and ordered event delivery for rebuild integrations.

use std::sync::{Arc, Mutex};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::broadcast;

use crate::changes::{Accepted, ChangeCancellation, ChangeCommit};
use crate::changes_install::ChangeInstallation;

use crate::detail_encoding::{DetailEncoder, EncodedDetails};
use crate::error::Result;
use crate::json_delivery::GzipFiles;
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

/// The current snapshot and the HTTP representations owned by its publication.
#[derive(Clone)]
pub struct Delivery {
    pub(crate) snapshot: Arc<Snapshot>,
    pub(crate) gzip: Arc<GzipFiles>,
}

impl Delivery {
    /// Start a publication without encoding any compressed bodies.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            snapshot,
            gzip: Arc::default(),
        }
    }
}

/// Atomic state source for watch and Changes publications.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublicationsMock))]
pub trait Publications: Send + Sync {
    /// Get matching index, details, routes, backend, and capability.
    fn current(&self) -> Arc<Snapshot>;
    /// Read one revision with its HTTP representations.
    fn delivery(&self) -> Delivery {
        Delivery::new(self.current())
    }
    /// Install an update receiver and capture its handshake in one step.
    fn subscribe(&self) -> Subscription;
    /// Record completed usage only if its immutable backend is still current.
    fn completed(&self, origin: &Snapshot, route: &str) -> Result<()> {
        self.completed_many(origin, &[route.into()])
    }
    /// Record a completion batch and publish only changed public details.
    fn completed_many(&self, _origin: &Snapshot, _routes: &[String]) -> Result<()> {
        Ok(())
    }
    /// Replace all Changes records only while the immutable head is still accepted.
    /// Install ready metadata after projection, before its pointer can be observed.
    fn changes(
        &self,
        _origin: &Snapshot,
        _status: ChangesStatus,
        _accepted: Option<Arc<Accepted>>,
        _cancel: &dyn ChangeCancellation,
        _installation: Option<&dyn ChangeInstallation>,
    ) -> Result<bool> {
        Ok(false)
    }
    /// Run a short capture installation only while this classification is accepted.
    fn with_changes(&self, _accepted: &Arc<Accepted>, _commit: &dyn ChangeCommit) -> bool {
        false
    }
    /// Fence late evidence before shutdown releases its generation.
    fn close(&self) {}
}

/// An immutable Serve publication for hosts without rebuild actions.
pub struct FixedPublication {
    delivery: Delivery,
    updates: broadcast::Sender<PublicationEvent>,
}
impl FixedPublication {
    /// Create a state without rendering or starting background work.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            delivery: Delivery::new(snapshot),
            updates: broadcast::channel(64).0,
        }
    }
}
impl Publications for FixedPublication {
    fn with_changes(&self, accepted: &Arc<Accepted>, commit: &dyn ChangeCommit) -> bool {
        self.delivery
            .snapshot
            .changes
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, accepted))
            && commit.apply()
    }

    fn current(&self) -> Arc<Snapshot> {
        self.delivery.snapshot.clone()
    }
    fn delivery(&self) -> Delivery {
        self.delivery.clone()
    }
    fn subscribe(&self) -> Subscription {
        Subscription {
            current: event(&self.delivery.snapshot),
            updates: self.updates.subscribe(),
        }
    }
}

/// State replacement boundary for a serialized rebuild coordinator.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublicationWriterMock))]
pub trait PublicationWriter: Send + Sync {
    /// Atomically install only the next revision of this process.
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool;
}

pub(crate) struct State {
    pub(crate) closed: bool,
    pub(crate) delivery: Delivery,
    pub(crate) updates: broadcast::Sender<PublicationEvent>,
}

impl State {
    /// Replace the public revision and retire its encoding cache in the same step.
    pub(crate) fn publish(&mut self, snapshot: Arc<Snapshot>) {
        self.delivery.snapshot.lease.expire();
        self.delivery = Delivery::new(snapshot);
        let _ = self.updates.send(event(&self.delivery.snapshot));
    }
}

/// A lock fences state replacement and the event subscription handshake.
pub struct SharedPublication {
    pub(crate) state: Mutex<State>,
    pub(crate) build: Mutex<()>,
    pub(crate) encoder: Arc<dyn DetailEncoder>,
}
impl SharedPublication {
    /// Install the already validated first publication.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            build: Mutex::new(()),
            encoder: Arc::new(EncodedDetails),
            state: Mutex::new(State {
                closed: false,
                delivery: Delivery::new(snapshot),
                updates: broadcast::channel(64).0,
            }),
        }
    }
}
impl PublicationWriter for SharedPublication {
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let current = &state.delivery.snapshot;
        if state.closed
            || current.index.deployment_id != snapshot.index.deployment_id
            || current.render_token != snapshot.render_token
            || current.index.revision.checked_add(1) != Some(snapshot.index.revision)
        {
            return false;
        }
        state.publish(snapshot);
        true
    }
}
