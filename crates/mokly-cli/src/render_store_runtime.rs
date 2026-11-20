//! Serve-only optional document storage shares cache ownership and command lifetime.

use std::path::Path;
use std::sync::{Arc, Weak};

use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::Mode;
use mokly_cli::version::VERSION;
use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::Reporter;
use mokly_compare::locations::{Locations, SystemLocations};
use mokly_compare::render_image::{ImageIdentity, SystemImage};
use mokly_compare::render_pending::{StoreObserver, StoreWarning, TraceStoreObserver};
use mokly_compare::render_segment_buffer::BuiltSegment;
use mokly_compare::render_store::{
    CAPACITY, CachedDocuments, DocumentBackend, RenderDisk, WriteOutcome,
};
use mokly_compare::render_writer::{DocumentWriter, WriterLimits};
use mokly_compare::render_writer_control::Startup;
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{self, SystemClock};
use mokly_graph::cache::RenderCache;
use mokly_graph::document_store::{ReadOutcome, StoreKey, StoreStats};
use mokly_graph::write_activity::WriteReadiness;
use mokly_model::public_metadata::ChangesStatus;
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;
use mokly_server::publication::Publications;
use mokly_sidecar::workers::Diagnostics;

pub(super) fn store(
    repository: &Path,
    cancellation: Arc<dyn Cancellation>,
    cache: Arc<dyn RenderCache>,
    reporter: Arc<dyn Reporter>,
    diagnostics: Arc<dyn Diagnostics>,
    mode: Mode,
) -> Arc<DocumentWriter> {
    let cancellation: Arc<dyn control::Cancellation> = Arc::new(CommandCancellation(cancellation));
    let backend: Arc<dyn DocumentBackend> = match SystemLocations.repository(repository) {
        Ok(root) => {
            let disk = Arc::new(DiskCache {
                root: root.clone(),
                source_bytes: 2 * 1024 * 1024 * 1024,
                dependency_bytes: 2 * 1024 * 1024 * 1024,
                storage: Arc::new(SystemStorage {
                    root,
                    cancellation: cancellation.clone(),
                    flush: Arc::new(SystemFlush),
                }),
                locks: Arc::new(SystemLocks),
                clock: Arc::new(SystemClock::default()),
                cancellation: cancellation.clone(),
                reporter,
            });
            Arc::new(CachedDocuments::new(
                Arc::new(RenderDisk::new(disk, CAPACITY)),
                VERSION.into(),
            ))
        }
        Err(_) => Arc::new(Unavailable),
    };
    Arc::new(DocumentWriter::prepared(
        backend,
        cache,
        WriterLimits::default(),
        Arc::new(Reported { diagnostics, mode }),
        Startup {
            identity: Arc::new(ImageIdentity::new(Arc::new(SystemImage {
                embedded: env!("MOKLY_NATIVE_BUILD").into(),
                cancellation,
            }))),
            context: format!(
                "{VERSION}:{}:{}",
                std::env::consts::OS,
                std::env::consts::ARCH
            ),
        },
    ))
}

pub(super) fn bind(writer: &DocumentWriter, publications: Arc<dyn Publications>) {
    writer.bind_readiness(Arc::new(CurrentChanges(Arc::downgrade(&publications))));
}

struct CurrentChanges(Weak<dyn Publications>);
impl WriteReadiness for CurrentChanges {
    fn ready(&self) -> bool {
        self.0.upgrade().is_some_and(|publications| {
            matches!(
                publications.current().index.changes_status,
                ChangesStatus::Ready | ChangesStatus::Unavailable
            )
        })
    }
}

struct CommandCancellation(Arc<dyn Cancellation>);
impl control::Cancellation for CommandCancellation {
    fn cancelled(&self) -> bool {
        self.0.requested()
    }
}

struct Unavailable;
impl DocumentBackend for Unavailable {
    fn version(&self) -> &str {
        VERSION
    }
    fn initialize(&self) -> ReadOutcome {
        ReadOutcome::Unavailable
    }
    fn load(&self, _: &StoreKey) -> ReadOutcome {
        ReadOutcome::Unavailable
    }
    fn save(&self, _: &BuiltSegment<'_>) -> WriteOutcome {
        WriteOutcome::Unavailable
    }
}

struct Reported {
    diagnostics: Arc<dyn Diagnostics>,
    mode: Mode,
}

#[cfg(test)]
#[path = "_tests_/render_store_runtime_tests.rs"]
mod render_store_runtime_tests;
impl StoreObserver for Reported {
    fn state(&self, stats: StoreStats) {
        TraceStoreObserver.state(stats);
    }
    fn warning(&self, warning: StoreWarning) {
        let prefix = if self.mode == Mode::Plain {
            "[mokly/warning]"
        } else {
            "  !"
        };
        let message = match warning {
            StoreWarning::Entry(_) => "A cached document could not be reused. Rendering it again.",
            StoreWarning::Directory => {
                "The rendered document cache is unavailable. Rendering without it."
            }
        };
        self.diagnostics.emit(&format!("{prefix} {message}"));
    }
}
