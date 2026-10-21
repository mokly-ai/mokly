//! Serve comparison composition shares the head runtime and captured warning attempt.

use std::cell::RefCell;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::output::Style;
use mokly_cli::redaction::Redactor;
use mokly_cli::serve::PreparedServe;
use mokly_cli::{build_output, serve_errors, serve_output};
use mokly_compare::base_render::selected_base;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_graph::types::RenderGeneration;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{
    CaptureLease, ChangeCancellation, ChangeProgress, ChangeRun, ChangeSource,
};
use mokly_server::comparison_graph::FrozenResources;
use mokly_server::error::{Result, ServerError};

use crate::serve_capture_cancel::{CaptureCancellation, CaptureScopes};
use crate::serve_git::GitWork;
use crate::serve_pool::PoolScheduling;
use crate::serve_progress::{Progress, TerminalEvent};
use crate::serve_reporter::GitRefresh;
use crate::serve_warnings::{AttemptWarnings, WarningScopes};
use crate::terminal::Terminal;

pub(super) trait ChangeSources: Send + Sync {
    fn create(
        &self,
        prepared: &PreparedServe,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Arc<dyn ChangeSource>;
}

#[derive(Clone)]
pub(super) struct ServeChanges {
    pub(super) sidecars: Arc<dyn PoolScheduling>,
    pub(super) progress: Arc<dyn Progress>,
    pub(super) refreshes: Arc<dyn GitRefresh>,
    pub(super) cache_announced: Arc<AtomicBool>,
    pub(super) warnings: Arc<dyn WarningScopes>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) git: Arc<dyn GitWork>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) terminal: Arc<dyn Terminal>,
    pub(super) style: Style,
    pub(super) redactor: Arc<Redactor>,
    pub(super) base: Option<String>,
    pub(super) install_scripts: Option<bool>,
}
impl ChangeSources for ServeChanges {
    fn create(
        &self,
        prepared: &PreparedServe,
        warnings: Arc<dyn AttemptWarnings>,
    ) -> Arc<dyn ChangeSource> {
        Arc::new(Source {
            services: self.clone(),
            config: prepared.config.clone(),
            head: Arc::new(FrozenResources::new(prepared.generation.clone())),
            warnings,
            pending: Arc::new(Mutex::new(Vec::new())),
            operation: Arc::new(CaptureCancellation::default()),
            references: Mutex::new(None),
        })
    }
}
pub(super) struct Source {
    pub(super) references: Mutex<Option<(Vec<String>, String)>>,
    pub(super) operation: Arc<dyn CaptureScopes>,
    pub(super) pending: Arc<Mutex<Vec<Warning>>>,
    pub(super) services: ServeChanges,
    pub(super) config: ResolvedConfig,
    pub(super) head: Arc<dyn RenderGeneration>,
    pub(super) warnings: Arc<dyn AttemptWarnings>,
}
impl ChangeSource for Source {
    fn started(&self, cancel: Arc<dyn ChangeCancellation>) -> Option<Box<dyn ChangeRun>> {
        let phase = RefCell::new(None);
        cancel.commit(&TerminalEvent(&|| {
            self.warnings.event(&|| {
                let label = self.services.redactor.safe(&format!(
                    "Comparing with {}",
                    selected_base(&self.config, self.services.base.as_deref())
                ));
                *phase.borrow_mut() = Some(self.services.progress.begin(&label, cancel.clone()));
            })
        }));
        phase.into_inner()
    }

    fn capture_scope(&self, cancel: Arc<dyn ChangeCancellation>) -> Option<Box<dyn CaptureLease>> {
        Some(self.operation.enter(cancel))
    }

    fn refreshed(&self) -> Option<Arc<dyn ChangeSource>> {
        let warnings = self.services.warnings.current();
        warnings.event(&|| {
            self.services
                .refreshes
                .refreshing(selected_base(&self.config, self.services.base.as_deref()))
        });
        Some(Arc::new(Self {
            services: self.services.clone(),
            config: self.config.clone(),
            head: self.head.clone(),
            warnings,
            pending: Arc::new(Mutex::new(Vec::new())),
            operation: Arc::new(CaptureCancellation::default()),
            references: Mutex::new(None),
        }))
    }
    fn references(&self, cancel: Arc<dyn ChangeCancellation>) -> Result<String> {
        self.references_native(cancel)
    }
    fn classify(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
    ) -> Result<ComparisonResult> {
        self.classify_native(cancel, progress)
    }
    fn finished(
        &self,
        result: std::result::Result<&ComparisonResult, &ServerError>,
        elapsed: Duration,
    ) {
        let mut warnings = self
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        if let Ok(result) = &result {
            warnings.extend(
                result
                    .warnings
                    .iter()
                    .filter(|warning| warning.code == "base-dependencies")
                    .cloned(),
            );
        }
        self.warnings.finish(&warnings, false, &|warnings| {
            self.services.terminal.stderr(&build_output::warnings(
                &self.services.style,
                warnings,
                &self.services.redactor,
            ));
            match result {
                Ok(result) => self.services.terminal.stdout(&serve_output::changes_ready(
                    &self.services.style,
                    result.counts.changes,
                    result.counts.moved,
                    result.counts.ignored_only,
                    elapsed,
                )),
                Err(error) => {
                    self.services.terminal.stderr(&serve_errors::failure(
                        &self.services.style,
                        error,
                        &self.services.redactor,
                    ));
                    self.services
                        .terminal
                        .stdout(&serve_output::changes_unavailable(
                            &self.services.style,
                            &serve_errors::changes_reason(error),
                            &self.services.redactor,
                        ));
                }
            }
        });
    }
}

#[cfg(test)]
#[path = "_tests_/serve_changes_tests.rs"]
mod serve_changes_tests;
