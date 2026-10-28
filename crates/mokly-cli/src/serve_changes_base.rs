//! Base preparation progress never forwards historical composition warnings.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_compare::base_render::{
    BasePreparationError, BasePreparationResult, BaseProvider, BaseRequest, PreparedBase,
};
use mokly_compare::cache_types::{Lease, Reporter};
use mokly_compare::error::{Error, Result};
use mokly_model::public_metadata::ChangesStatus;
use mokly_render::side::BaseSide;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::changes_signal::ChangeSignal;
use mokly_server::comparison_graph::FrozenResources;

use crate::base_dependencies::BaseDependencies;
use crate::changes_runtime::cache_line;
use crate::serve_progress::TerminalEvent;
use crate::serve_warnings::AttemptWarnings;
use crate::terminal::Terminal;

pub(super) struct CombinedCancel {
    pub(super) operation: Arc<dyn ChangeCancellation>,
    pub(super) command: Arc<dyn Cancellation>,
    pub(super) generation: Arc<dyn ChangeCancellation>,
}
impl Cancellation for CombinedCancel {
    fn requested(&self) -> bool {
        self.command.requested() || self.generation.cancelled() || self.operation.cancelled()
    }
    fn interrupt(&self) -> bool {
        self.generation.cancel();
        false
    }
}
impl ChangeCancellation for CombinedCancel {
    fn cancel(&self) {
        self.generation.cancel();
    }
    fn cancelled(&self) -> bool {
        self.requested()
    }
    fn observe(&self, signal: Weak<dyn ChangeSignal>) {
        self.generation.observe(signal.clone());
        self.operation.observe(signal);
    }
}
impl mokly_git::control::Cancellation for CombinedCancel {
    fn cancelled(&self) -> bool {
        self.requested()
    }
}

pub(super) struct PreparingDependencies {
    pub(super) inner: Arc<dyn BaseDependencies>,
    pub(super) progress: Arc<dyn ChangeProgress>,
}
impl BaseDependencies for PreparingDependencies {
    fn existing_sources(&self, request: &BaseRequest<'_>) -> Result<Option<Arc<Lease>>> {
        self.inner.existing_sources(request)
    }

    fn prepare(
        &self,
        request: &BaseRequest<'_>,
        config: &ResolvedConfig,
        used: &[String],
        unmapped: &[String],
        sources: Option<Arc<Lease>>,
    ) -> Result<Arc<BaseSide>> {
        if !matches!(self.progress.status(ChangesStatus::Preparing), Ok(true)) {
            return Err(Error::Cancelled);
        }
        self.inner.prepare(request, config, used, unmapped, sources)
    }
}

pub(super) struct AttemptBase {
    pub(super) warnings: Arc<Mutex<Vec<Warning>>>,
    pub(super) inner: Arc<dyn BaseProvider>,
    pub(super) progress: Arc<dyn ChangeProgress>,
}
impl BaseProvider for AttemptBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        let prepared = self.inner.prepare(request);
        let records = match &prepared {
            Ok(base) => base.generation.catalogue().warnings.clone(),
            Err(error) => match &*error.source {
                Error::Catalogue {
                    source: mokly_catalogue::error::CatalogueError::Invalid { warnings, .. },
                } => warnings.clone(),
                Error::Graph { source } => source.warnings(),
                _ => Vec::new(),
            },
        };
        self.warnings
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .extend(
                records
                    .iter()
                    .filter(|warning| {
                        matches!(warning.code, "base-dependencies" | "base-conversion")
                    })
                    .cloned(),
            );
        let prepared = prepared?;
        if !matches!(self.progress.status(ChangesStatus::Pending), Ok(true)) {
            return Err(BasePreparationError::new(
                prepared.scripts_off,
                Error::Cancelled,
            ));
        }
        Ok(PreparedBase {
            generation: Arc::new(FrozenResources::new(prepared.generation)),
            scripts_off: prepared.scripts_off,
        })
    }
}

pub(super) struct CacheNotice {
    pub(super) announced: Arc<AtomicBool>,
    pub(super) warnings: Arc<dyn AttemptWarnings>,
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
    pub(super) cancel: Arc<dyn ChangeCancellation>,
}
impl Reporter for CacheNotice {
    fn opened(&self, directory: &Path) {
        if self.cancel.cancelled() || self.announced.load(Ordering::Acquire) {
            return;
        }
        self.cancel.commit(&TerminalEvent(&|| {
            self.warnings.event(&|| {
                if !self.announced.swap(true, Ordering::AcqRel) {
                    self.terminal
                        .stdout(&cache_line(directory, &self.style, &self.redactor));
                }
            })
        }));
    }
}

#[cfg(test)]
#[path = "_tests_/serve_changes_base_tests.rs"]
mod serve_changes_base_tests;

#[cfg(test)]
#[path = "_tests_/serve_cache_notice_tests.rs"]
mod serve_cache_notice_tests;
