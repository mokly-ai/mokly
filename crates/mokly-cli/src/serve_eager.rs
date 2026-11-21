//! Attempt hooks start independent base work and adopt only final head evidence.

use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::serve::PreparedServe;
use mokly_compare::base_render::{BasePreparationResult, HistoricalSources};
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::Result;
use mokly_graph::types::RenderGeneration;
use mokly_server::changes::ChangeCancellation;
use mokly_server::changes_background::PendingChanges;

use crate::changes_base_sources::NativePhases;
use crate::serve_base_cancel::BaseLifetime;
use crate::serve_eager_events::PreparationEvents;
use crate::serve_eager_workers::PendingWorkers;

/// A consumed pending result leaves no graph or source copy in its task.
pub struct AdoptedPreparation {
    pub(super) sources: Result<HistoricalSources>,
    pub(super) prepared: Option<BasePreparationResult>,
    pub(super) native: Arc<dyn NativePhases>,
    pub(super) lifetime: Arc<dyn BaseLifetime>,
    pub(super) events: Arc<dyn PreparationEvents>,
    pub(super) workers: Arc<dyn PendingWorkers>,
}

/// One head attempt's cancellable result until its classification consumes it.
pub trait PendingBase: PendingChanges {
    /// The validated configuration that owns the pending result.
    fn config(&self) -> &ResolvedConfig;
    /// Supply final adopted head evidence.
    fn head(&self, head: Arc<dyn RenderGeneration>);
    /// Recheck current inputs and consume the pending result after completed usage.
    fn adopt(
        &self,
        request: &BaseRetentionRequest<'_>,
        cancel: Arc<dyn ChangeCancellation>,
        operation: Arc<dyn ChangeCancellation>,
    ) -> Result<Option<AdoptedPreparation>>;
    /// Release or restore diagnostic routing after the classification settles.
    fn settled(&self, accepted: bool);
}

/// Compose one attempt without running a source operation on the caller.
pub trait EagerFactory: Send + Sync {
    /// Start independent source work for the validated configuration.
    fn start(&self, config: &ResolvedConfig) -> Arc<dyn PendingBase>;
}

#[cfg_attr(test, unimock::unimock(api = EagerStartsMock))]
pub(super) trait EagerStarts: Send + Sync {
    fn configure(&self, factory: Arc<dyn EagerFactory>);
    fn start(&self, config: &ResolvedConfig);
    fn adopted(&self, prepared: &PreparedServe);
    fn discard(&self);
    fn bind(&self, config: &ResolvedConfig) -> Option<Arc<dyn PendingBase>>;
    fn take(&self, pending: &Arc<dyn PendingBase>) -> Option<Arc<dyn PendingChanges>>;
}

#[derive(Default)]
struct Attempts {
    factory: Option<Arc<dyn EagerFactory>>,
    pending: Option<Arc<dyn PendingBase>>,
    previous: Option<Weak<dyn PendingBase>>,
}

#[derive(Default)]
pub(super) struct EagerAttempts(Mutex<Attempts>);

impl EagerStarts for EagerAttempts {
    fn configure(&self, factory: Arc<dyn EagerFactory>) {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .factory = Some(factory);
    }
    fn start(&self, config: &ResolvedConfig) {
        let (previous, factory) = {
            let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
            (state.pending.take(), state.factory.clone())
        };
        if let Some(previous) = previous {
            previous.cancel_and_join();
        }
        if let Some(factory) = factory {
            let pending = factory.start(config);
            self.0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .pending = Some(pending);
        }
    }
    fn adopted(&self, prepared: &PreparedServe) {
        let (pending, previous) = {
            let state = self.0.lock().unwrap_or_else(|error| error.into_inner());
            let previous = state.previous.as_ref().and_then(Weak::upgrade);
            let pending = state
                .pending
                .as_ref()
                .filter(|pending| pending.config() == &prepared.config)
                .cloned()
                .or_else(|| {
                    previous
                        .as_ref()
                        .filter(|pending| pending.config() == &prepared.config)
                        .cloned()
                });
            (pending, previous)
        };
        if let Some(pending) = pending {
            if let Some(previous) = previous.filter(|previous| !Arc::ptr_eq(previous, &pending)) {
                previous.cancel_and_join();
            }
            pending.head(prepared.generation.clone());
        }
    }
    fn discard(&self) {
        let pending = self
            .0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .pending
            .take();
        if let Some(pending) = pending {
            pending.cancel_and_join();
        }
    }
    fn bind(&self, config: &ResolvedConfig) -> Option<Arc<dyn PendingBase>> {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .pending
            .as_ref()
            .filter(|pending| pending.config() == config)
            .cloned()
    }
    fn take(&self, pending: &Arc<dyn PendingBase>) -> Option<Arc<dyn PendingChanges>> {
        let mut state = self.0.lock().unwrap_or_else(|error| error.into_inner());
        if !state
            .pending
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, pending))
        {
            return None;
        }
        state.previous = Some(Arc::downgrade(pending));
        state
            .pending
            .take()
            .map(|pending| -> Arc<dyn PendingChanges> { pending })
    }
}
