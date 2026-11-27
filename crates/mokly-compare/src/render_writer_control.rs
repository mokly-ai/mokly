//! Command-owned writer startup, identity preparation, bootstrap, and join.

use std::sync::atomic::Ordering;
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use std::thread;

use mokly_graph::cache::RenderCache;
use mokly_graph::document_store::{DocumentStore, ReadOutcome};
use mokly_graph::write_activity::{WriteActivity, WriteReadiness};
use mokly_model::material::digest;

use crate::render_identity::NativeIdentity;
use crate::render_pending::{Shared, StoreObserver, StoreWarning};
use crate::render_store::DocumentBackend;
use crate::render_writer::{self, DocumentWriter, WriterLimits};

/// Stable command context prepared on the existing optional writer.
#[derive(Clone)]
pub struct Startup {
    /// Running-image identity which never samples a replacement pathname.
    pub identity: Arc<dyn NativeIdentity>,
    /// Mokly version and target platform.
    pub context: String,
}

impl Startup {
    pub(crate) fn current(&self) -> Option<String> {
        let image = self.identity.current()?;
        Some(digest(
            format!("{}:{}:{image:?}", self.context.len(), self.context).as_bytes(),
        ))
    }
}

impl DocumentWriter {
    /// Suppress new optional units for the lifetime of local Serve work.
    pub fn activity(&self) -> Arc<dyn WriteActivity> {
        self.shared.admission.clone()
    }

    /// Bind a non-owning current-publication query after Serve creates its state.
    pub fn bind_readiness(&self, readiness: Arc<dyn WriteReadiness>) {
        self.shared.admission.bind(readiness);
    }

    /// Compose terminal diagnostics at the command boundary before starting the writer.
    pub fn observed(
        backend: Arc<dyn DocumentBackend>,
        cache: Arc<dyn RenderCache>,
        limits: WriterLimits,
        observer: Arc<dyn StoreObserver>,
    ) -> Self {
        Self::start(backend, cache, limits, observer, None, None)
    }

    /// Start identity and index preparation early, with document writes paused.
    pub fn prepared(
        backend: Arc<dyn DocumentBackend>,
        cache: Arc<dyn RenderCache>,
        limits: WriterLimits,
        observer: Arc<dyn StoreObserver>,
        startup: Startup,
    ) -> Self {
        Self::start(backend, cache, limits, observer, Some(startup), None)
    }

    /// Start the writer. The writer thread owns `idle` and sends on it each
    /// time that it waits for new work, so that it holds no pending lock.
    /// The sender drops when the thread cannot start or ends.
    pub(crate) fn start(
        backend: Arc<dyn DocumentBackend>,
        cache: Arc<dyn RenderCache>,
        limits: WriterLimits,
        observer: Arc<dyn StoreObserver>,
        startup: Option<Startup>,
        idle: Option<Sender<()>>,
    ) -> Self {
        let shared = Arc::new(Shared::new(
            limits.keys,
            limits.key_bytes,
            startup.is_some(),
        ));
        observer.state(shared.stats());
        let pending = shared.clone();
        let sink = observer.clone();
        let storage = backend.clone();
        let initializing = startup.clone();
        let worker = thread::Builder::new()
            .name("mokly-documents".into())
            .spawn(move || {
                initialize(
                    initializing.as_ref(),
                    pending.as_ref(),
                    storage.as_ref(),
                    sink.as_ref(),
                );
                render_writer::run(pending, cache, storage, limits, sink, idle);
            });
        let (worker, unavailable) = match worker {
            Ok(worker) => (Some(worker), false),
            Err(_) => {
                observer.warning(StoreWarning::Directory);
                (None, true)
            }
        };
        if unavailable {
            shared.disabled.store(true, Ordering::Release);
        }
        Self {
            backend,
            limits,
            shared,
            observer,
            worker: Mutex::new(worker),
            startup,
        }
    }

    /// Join the already stopped writer at its command lifetime boundary.
    pub fn shutdown(&self) {
        self.stop();
        let worker = self
            .worker
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if let Some(worker) = worker {
            let _ = worker.join();
        }
    }
}

#[tracing::instrument(name = "render.store.initialize", skip_all)]
fn initialize(
    startup: Option<&Startup>,
    shared: &Shared,
    backend: &dyn DocumentBackend,
    observer: &dyn StoreObserver,
) {
    let Some(startup) = startup else { return };
    startup.identity.prepare();
    let outcome = if startup.identity.cancelled() {
        ReadOutcome::Miss
    } else if startup.current().is_some() {
        backend.initialize()
    } else {
        ReadOutcome::Unavailable
    };
    let fault = match &outcome {
        ReadOutcome::Rejected(fault) | ReadOutcome::RejectedWithStoreFault(fault) => Some(*fault),
        _ => None,
    };
    if let Some(fault) = fault {
        observer.warning(StoreWarning::Entry(fault));
    }
    if matches!(
        outcome,
        ReadOutcome::Unavailable
            | ReadOutcome::HitWithStoreFault(_)
            | ReadOutcome::RejectedWithStoreFault(_)
    ) && !shared.disabled.swap(true, Ordering::AcqRel)
    {
        observer.warning(StoreWarning::Directory);
    }
    let mut pending = shared
        .pending
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    pending.stats.faults += usize::from(fault.is_some());
    shared.emit(pending.stats, observer);
}

#[cfg(test)]
#[path = "_tests_/render_writer_startup_tests.rs"]
mod render_writer_startup_tests;
