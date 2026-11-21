//! One typed source result becomes a validated graph after final head adoption.

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::cancellation::Cancellation;
use mokly_compare::base_freshness::Freshness;
use mokly_compare::base_render::{
    BasePreparationResult, BaseRequest, BaseSourceFactory, HistoricalSources,
};
use mokly_compare::base_selection::{BaseLookup, PinnedBase};
use mokly_compare::error::Error;
use mokly_compare::working_inputs::WorkingInputs;
use mokly_graph::types::RenderGeneration;
use mokly_graph::write_activity::WriteActivity;
use mokly_render::runtime::Runtime;
use mokly_server::changes::ChangeCancellation;

use crate::changes_base_sources::{NativePhases, NativeSources};
use crate::changes_source_admission::SourceAdmission;
use crate::serve_base::KeptAvailability;
use crate::serve_base_cancel::BaseLifetime;
use crate::serve_changes_base::preparation_warnings;
use crate::serve_eager_cancel::OriginScope;
use crate::serve_eager_diagnostics::DiagnosticRouting;
use crate::serve_eager_events::PreparationEvents;
use crate::serve_eager_evidence::{HeadEvidence, NativeEvidence};
use crate::serve_eager_task::{PreparationWork, SourceCompletion};
use crate::serve_eager_validation::PreparationValidation;
use crate::serve_eager_workers::PendingWorkers;

/// The graph owns a delegate for the existing classification capture workers.
pub struct PendingServices {
    pub(super) source_admission: Arc<dyn SourceAdmission>,
    pub(super) provider: Arc<dyn NativePhases>,
    pub(super) workers: Arc<dyn PendingWorkers>,
    pub(super) validation: Arc<dyn PreparationValidation>,
}

#[cfg_attr(test, unimock::unimock(api = PendingProvidersMock))]
pub(super) trait PendingProviders: Send + Sync {
    fn create(&self) -> PendingServices;
}

pub(super) struct Context {
    pub(super) selected: Arc<PinnedBase>,
    pub(super) sources: HistoricalSources,
    pub(super) services: PendingServices,
    pub(super) evidence: Arc<NativeEvidence>,
    pub(super) root: Option<PathBuf>,
}

pub(super) enum WorkState {
    Unpinned(Error),
    Source {
        context: Context,
        prepared: Box<NativeSources>,
    },
    Ready {
        context: Context,
        prepared: BasePreparationResult,
    },
    Failed {
        evidence: Arc<NativeEvidence>,
        services: PendingServices,
        source: Error,
    },
}

pub(super) struct NativePreparation {
    pub(super) config: ResolvedConfig,
    pub(super) base: Option<String>,
    pub(super) install_scripts: bool,
    pub(super) lookup: Arc<dyn BaseLookup>,
    pub(super) sources: Arc<dyn BaseSourceFactory>,
    pub(super) providers: Arc<dyn PendingProviders>,
    pub(super) availability: Arc<dyn KeptAvailability>,
    pub(super) working: Arc<dyn WorkingInputs>,
    pub(super) freshness: Arc<dyn Freshness>,
    pub(super) origin: Arc<dyn OriginScope>,
    pub(super) lifetime: Arc<dyn BaseLifetime>,
    pub(super) events: Arc<dyn PreparationEvents>,
    pub(super) diagnostics: Arc<dyn DiagnosticRouting>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) state: Mutex<Option<WorkState>>,
    pub(super) consumed: Mutex<Option<PathBuf>>,
    pub(super) accepted: AtomicBool,
    pub(super) command: Arc<dyn Cancellation>,
    pub(super) activity: Arc<dyn WriteActivity>,
    pub(super) guard: Mutex<Option<Arc<NativeEvidence>>>,
}

impl PreparationWork for NativePreparation {
    fn sources(&self) -> SourceCompletion {
        self.source_phase()
    }
    fn validate(&self, head: Arc<dyn RenderGeneration>) {
        let _activity = self.activity.enter();
        let source = self
            .state
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .take();
        let Some(WorkState::Source { context, prepared }) = source else {
            return;
        };
        *context
            .evidence
            .head
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = Some(HeadEvidence {
            directories: self.runtime.dependency_usage.directories(),
            unmapped: self.runtime.dependency_usage.unmapped_directories(),
            catalogue: head
                .catalogue()
                .dependency_directories
                .iter()
                .cloned()
                .collect(),
        });
        let result = context.services.provider.validate_sources(
            &BaseRequest {
                head: head.as_ref(),
                working_config: &self.config,
                repository: context.selected.repository.clone(),
                commit: context.selected.commit.clone(),
                sources: context.sources.clone(),
                install_scripts: self.install_scripts,
                steps: self.events.clone(),
            },
            *prepared,
        );
        self.events.warnings(preparation_warnings(&result));
        *self.state.lock().unwrap_or_else(|error| error.into_inner()) = Some(WorkState::Ready {
            context,
            prepared: result,
        });
    }
    fn failed(&self, error: Error) {
        *self.state.lock().unwrap_or_else(|error| error.into_inner()) =
            Some(WorkState::Unpinned(error));
    }
    fn reader(&self, cancel: Arc<dyn ChangeCancellation>) {
        self.origin.reader(cancel);
    }
    fn discard(&self) {
        self.release_pending();
    }
}
