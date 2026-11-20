//! Bounded parallel persistence of validated, content-addressed publication blobs.

use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender, SyncSender};
use std::sync::{Arc, Mutex};
use std::thread;

use bytes::Bytes;
use chrono::{DateTime, Utc};
use mkc_auth::runtime::Runtime;
use mkc_domain::blob::BlobKey;
use mkc_domain::ids::ProjectId;
use mkc_file_store_interface::deadline::OperationDeadline;
use mkc_file_store_interface::store::FileStore;
use thiserror::Error;

use crate::error::{DurabilityFailure, Error, ErrorResultExt, Result};
use crate::transaction::Transactions;

/// One pending content-addressed blob and its already validated bytes.
#[derive(Clone, Debug)]
pub struct PendingBlob<'a> {
    /// Project owning the reserved row, used for canonical marker lock order.
    pub project_id: ProjectId,
    /// Exact reserved storage incarnation.
    pub key: &'a BlobKey,
    /// Exact bytes whose digest matches `key`.
    pub bytes: Bytes,
}

/// Observable work completed by one writer call, including before a later failure.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct BlobWriteReport {
    /// Distinct blobs whose storage put succeeded.
    pub written: usize,
    /// Bytes supplied by successful storage puts.
    pub bytes: u64,
    /// Wall-clock duration from dispatch until every scoped worker joined.
    pub duration_ms: u64,
}

/// Persistence boundary used by publication ingest.
#[unimock::unimock(api = BlobWriterMock)]
pub trait BlobWriter: Send + Sync {
    /// Persist only the supplied pending blobs and always update `report` before returning.
    fn write(
        &self,
        deadline: DateTime<Utc>,
        pending: &[PendingBlob<'_>],
        report: &mut BlobWriteReport,
    ) -> Result<()>;
}

/// Scoped blocking writer with a bounded worker count.
pub struct ParallelBlobWriter {
    /// Exact immutable object storage.
    pub files: Arc<dyn FileStore>,
    /// Short durability-marker transaction executor.
    pub transactions: Arc<dyn Transactions>,
    /// Clock used for attempt deadline checks and duration reporting.
    pub runtime: Arc<dyn Runtime>,
    /// Maximum scoped workers used by one upload.
    pub worker_count: usize,
}

#[derive(Debug, Error)]
enum WriterFailure {
    #[error("[mkc-publications/blob-writer] worker error slot was poisoned")]
    ErrorSlotPoisoned,
    #[error("[mkc-publications/blob-writer] marker channel closed before worker completion")]
    MarkerChannelClosed,
    #[error("[mkc-publications/blob-writer] scoped blob worker panicked")]
    WorkerPanicked,
}

struct CompletedBlob {
    project_id: ProjectId,
    key: BlobKey,
    marked: SyncSender<bool>,
}

struct WorkerState<'a> {
    next: &'a AtomicUsize,
    stop: &'a AtomicBool,
    written: &'a AtomicUsize,
    written_bytes: &'a AtomicU64,
    completed: Sender<CompletedBlob>,
}

impl BlobWriter for ParallelBlobWriter {
    fn write(
        &self,
        deadline: DateTime<Utc>,
        pending: &[PendingBlob<'_>],
        report: &mut BlobWriteReport,
    ) -> Result<()> {
        *report = BlobWriteReport::default();
        let started_at = self.runtime.now();
        let next = AtomicUsize::new(0);
        let stop = AtomicBool::new(false);
        let written = AtomicUsize::new(0);
        let bytes = AtomicU64::new(0);
        let poisoned = AtomicBool::new(false);
        let first_error = Mutex::new(None);

        thread::scope(|scope| {
            let worker_count = self.worker_count.max(1).min(pending.len());
            let (completed, workers) = {
                let (sender, completed) = mpsc::channel();
                let mut workers = Vec::with_capacity(worker_count);
                for _ in 0..worker_count {
                    let state = WorkerState {
                        next: &next,
                        stop: &stop,
                        written: &written,
                        written_bytes: &bytes,
                        completed: sender.clone(),
                    };
                    let first_error = &first_error;
                    let poisoned = &poisoned;
                    workers.push(scope.spawn(move || {
                        let outcome = catch_unwind(AssertUnwindSafe(|| {
                            self.worker(deadline, pending, &state)
                        }));
                        let failure = match outcome {
                            Ok(Ok(())) => return,
                            Ok(Err(error)) => error,
                            Err(_) => Error::internal(WriterFailure::WorkerPanicked),
                        };
                        record_error(state.stop, first_error, poisoned, failure);
                    }));
                }
                (completed, workers)
            };
            self.mark_completed(completed, &stop, &first_error, &poisoned);
            for worker in workers {
                if worker.join().is_err() {
                    record_error(
                        &stop,
                        &first_error,
                        &poisoned,
                        Error::internal(WriterFailure::WorkerPanicked),
                    );
                }
            }
        });

        report.written = written.load(Ordering::Acquire);
        report.bytes = bytes.load(Ordering::Acquire);
        report.duration_ms = self
            .runtime
            .now()
            .signed_duration_since(started_at)
            .num_milliseconds()
            .max(0) as u64;
        if poisoned.load(Ordering::Acquire) {
            return Err(Error::internal(WriterFailure::ErrorSlotPoisoned));
        }
        match first_error.lock() {
            Ok(mut error) => match error.take() {
                Some(error) => Err(error),
                None => Ok(()),
            },
            Err(_) => Err(Error::internal(WriterFailure::ErrorSlotPoisoned)),
        }
    }
}

impl ParallelBlobWriter {
    fn worker(
        &self,
        deadline: DateTime<Utc>,
        pending: &[PendingBlob<'_>],
        state: &WorkerState<'_>,
    ) -> Result<()> {
        loop {
            if state.stop.load(Ordering::Acquire)
                || state.next.load(Ordering::Acquire) >= pending.len()
            {
                return Ok(());
            }
            let operation_deadline = OperationDeadline::for_attempt(self.runtime.now(), deadline)
                .ok_or(Error::Expired)?;
            if state.stop.load(Ordering::Acquire) {
                return Ok(());
            }
            let index = state.next.fetch_add(1, Ordering::AcqRel);
            let Some(blob) = pending.get(index) else {
                return Ok(());
            };
            self.files
                .put(blob.key, blob.bytes.clone(), operation_deadline)
                .context("persist validated publication blob")?;
            state.written.fetch_add(1, Ordering::AcqRel);
            state
                .written_bytes
                .fetch_add(blob.bytes.len() as u64, Ordering::AcqRel);
            let (marked, confirmation) = mpsc::sync_channel(1);
            if state
                .completed
                .send(CompletedBlob {
                    project_id: blob.project_id,
                    key: blob.key.clone(),
                    marked,
                })
                .is_err()
            {
                return Err(Error::internal(WriterFailure::MarkerChannelClosed));
            }
            match confirmation.recv() {
                Ok(true) => {}
                Ok(false) => return Ok(()),
                Err(_) => return Err(Error::internal(WriterFailure::MarkerChannelClosed)),
            }
        }
    }

    fn mark_completed(
        &self,
        completed: Receiver<CompletedBlob>,
        stop: &AtomicBool,
        first_error: &Mutex<Option<Error>>,
        poisoned: &AtomicBool,
    ) {
        while let Ok(first) = completed.recv() {
            let mut batch = vec![first];
            batch.extend(completed.try_iter());
            let outcome = catch_unwind(AssertUnwindSafe(|| self.mark_batch(&batch)));
            let marked = match outcome {
                Ok(Ok(())) => true,
                Ok(Err(error)) => {
                    record_error(stop, first_error, poisoned, error);
                    false
                }
                Err(_) => {
                    record_error(
                        stop,
                        first_error,
                        poisoned,
                        Error::internal(WriterFailure::WorkerPanicked),
                    );
                    false
                }
            };
            for completed in batch {
                if completed.marked.send(marked).is_err() {
                    record_error(
                        stop,
                        first_error,
                        poisoned,
                        Error::internal(WriterFailure::MarkerChannelClosed),
                    );
                }
            }
        }
    }

    fn mark_batch(&self, batch: &[CompletedBlob]) -> Result<()> {
        let mut ordered: Vec<_> = batch.iter().collect();
        ordered.sort_by(|left, right| {
            left.project_id
                .cmp(&right.project_id)
                .then_with(|| left.key.hash.cmp(&right.key.hash))
        });
        self.transactions.run(false, &mut |queries| {
            for completed in &ordered {
                if !queries
                    .mark_blob_stored(&completed.key)
                    .context("confirm persisted publication blob")?
                {
                    return Err(Error::internal(
                        DurabilityFailure::BlobConfirmationRejected {
                            key: completed.key.clone(),
                        },
                    ));
                }
            }
            Ok(())
        })
    }
}

fn record_error(
    stop: &AtomicBool,
    first_error: &Mutex<Option<Error>>,
    poisoned: &AtomicBool,
    error: Error,
) {
    stop.store(true, Ordering::Release);
    match first_error.lock() {
        Ok(mut first) if first.is_none() => *first = Some(error),
        Ok(_) => {}
        Err(_) => poisoned.store(true, Ordering::Release),
    }
}

#[cfg(test)]
#[path = "_tests_/blob_writer_order_tests.rs"]
mod order_tests;
