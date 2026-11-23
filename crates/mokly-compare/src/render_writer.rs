//! Bounded document-key admission and one optional off-path writer.

use std::mem;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use mokly_graph::cache::RenderCache;
use mokly_graph::document_store::{DocumentStore, OfferOutcome, ReadOutcome, StoreKey, StoreStats};
use mokly_graph::key::NodeKey;

use crate::render_batch::Batch;
use crate::render_pending::{Request, Shared, StoreObserver, StoreWarning};
use crate::render_segment::MAX_DOCUMENTS;
use crate::render_segment_buffer::SegmentBuffer;
use crate::render_store::DocumentBackend;
use crate::render_writer_control::Startup;

/// Internal fixed resource limits, injectable for small boundary tests.
#[derive(Clone, Copy)]
pub struct WriterLimits {
    /// Maximum admitted keys, including active work.
    pub keys: usize,
    /// Maximum charged key bookkeeping, including active work.
    pub key_bytes: usize,
    /// Maximum bytes of encoded documents in one segment.
    pub segment_bytes: usize,
}

impl Default for WriterLimits {
    fn default() -> Self {
        Self {
            keys: 8192,
            key_bytes: 2 * 1024 * 1024,
            segment_bytes: 1024 * 1024,
        }
    }
}

/// Command-owned optional writer. Pending work contains keys only.
pub struct DocumentWriter {
    pub(crate) backend: Arc<dyn DocumentBackend>,
    pub(crate) limits: WriterLimits,
    pub(crate) shared: Arc<Shared>,
    pub(crate) observer: Arc<dyn StoreObserver>,
    pub(crate) worker: Mutex<Option<JoinHandle<()>>>,
    pub(crate) startup: Option<Startup>,
}

impl DocumentStore for DocumentWriter {
    fn identity(&self) -> Option<String> {
        self.startup.as_ref()?.current()
    }
    fn contains(&self, key: &StoreKey) -> bool {
        !self.shared.disabled.load(Ordering::Acquire) && self.backend.contains(key)
    }
    fn resume(&self) {
        self.shared.admission.resume();
    }
    #[tracing::instrument(name = "render.store.read", skip_all)]
    fn load(&self, key: &StoreKey) -> ReadOutcome {
        let outcome = if self.shared.disabled.load(Ordering::Acquire) {
            ReadOutcome::Miss
        } else {
            self.backend.load(key)
        };
        self.finish_read(outcome)
    }
    fn offer(&self, key: StoreKey, document: NodeKey) -> OfferOutcome {
        let request = Request::new(key, document);
        let Ok(mut pending) = self.shared.pending.try_lock() else {
            self.shared.contended(self.observer.as_ref());
            return OfferOutcome::Dropped;
        };
        if pending.keys.contains(&request.key) {
            return OfferOutcome::Present;
        }
        if pending.closed
            || self.shared.disabled.load(Ordering::Acquire)
            || pending.keys.len() >= self.limits.keys
            || request.bytes > self.limits.key_bytes.saturating_sub(pending.bytes)
        {
            pending.stats.drops += 1;
            self.shared.emit(pending.stats, self.observer.as_ref());
            return OfferOutcome::Dropped;
        }
        pending.bytes += request.bytes;
        let set_key = request.key.clone();
        pending.strings +=
            request.key.0.capacity() + request.document.0.capacity() + set_key.0.capacity();
        pending.keys.insert(set_key);
        pending.queue.push_back(request);
        pending.stats.queued = pending.queue.len();
        pending.sample();
        self.shared.emit(pending.stats, self.observer.as_ref());
        self.shared.admission.notify();
        OfferOutcome::Queued
    }
    fn stats(&self) -> StoreStats {
        self.shared.stats()
    }
    fn stop(&self) {
        let mut pending = self
            .shared
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        pending.closed = true;
        while let Some(request) = pending.queue.pop_front() {
            pending.release(&request);
            pending.stats.drops += 1;
        }
        pending.stats.queued = 0;
        pending.sample();
        self.shared.emit(pending.stats, self.observer.as_ref());
        self.shared.admission.close();
    }
}

impl DocumentWriter {
    /// Finalize one ordinary outcome through the shared state and warnings.
    fn finish_read(&self, outcome: ReadOutcome) -> ReadOutcome {
        let entry_warning = match &outcome {
            ReadOutcome::Rejected(fault) | ReadOutcome::RejectedWithStoreFault(fault) => {
                Some(*fault)
            }
            _ => None,
        };
        let directory = matches!(
            &outcome,
            ReadOutcome::Unavailable
                | ReadOutcome::HitWithStoreFault(_)
                | ReadOutcome::RejectedWithStoreFault(_)
        );
        let directory = directory && !self.shared.disabled.swap(true, Ordering::AcqRel);
        {
            let mut state = self.shared.read_state();
            match &outcome {
                ReadOutcome::Hit(_) | ReadOutcome::HitWithStoreFault(_) => {
                    state.pending.stats.hits += 1;
                }
                _ => state.pending.stats.misses += 1,
            }
            if matches!(
                &outcome,
                ReadOutcome::Rejected(_) | ReadOutcome::RejectedWithStoreFault(_)
            ) {
                state.pending.stats.faults += 1;
            }
            state.emit(self.shared.as_ref(), self.observer.as_ref());
        }
        if let Some(fault) = entry_warning {
            self.observer.warning(StoreWarning::Entry(fault));
        }
        if directory {
            self.observer.warning(StoreWarning::Directory);
        }
        outcome
    }
}

impl Drop for DocumentWriter {
    fn drop(&mut self) {
        self.shutdown();
    }
}

pub(crate) fn run(
    shared: Arc<Shared>,
    cache: Arc<dyn RenderCache>,
    backend: Arc<dyn DocumentBackend>,
    limits: WriterLimits,
    observer: Arc<dyn StoreObserver>,
) {
    loop {
        let (epoch, closed, allowed) = shared.admission.status();
        if closed {
            return;
        }
        if !allowed {
            shared.admission.wait(epoch);
            continue;
        }
        let requests = {
            let mut pending = shared
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if pending.closed {
                return;
            }
            if pending.queue.is_empty() {
                None
            } else {
                let count = MAX_DOCUMENTS.min(pending.queue.len());
                let requests: Vec<_> = pending.queue.drain(..count).collect();
                pending.active_capacity = requests.capacity() * mem::size_of::<Request>();
                pending.stats.queued = pending.queue.len();
                pending.stats.active = requests.len();
                pending.sample();
                shared.emit(pending.stats, observer.as_ref());
                Some(requests)
            }
        };
        let Some(requests) = requests else {
            shared.admission.wait(epoch);
            continue;
        };
        let (written, bytes, unavailable) = {
            let mut batch = Batch {
                shared: shared.clone(),
                admission: shared.admission.as_ref(),
                requests: &requests,
                cache: cache.clone(),
                backend: backend.clone(),
                limit: limits.segment_bytes,
                written: 0,
                bytes: 0,
                unavailable: false,
            };
            if let Some(workspace) = SegmentBuffer::workspace_bytes(limits.segment_bytes) {
                cache.with_workspace(workspace, &mut batch);
            }
            (batch.written, batch.bytes, batch.unavailable)
        };
        {
            let mut pending = shared
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            pending.stats.writes += written;
            pending.stats.bytes += bytes;
            pending.stats.drops += requests.len() - written;
            for request in requests {
                pending.release(&request);
            }
            pending.active_capacity = 0;
            pending.stats.active = 0;
            pending.sample();
            shared.emit(pending.stats, observer.as_ref());
        }
        if unavailable && !shared.disabled.swap(true, Ordering::AcqRel) {
            observer.warning(StoreWarning::Directory);
        }
    }
}

#[cfg(test)]
#[path = "_tests_/render_writer_tests.rs"]
mod render_writer_tests;

#[cfg(test)]
#[path = "_tests_/render_writer_state_tests.rs"]
mod render_writer_state_tests;
