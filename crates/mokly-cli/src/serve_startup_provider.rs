//! Ordinary classification takes startup diagnostics and captured services once.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_compare::base_render::{
    BasePreparationResult, BaseProvider, BaseRequest, PreparationCheckpoint,
};
use mokly_compare::base_retention::{BaseRetentionRequest, BaseReuse, KeptBase};
use mokly_compare::base_startup::PreparedOutcome;
use mokly_compare::cache_types::Reporter;
use mokly_compare::error::Result;
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::ChangeCancellation;

use crate::serve_base_key::BaseKey;
use crate::serve_changes_base::CombinedCancel;
use crate::serve_startup_base::StartupHandoff;

/// This adapter runs only after the ordinary classifier selects its authoritative key.
pub(super) struct StartupProvider {
    pub(super) inner: Arc<dyn BaseProvider>,
    pub(super) handoff: Arc<dyn StartupHandoff>,
    pub(super) head: Arc<dyn RenderGeneration>,
    pub(super) cancel: Arc<dyn ChangeCancellation>,
    pub(super) cancellation: Arc<CombinedCancel>,
    pub(super) warnings: Arc<Mutex<Vec<Warning>>>,
    pub(super) reporter: Arc<dyn Reporter>,
    pub(super) pending: Mutex<Option<HeldDiagnostics>>,
}

/// A retained outcome reports only after its ordinary freshness check accepts it.
pub(super) struct HeldDiagnostics {
    warnings: Vec<Warning>,
    cache: Option<PathBuf>,
}

impl StartupProvider {
    fn report(&self, diagnostics: HeldDiagnostics) {
        self.warnings
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .extend(diagnostics.warnings);
        if let Some(directory) = diagnostics.cache {
            self.reporter.opened(&directory);
        }
    }
}

impl BaseProvider for StartupProvider {
    fn take_prepared(&self, request: &BaseRetentionRequest<'_>) -> Result<Option<PreparedOutcome>> {
        let ready = self
            .handoff
            .take(&BaseKey::new(request)?, &self.head, self.cancel.as_ref())?;
        let Some(ready) = ready else {
            return Ok(None);
        };
        let diagnostics = HeldDiagnostics {
            warnings: ready.warnings,
            cache: ready.cache,
        };
        if matches!(&ready.result, Ok(PreparedOutcome::Retained)) {
            *self
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = Some(diagnostics);
        } else {
            self.report(diagnostics);
        }
        if matches!(&ready.result, Ok(PreparedOutcome::Captured(_)))
            && let Some(lifetime) = ready.lifetime
        {
            lifetime.transfer(self.cancellation.clone());
        }
        ready.result.map(Some)
    }
    fn checkpoint(
        &self,
        request: &BaseRetentionRequest<'_>,
        checkpoint: PreparationCheckpoint,
    ) -> Result<bool> {
        self.inner.checkpoint(request, checkpoint)
    }
    fn restarting(&self) {
        self.inner.restarting();
    }
    fn find_kept(&self, request: &BaseRetentionRequest<'_>) -> Result<Option<BaseReuse>> {
        let found = self.inner.find_kept(request);
        let pending = self
            .pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        if matches!(&found, Ok(Some(_)))
            && let Some(pending) = pending
        {
            self.report(pending);
        }
        found
    }
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        self.inner.prepare(request)
    }
    fn keep(
        &self,
        request: &BaseRetentionRequest<'_>,
        base: Arc<KeptBase>,
    ) -> Result<Option<BaseReuse>> {
        self.inner.keep(request, base)
    }
    fn release(&self, base: &Arc<KeptBase>) {
        self.inner.release(base);
    }
}

#[cfg(test)]
#[path = "_tests_/serve_startup_provider_tests.rs"]
mod serve_startup_provider_tests;
