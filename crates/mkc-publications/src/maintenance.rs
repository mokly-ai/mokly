//! Complete publication cleanup and object-collection maintenance cycles.

use std::sync::Arc;

use crate::error::{Error, Result};
use crate::garbage_collection::GarbageCollector;
use crate::retention::RetentionWorker;

const MAX_BATCHES: usize = 10_000;

/// Counts completed by one full maintenance cycle.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct MaintenanceReport {
    /// Abandoned attempts failed and released.
    pub abandoned: usize,
    /// Old failed attempt rows deleted.
    pub pruned: usize,
    /// Unreferenced indexed objects deleted.
    pub blobs: usize,
    /// Old unindexed objects deleted.
    pub orphans: usize,
}

/// Complete publication cleanup independent of process scheduling.
#[unimock::unimock(api = PublicationMaintenanceMock)]
pub trait PublicationMaintenance: Send + Sync {
    /// Exhaust safe bounded work or fail for retry without guessing reachability.
    fn run(&self) -> Result<MaintenanceReport>;
}

/// Orchestrates the independently testable retention and collection workers.
pub struct Maintenance {
    /// Publication lifecycle cleanup.
    pub retention: Arc<dyn RetentionWorker>,
    /// Indexed and orphan object cleanup.
    pub garbage: Arc<dyn GarbageCollector>,
}

impl PublicationMaintenance for Maintenance {
    fn run(&self) -> Result<MaintenanceReport> {
        let mut report = MaintenanceReport::default();
        let mut after = None;
        for _ in 0..MAX_BATCHES {
            let batch = self.retention.run_batch(after)?;
            report.abandoned += batch.abandoned;
            report.pruned += batch.pruned;
            if batch.next.is_some() && batch.next == after {
                return Err(Error::Unavailable);
            }
            after = batch.next;
            if after.is_none() {
                break;
            }
        }
        if after.is_some() {
            return Err(Error::Unavailable);
        }

        let mut cursor = None;
        let mut complete = false;
        for _ in 0..MAX_BATCHES {
            let batch = self.garbage.run_batch(cursor.as_deref())?;
            report.blobs += batch.blobs;
            report.orphans += batch.orphans;
            if batch.next_cursor.is_some() && batch.next_cursor == cursor {
                return Err(Error::Unavailable);
            }
            cursor = batch.next_cursor;
            if cursor.is_none() && !batch.more_blobs {
                complete = true;
                break;
            }
        }
        if !complete {
            return Err(Error::Unavailable);
        }
        Ok(report)
    }
}
