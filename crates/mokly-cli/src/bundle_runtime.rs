//! Command-cancelled optional bundle storage and terminal warning interpretation.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::Mode;
use mokly_cli::version::VERSION;
use mokly_compare::bundle_store::CachedBundles;
use mokly_compare::cache::DiskCache;
use mokly_compare::cache_types::Reporter;
use mokly_compare::locations::{Locations, SystemLocations};
use mokly_compare::storage::SystemStorage;
use mokly_git::control::{self, SystemClock};
use mokly_platform::flush::SystemFlush;
use mokly_platform::locks::SystemLocks;
use mokly_sidecar::bundle_outcomes::{Effects, EntryFault};
use mokly_sidecar::bundle_store::{BundleStore, ReadMiss, ReadOutcome, RecordToken, WriteOutcome};
use mokly_sidecar::durable_recipe::DurableRecipe;
use mokly_sidecar::methods::Bundle;
use mokly_sidecar::workers::Diagnostics;

/// Shared command directory reporter and the selected output mode.
pub(super) struct Reporting {
    pub(super) directory: Arc<dyn Reporter>,
    pub(super) mode: Mode,
}

/// Compose an optional store. Location failure becomes its first recoverable fault.
pub(super) fn store(
    repository: &Path,
    cancellation: Arc<dyn Cancellation>,
    reporting: Reporting,
    diagnostics: Arc<dyn Diagnostics>,
) -> Arc<dyn BundleStore> {
    let directory = reporting.directory.clone();
    let inner: Arc<dyn BundleStore> = match SystemLocations.repository(repository) {
        Ok(root) => {
            let cancellation: Arc<dyn control::Cancellation> =
                Arc::new(CommandCancellation(cancellation));
            let cache = Arc::new(DiskCache {
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
                cancellation,
                reporter: reporting.directory,
            });
            Arc::new(CachedBundles::new(cache, VERSION.into()))
        }
        Err(_) => Arc::new(Unavailable(AtomicBool::new(false))),
    };
    Arc::new(Reported {
        directory,
        inner,
        diagnostics,
        mode: reporting.mode,
    })
}

struct CommandCancellation(Arc<dyn Cancellation>);
impl control::Cancellation for CommandCancellation {
    fn cancelled(&self) -> bool {
        self.0.requested()
    }
}

struct Unavailable(AtomicBool);
impl Unavailable {
    fn fault(&self) -> WriteOutcome {
        if self.0.swap(true, Ordering::AcqRel) {
            WriteOutcome::Disabled
        } else {
            WriteOutcome::StoreFault
        }
    }
}
impl BundleStore for Unavailable {
    fn load(&self, _: &Bundle) -> ReadOutcome {
        ReadOutcome::Miss(if self.fault() == WriteOutcome::StoreFault {
            ReadMiss::StoreFault
        } else {
            ReadMiss::Disabled
        })
    }
    fn save(&self, _: &DurableRecipe) -> WriteOutcome {
        self.fault()
    }
    fn invalidate(&self, _: &Bundle, _: &RecordToken) -> WriteOutcome {
        self.fault()
    }
}

pub(super) struct Reported {
    pub(super) directory: Arc<dyn Reporter>,
    pub(super) inner: Arc<dyn BundleStore>,
    pub(super) diagnostics: Arc<dyn Diagnostics>,
    pub(super) mode: Mode,
}
impl Reported {
    fn report(&self, root: &Path, effects: Effects) {
        let diagnostics = self
            .diagnostics
            .for_source_root(root)
            .unwrap_or_else(|| self.diagnostics.clone());
        let prefix = if self.mode == Mode::Plain {
            "[mokly/warning]"
        } else {
            "  !"
        };
        if effects.warnings.entry {
            diagnostics.emit(&format!(
                "{prefix} A cached JavaScript bundle could not be reused. Bundling it again."
            ));
        }
        if effects.warnings.directory {
            diagnostics.emit(&format!(
                "{prefix} The JavaScript bundle cache is unavailable. Bundling without it."
            ));
        }
    }
}
impl BundleStore for Reported {
    fn load(&self, params: &Bundle) -> ReadOutcome {
        let _scope = self.directory.scope(Path::new(&params.source_root));
        let result = self.inner.load(params);
        self.report(Path::new(&params.source_root), result.effects());
        result
    }
    fn save(&self, recipe: &DurableRecipe) -> WriteOutcome {
        let _scope = self
            .directory
            .scope(Path::new(&recipe.params().source_root));
        let result = self.inner.save(recipe);
        self.report(Path::new(&recipe.params().source_root), result.effects());
        result
    }
    fn invalidate(&self, params: &Bundle, token: &RecordToken) -> WriteOutcome {
        let _scope = self.directory.scope(Path::new(&params.source_root));
        let result = self.inner.invalidate(params, token);
        self.report(
            Path::new(&params.source_root),
            result.with_entry_fault(EntryFault::Damaged).effects(),
        );
        result
    }
}

#[cfg(test)]
#[path = "_tests_/bundle_output_tests.rs"]
mod bundle_output_tests;
