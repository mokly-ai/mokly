//! Usage and Changes updates share the rebuild publication fence.

use std::cell::Cell;
use std::sync::Arc;

use mokly_model::public_metadata::ChangesStatus;

use crate::changes::{self, Accepted, ChangeCancellation, ChangeCommit, Commit};
use crate::changes_install::ChangeInstallation;
use crate::error::Result;
use crate::evidence;
use crate::publication::{Delivery, Publications, SharedPublication, Subscription, event};
use crate::snapshot::Snapshot;

impl Publications for SharedPublication {
    fn with_changes(&self, accepted: &Arc<Accepted>, commit: &dyn ChangeCommit) -> bool {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        !state.closed
            && state
                .delivery
                .snapshot
                .changes
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(current, accepted))
            && commit.apply()
    }

    fn completed_many(&self, origin: &Snapshot, routes: &[String]) -> Result<()> {
        let _build = self.build.lock().unwrap_or_else(|error| error.into_inner());
        {
            let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.closed || !Arc::ptr_eq(&state.delivery.snapshot.documents, &origin.documents) {
                return Ok(());
            }
        }
        let recorded = self.current();
        let updates: Vec<_> = routes
            .iter()
            .filter(|route| {
                origin.views.contains_key(*route) && !recorded.completed.contains_key(*route)
            })
            .filter_map(|route| {
                origin
                    .documents
                    .usage(route)
                    .map(|usage| (route.clone(), usage))
            })
            .collect();
        loop {
            let current = {
                let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
                if state.closed
                    || !Arc::ptr_eq(&state.delivery.snapshot.documents, &origin.documents)
                {
                    return Ok(());
                }
                state.delivery.snapshot.clone()
            };
            let Some(next) = evidence::complete(&current, &updates, self.encoder.as_ref())? else {
                return Ok(());
            };
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.closed {
                return Ok(());
            }
            if !Arc::ptr_eq(&state.delivery.snapshot, &current) {
                continue;
            }
            if next.index.revision == current.index.revision {
                state.delivery.snapshot = next;
            } else {
                state.publish(next);
            }
            return Ok(());
        }
    }
    fn changes(
        &self,
        origin: &Snapshot,
        status: ChangesStatus,
        accepted: Option<Arc<Accepted>>,
        cancel: &dyn ChangeCancellation,
        installation: Option<&dyn ChangeInstallation>,
    ) -> Result<bool> {
        let _build = self.build.lock().unwrap_or_else(|error| error.into_inner());
        loop {
            let current = {
                let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
                if state.closed
                    || cancel.cancelled()
                    || !Arc::ptr_eq(&state.delivery.snapshot.documents, &origin.documents)
                {
                    return Ok(false);
                }
                state.delivery.snapshot.clone()
            };
            if current.index.changes_status == status && accepted.is_none() {
                return Ok(true);
            }
            let next = changes::project(&current, status, accepted.clone(), self.encoder.as_ref())?;
            if cancel.cancelled() {
                return Ok(false);
            }
            if let Some(installation) = installation {
                installation.install()?;
            }
            let replaced = Cell::new(false);
            let installed = cancel.commit(&Commit(&|| {
                let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
                if state.closed {
                    return false;
                }
                if !Arc::ptr_eq(&state.delivery.snapshot, &current) {
                    replaced.set(true);
                    return false;
                }
                state.publish(next.clone());
                true
            }));
            if installed || cancel.cancelled() || !replaced.get() {
                return Ok(installed);
            }
        }
    }
    fn close(&self) {
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.closed = true;
            state.delivery.snapshot.lease.expire();
        }
        let _build = self.build.lock().unwrap_or_else(|error| error.into_inner());
    }
    fn current(&self) -> Arc<Snapshot> {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .delivery
            .snapshot
            .clone()
    }
    fn delivery(&self) -> Delivery {
        self.state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .delivery
            .clone()
    }
    fn subscribe(&self) -> Subscription {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        Subscription {
            current: event(&state.delivery.snapshot),
            updates: state.updates.subscribe(),
        }
    }
}
