//! Generation-fenced Changes computation and atomic public projection.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_removed};
use mokly_model::namespace::viewer;
use mokly_model::projection::{self, Publication};
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::routes;
use mokly_model::usage_schemas::UsageSchemas;

use crate::assets::File;
use crate::changes_detail;
use crate::changes_signal::{ChangeSignal, Signals};
use crate::comparison_metadata;
use crate::comparison_metadata::compared;
use crate::detail_encoding::{DetailEncoder, ValidatedDetails, detail_id};
use crate::error::{InternalError, Result, ServerError};
use crate::revision::RevisionLease;
use crate::revision_file::RevisionFile;
use crate::snapshot::{Snapshot, checked_index};

/// Cancellation belongs to one classification, not to the shared render pool.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeCancellationMock))]
pub trait ChangeCancellation: Send + Sync {
    /// Stop admission and discard late work.
    fn cancel(&self);
    /// Observe replacement or shutdown.
    fn cancelled(&self) -> bool;
    /// Wake a weak listener on cancellation, including a late registration.
    fn observe(&self, _signal: Weak<dyn ChangeSignal>) {}
    /// Linearize a short publication against cancellation.
    fn commit(&self, publication: &dyn ChangeCommit) -> bool {
        !self.cancelled() && publication.apply()
    }
}

/// The final state swap, with no render work or source reads inside it.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeCommitMock))]
pub trait ChangeCommit {
    /// Install the matching publication if its origin remains current.
    fn apply(&self) -> bool;
}

pub(crate) struct Commit<'a>(pub(crate) &'a dyn Fn() -> bool);
impl ChangeCommit for Commit<'_> {
    fn apply(&self) -> bool {
        (self.0)()
    }
}

/// Native cancellation source for blocking comparison work.
#[derive(Default)]
pub struct ChangeToken {
    cancelled: AtomicBool,
    commit: Mutex<()>,
    signals: Signals,
}
impl ChangeCancellation for ChangeToken {
    fn cancel(&self) {
        {
            let _commit = self
                .commit
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            self.cancelled.store(true, Ordering::Release);
        }
        self.signals.notify();
    }
    fn cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Acquire)
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        self.signals.add(signal.clone());
        if self.cancelled()
            && let Some(signal) = signal.upgrade()
        {
            signal.notify();
        }
    }
    fn commit(&self, publication: &dyn ChangeCommit) -> bool {
        let _commit = self
            .commit
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        !self.cancelled() && publication.apply()
    }
}

/// Status callbacks run outside the HTTP loop and reject superseded producers.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeProgressMock))]
pub trait ChangeProgress: Send + Sync {
    /// Publish one status transition, or return false when superseded.
    fn status(&self, status: ChangesStatus) -> Result<bool>;
}

/// Command-owned base preparation and terminal reporting for an immutable head.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ChangeSourceMock))]
pub trait ChangeSource: Send + Sync {
    /// Start command progress for one accepted background attempt.
    fn started(&self, _cancel: Arc<dyn ChangeCancellation>) -> Option<Box<dyn ChangeRun>> {
        None
    }
    /// Bind cancellation only while one serialized capture reads retained inputs.
    fn capture_scope(&self, _cancel: Arc<dyn ChangeCancellation>) -> Option<Box<dyn CaptureLease>> {
        None
    }
    /// Retain the head while binding a base-ref refresh to the current warning attempt.
    fn refreshed(&self) -> Option<Arc<dyn ChangeSource>> {
        None
    }
    /// Poll HEAD and base tips and return their merge base without rendering either side.
    fn references(&self, cancel: Arc<dyn ChangeCancellation>) -> Result<String>;
    /// Pin the base once and classify through the command's shared render runtime.
    fn classify(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
    ) -> Result<ComparisonResult>;
    /// Report only the accepted result, with preparation warnings before readiness.
    fn finished(
        &self,
        result: std::result::Result<&ComparisonResult, &ServerError>,
        elapsed: Duration,
    );
}

/// A public comparison and its immutable source handles.
pub struct Accepted {
    /// Command scope for cancellable historical IO during capture.
    pub source: Option<Arc<dyn ChangeSource>>,
    /// Shutdown cancellation for the retained base runner and leases.
    pub cancel: Arc<dyn ChangeCancellation>,
    /// Content-derived classification generation.
    pub id: String,
    /// Complete review v8, snapshot v4, and side-specific render generations.
    pub result: ComparisonResult,
}

/// Project ready or non-ready Changes as one complete publication.
pub(crate) fn project(
    current: &Snapshot,
    status: ChangesStatus,
    accepted: Option<Arc<Accepted>>,
) -> Result<Arc<Snapshot>> {
    let mut next = current.clone();
    next.index.revision += 1;
    next.lease = Arc::new(RevisionLease::default());
    next.changes = accepted;
    next.index = match projection::index(
        &current.model,
        &current.view_keys,
        &Publication {
            config_path: current.config_path.clone(),
            deployment_id: current.index.deployment_id.clone(),
            revision: next.index.revision,
            base: current.index.base.clone(),
            changes_status: status,
            live_generation: current
                .index
                .live
                .as_ref()
                .map(|live| live.generation.clone()),
        },
    ) {
        Ok(index) => index,
        Err(source) => return Err(InternalError::Model { source }.into()),
    };
    next.index.identity = current.index.identity.clone();
    if let Some(accepted) = &next.changes {
        projection_index::apply(&mut next.index, &accepted.result);
        let historical = comparison_metadata::base(accepted, current)?;
        next.index.removed_entries =
            compared(projection_removed::records(&accepted.result, historical))?;
        let ids = comparison_metadata::detail_ids(accepted, current)?;
        for record in &mut next.index.removed_entries {
            if let Some(id) = ids.get(record.entry.path()) {
                record.entry.set_detail_id(id);
            }
        }
        next.index.comparison_url = Some(routes::comparison_generation(&accepted.id));
    }
    changes_detail::apply(&mut next)?;
    for (path, detail) in &mut next.details {
        let detail = Arc::make_mut(detail);
        detail.detail_id = detail_id(detail)?;
        projection::set_detail_id(&mut next.index, path, &detail.detail_id);
        detail.revision = Some(next.index.revision);
    }
    let mut schemas = UsageSchemas::new(&next.index.components);
    for (path, detail) in &mut next.details {
        let detail = Arc::make_mut(detail);
        next.files.insert(
            viewer(&format!("entries/{path}.json")),
            ValidatedDetails.encode(detail, &next.index, &mut schemas)?,
        );
    }
    next.files.insert(
        viewer("index.json"),
        RevisionFile::new(checked_index(&next.index)?)?,
    );
    Ok(Arc::new(next))
}

/// Classification metadata contains no snapshots until a historical view is opened.
pub(crate) fn metadata(accepted: &Accepted, current: &Snapshot) -> Result<BTreeMap<String, File>> {
    comparison_metadata::files(accepted, current)
}

impl std::fmt::Debug for dyn ChangeCancellation + '_ {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ChangeCancellation")
    }
}

impl std::fmt::Debug for dyn ChangeCommit + '_ {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("ChangeCommit")
    }
}

/// Dropping this lease removes only the active capture's cancellation scope.
pub trait CaptureLease: Send {}

#[cfg(test)]
#[path = "_tests_/changes_token_tests.rs"]
mod changes_token_tests;

/// A command-owned progress lease that clears when work finishes or is abandoned.
pub trait ChangeRun: Send {
    /// Clear only this attempt's progress line.
    fn finish(&self);
}
