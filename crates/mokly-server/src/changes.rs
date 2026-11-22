//! Generation-fenced Changes computation and atomic public projection.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::{projection_index, projection_removed};
use mokly_model::namespace::viewer;
use mokly_model::nullable::Nullable;
use mokly_model::projection::{self, Publication};
use mokly_model::public_metadata::ChangesStatus;
use mokly_model::routes;

use crate::assets::File;
use crate::changes_background::PendingChanges;
use crate::changes_detail;
use crate::changes_signal::{ChangeSignal, Signals};
use crate::comparison_metadata;
use crate::detail_encoding::DetailEncoder;
use crate::error::{Result, ServerError};
use crate::revision::RevisionLease;
use crate::revision_file::RevisionFile;
use crate::snapshot::{Snapshot, encode_index};

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
    /// Prepare optional evidence after an accepted terminal completion returns.
    fn settled(&self) {}

    /// Explicitly drain preparation after classification, including a failed reference probe.
    fn settle_pending(&self, _accepted: bool) {}
    /// Transfer this origin's pending preparation into its usage pass.
    fn pending(&self) -> Option<Arc<dyn PendingChanges>> {
        None
    }
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
    /// Classify against `merge_base`, the result of the reference read of the same attempt,
    /// through the command's shared render runtime, without resolving the base again.
    fn classify(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
        merge_base: &str,
    ) -> Result<ComparisonResult>;
    /// Release unaccepted staging when an execution ends, without terminal output.
    fn discarded(&self) {}
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
    encoder: &dyn DetailEncoder,
) -> Result<Arc<Snapshot>> {
    let mut index = projection::index(
        &current.model,
        &current.view_keys,
        &Publication {
            config_path: current.config_path.clone(),
            deployment_id: current.index.deployment_id.clone(),
            revision: current.index.revision + 1,
            base: current.index.base.clone(),
            changes_status: status,
            live_generation: current
                .index
                .live
                .as_ref()
                .map(|live| live.generation.clone()),
        },
    );
    index.identity = current.index.identity.clone();
    if let Some(accepted) = &accepted {
        projection_index::apply(&mut index, &accepted.result);
        let historical = comparison_metadata::base(accepted, current);
        index.removed_entries = projection_removed::records(&accepted.result, historical);
        let ids = comparison_metadata::detail_ids(accepted, current)?;
        for record in &mut index.removed_entries {
            if let Some(id) = ids.get(record.entry.path()) {
                record.entry.set_detail_id(id);
            }
        }
        index.comparison_url = Nullable(Some(routes::comparison_generation(&accepted.id)));
    }
    let mut next = Snapshot {
        changes: accepted,
        document_keys: current.document_keys.clone(),
        generation: current.generation.clone(),
        details: current.details.clone(),
        recent_details: current.recent_details.clone(),
        completed: current.completed.clone(),
        lease: Arc::new(RevisionLease::default()),
        index,
        files: current.files.clone(),
    };
    changes_detail::apply(&mut next, encoder)?;
    next.files.insert(
        viewer("index.json"),
        RevisionFile::new(encode_index(&next.index)),
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

#[cfg(test)]
#[path = "_tests_/reuse_oracle/mod.rs"]
mod reuse_oracle;
