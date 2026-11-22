//! An immutable publication for hosts without rebuild actions.

use std::sync::Arc;

use tokio::sync::broadcast;

use crate::changes::{Accepted, ChangeCommit};
use crate::publication::Publications;
use crate::publication_event::{PublicationEvent, Subscription, event};
use crate::snapshot::Snapshot;

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
    fn with_changes(&self, accepted: &Arc<Accepted>, commit: &dyn ChangeCommit) -> bool {
        self.snapshot
            .changes
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, accepted))
            && commit.apply()
    }

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
