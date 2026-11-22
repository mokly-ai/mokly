//! Atomic public state and ordered event delivery for rebuild integrations.

use std::cell::Cell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use mokly_model::public_metadata::ChangesStatus;
use tokio::sync::broadcast;

use crate::changes::{self, Accepted, ChangeCancellation, ChangeCommit, Commit};
use crate::changes_install::ChangeInstallation;

use crate::detail_encoding::{DetailEncoder, EncodedDetails};
use crate::detail_publication::RecentDetails;
use crate::error::Result;
use crate::evidence;
use crate::publication_event::{PublicationEvent, Subscription, event};
use crate::snapshot::Snapshot;

/// Atomic state source for watch and Changes publications.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublicationsMock))]
pub trait Publications: Send + Sync {
    /// Get matching index, details, routes, backend, and capability.
    fn current(&self) -> Arc<Snapshot>;
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
    /// Install idle rebuild records into `origin` without a publication, only while `origin`
    /// is current, Serve is open, and no rebuild candidate started.
    fn install_records(
        &self,
        _origin: &Arc<Snapshot>,
        _records: RecentDetails,
    ) -> Option<Arc<Snapshot>> {
        None
    }
    /// Whether idle rebuild records can still be installed in this session.
    fn accepts_records(&self) -> bool {
        false
    }
}

/// State replacement boundary for a serialized rebuild coordinator.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PublicationWriterMock))]
pub trait PublicationWriter: Send + Sync {
    /// Atomically install only the next revision of this process.
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool;
    /// Mark the start of a rebuild candidate: idle rebuild records stop for the session.
    fn candidate(&self) {}
}

struct State {
    closed: bool,
    snapshot: Arc<Snapshot>,
    updates: broadcast::Sender<PublicationEvent>,
}

/// A lock fences state replacement and the event subscription handshake.
pub struct SharedPublication {
    state: Mutex<State>,
    build: Mutex<()>,
    pub(crate) encoder: Arc<dyn DetailEncoder>,
    /// Cleared when a rebuild candidate starts or Serve closes; no idle record installs then.
    records: AtomicBool,
}
impl SharedPublication {
    /// Install the already validated first publication.
    pub fn new(snapshot: Arc<Snapshot>) -> Self {
        Self {
            build: Mutex::new(()),
            encoder: Arc::new(EncodedDetails),
            records: AtomicBool::new(true),
            state: Mutex::new(State {
                closed: false,
                snapshot,
                updates: broadcast::channel(64).0,
            }),
        }
    }
}
impl Publications for SharedPublication {
    fn with_changes(&self, accepted: &Arc<Accepted>, commit: &dyn ChangeCommit) -> bool {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        !state.closed
            && state
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
            if state.closed || !Arc::ptr_eq(&state.snapshot.documents, &origin.documents) {
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
                if state.closed || !Arc::ptr_eq(&state.snapshot.documents, &origin.documents) {
                    return Ok(());
                }
                state.snapshot.clone()
            };
            let Some(next) = evidence::complete(&current, &updates, self.encoder.as_ref())? else {
                return Ok(());
            };
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            if state.closed {
                return Ok(());
            }
            if !Arc::ptr_eq(&state.snapshot, &current) {
                continue;
            }
            let publish = next.index.revision != current.index.revision;
            if publish {
                state.snapshot.lease.expire();
            }
            state.snapshot = next;
            if publish {
                let _ = state.updates.send(event(&state.snapshot));
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
                    || !Arc::ptr_eq(&state.snapshot.documents, &origin.documents)
                {
                    return Ok(false);
                }
                state.snapshot.clone()
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
                if !Arc::ptr_eq(&state.snapshot, &current) {
                    replaced.set(true);
                    return false;
                }
                state.snapshot.lease.expire();
                state.snapshot = next.clone();
                let _ = state.updates.send(event(&state.snapshot));
                true
            }));
            if installed || cancel.cancelled() || !replaced.get() {
                return Ok(installed);
            }
        }
    }
    fn close(&self) {
        self.records.store(false, Ordering::SeqCst);
        {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.closed = true;
            state.snapshot.lease.expire();
        }
        let _build = self.build.lock().unwrap_or_else(|error| error.into_inner());
    }
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
    fn install_records(
        &self,
        origin: &Arc<Snapshot>,
        records: RecentDetails,
    ) -> Option<Arc<Snapshot>> {
        let _build = self.build.lock().unwrap_or_else(|error| error.into_inner());
        if !self.accepts_records() {
            return None;
        }
        let mut next = (**origin).clone();
        next.recent_details = records;
        let next = Arc::new(next);
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if state.closed || !self.accepts_records() || !Arc::ptr_eq(&state.snapshot, origin) {
            return None;
        }
        state.snapshot = next.clone();
        Some(next)
    }
    fn accepts_records(&self) -> bool {
        self.records.load(Ordering::SeqCst)
    }
}
impl PublicationWriter for SharedPublication {
    fn replace(&self, snapshot: Arc<Snapshot>) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let current = &state.snapshot;
        if state.closed
            || current.index.deployment_id != snapshot.index.deployment_id
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
    fn candidate(&self) {
        self.records.store(false, Ordering::SeqCst);
    }
}
