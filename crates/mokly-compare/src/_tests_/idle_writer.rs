//! Writers whose tests offer only after the writer thread is idle.
//!
//! The writer takes the pending lock for a moment when it starts and after
//! each wake. An offer never waits for that lock, so a test that expects a
//! queued offer first waits until the writer thread waits for new work.

use std::sync::Arc;
use std::sync::mpsc::{Receiver, channel};

use mokly_graph::cache::RenderCache;
use mokly_graph::document_store::{DocumentStore, OfferOutcome, StoreKey};
use mokly_graph::key::NodeKey;

use crate::render_pending::TraceStoreObserver;
use crate::render_store::DocumentBackend;
use crate::render_writer::{DocumentWriter, WriterLimits};
use crate::render_writer_control::Startup;

/// A writer and the signals that its thread sends each time that it is idle.
pub(crate) struct IdleWriter {
    /// The writer under test.
    pub(crate) store: Arc<DocumentWriter>,
    idle: Receiver<()>,
}

impl IdleWriter {
    /// Start a writer with trace diagnostics, prepared when `startup` is set.
    pub(crate) fn start(
        backend: Arc<dyn DocumentBackend>,
        cache: Arc<dyn RenderCache>,
        limits: WriterLimits,
        startup: Option<Startup>,
    ) -> Self {
        let (sender, idle) = channel();
        let store = Arc::new(DocumentWriter::start(
            backend,
            cache,
            limits,
            Arc::new(TraceStoreObserver),
            startup,
            Some(sender),
        ));
        Self { store, idle }
    }

    /// Offer one key after the writer thread next waits for new work.
    pub(crate) fn offer_when_idle(&self, key: StoreKey, document: NodeKey) -> OfferOutcome {
        self.idle
            .recv()
            .expect("the writer thread ended before it waited for work");
        self.store.offer(key, document)
    }
}
