//! Fenced blob deletion and bounded orphan sweeping after a grace period.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_file_store_interface::store::FileStore;

use crate::error::{ErrorResultExt, Result};
use crate::transaction::Transactions;

/// One bounded collection pass, including its backend continuation.
#[derive(Clone, Debug, Default)]
pub struct CollectionReport {
    /// Matching zero-reference blob records collected.
    pub blobs: usize,
    /// Old backend objects without a matching incarnation removed.
    pub orphans: usize,
    /// The database candidate query filled its batch and needs another pass.
    pub more_blobs: bool,
    /// Backend listing continuation, absent after the final page.
    pub next_cursor: Option<String>,
}

/// Content collection behavior; scheduling belongs to the deployment/runtime.
#[unimock::unimock(api = GarbageCollectorMock)]
pub trait GarbageCollector: Send + Sync {
    /// Collect up to one hundred tombstones and inspect one hundred objects.
    fn run_batch(&self, cursor: Option<&str>) -> Result<CollectionReport>;
}

/// Composition-root garbage collector using incarnation-fenced object keys.
pub struct BlobGarbageCollector {
    /// Reference/index executor.
    pub transactions: Arc<dyn Transactions>,
    /// Private blob storage.
    pub files: Arc<dyn FileStore>,
    /// Authoritative server clock.
    pub runtime: Arc<dyn Runtime>,
}

impl GarbageCollector for BlobGarbageCollector {
    /// Each claim and each finalization touches one blob row in its own short
    /// transaction, and the object delete runs between them, outside any
    /// transaction. The orphan sweep deletes an aged object only when no row
    /// matches its exact key; ingest reserves the row before every put, so a
    /// live object always has one.
    fn run_batch(&self, cursor: Option<&str>) -> Result<CollectionReport> {
        let before = self.runtime.now() - Duration::hours(24);
        let mut candidates = Vec::new();
        self.transactions.run(true, &mut |queries| {
            candidates = queries
                .garbage_blobs(before, 100)
                .context("read garbage collection candidates")?;
            Ok(())
        })?;
        let mut report = CollectionReport {
            more_blobs: candidates.len() == 100,
            ..CollectionReport::default()
        };
        for candidate in candidates {
            let mut claimed = false;
            self.transactions.run(false, &mut |queries| {
                claimed = false;
                if let Some(blob) = queries
                    .blob_by_key(&candidate.key)
                    .context("recheck collection grace and references")?
                    && blob.ref_count == 0
                    && (blob.deleting || blob.unreferenced_at.is_some_and(|time| time <= before))
                {
                    claimed = queries
                        .mark_blob_deleting(&candidate.key)
                        .context("claim content incarnation for deletion")?;
                }
                Ok(())
            })?;
            if !claimed {
                continue;
            }
            self.files
                .delete(&candidate.key)
                .context("delete fenced unreferenced object")?;
            let mut removed = false;
            self.transactions.run(false, &mut |queries| {
                removed = queries
                    .delete_blob_record(&candidate.key)
                    .context("finalize fenced blob deletion")?;
                Ok(())
            })?;
            report.blobs += usize::from(removed);
        }
        let page = self
            .files
            .list(cursor, 100)
            .context("list bounded orphan page")?;
        report.next_cursor = page.next_cursor;
        for object in page.items {
            if object.created_at > before {
                continue;
            }
            let mut referenced = true;
            self.transactions.run(true, &mut |queries| {
                referenced = queries
                    .blob_by_key(&object.key)
                    .context("check orphan incarnation ownership")?
                    .is_some();
                Ok(())
            })?;
            if !referenced {
                self.files
                    .delete(&object.key)
                    .context("delete old unindexed incarnation")?;
                report.orphans += 1;
            }
        }
        Ok(report)
    }
}
