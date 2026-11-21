//! Classification keeps normal admission, capture, retention, and publication after usage.

use std::sync::{Arc, Mutex};

use mokly_compare::base_freshness::{Freshness, FreshnessChecks};
use mokly_compare::base_render::{Changes, ChangesService, GitSourceFactory};
use mokly_compare::base_selection::GitBaseLookup;
use mokly_compare::cache_types::Reporter;
use mokly_compare::comparison_steps::Steps;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::install_inputs::SystemInstallInputs;
use mokly_compare::working_inputs::SystemWorkingInputs;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::tree::Limits;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::error::{Result, ServerError};

use crate::base_dependencies::NativeDependencies;
use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;
use crate::serve_base::ServeBase;
use crate::serve_base_cancel::{BaseLifetime, PreparingBase};
use crate::serve_changes::Source;
use crate::serve_changes_base::{
    AttemptBase, CacheNotice, CombinedCancel, PreparingDependencies, RunSteps,
};
use crate::serve_eager_base::AdoptingBase;
use crate::serve_eager_lifetime::{LifetimeSelection, SelectedLifetime};
use crate::serve_eager_reporting::CurrentPreparation;

impl Source {
    pub(super) fn classify_native(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Arc<dyn ChangeProgress>,
    ) -> Result<ComparisonResult> {
        let comparison = self.comparison_attempt();
        self.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .clear();
        let cancellation = Arc::new(CombinedCancel {
            operation: self.operation.clone(),
            command: self.services.cancellation.clone(),
            generation: cancel.clone(),
        });
        let serial: Arc<dyn BaseLifetime> = Arc::new(PreparingBase::new(cancellation.clone()));
        let selection: Arc<dyn LifetimeSelection> =
            Arc::new(SelectedLifetime(Mutex::new(serial.clone())));
        let lifetime: Arc<dyn BaseLifetime> = selection.clone();
        let runtime = match self.classification_runtime(lifetime.clone()) {
            Ok(runtime) => runtime,
            Err(source) => return Err(ServerError::Render { source }),
        };
        let freshness: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
            working: Arc::new(SystemWorkingInputs),
            installs: Arc::new(SystemInstallInputs {
                cancellation: cancellation.clone(),
            }),
        });
        let reporter: Arc<dyn Reporter> = Arc::new(CacheNotice {
            announced: self.services.cache_announced.clone(),
            warnings: self.warnings.clone(),
            terminal: self.services.terminal.clone(),
            style: self.services.style.clone(),
            redactor: self.services.redactor.clone(),
            cancel: cancel.clone(),
        });
        let steps: Arc<dyn Steps> = Arc::new(RunSteps {
            progress: self.services.progress.clone(),
            cancel: cancel.clone(),
        });
        let inner = Arc::new(NativeBase {
            validation: None,
            admission: Arc::new(ImmediateBaseRenders),
            runtime: runtime.clone(),
            cancellation: lifetime.clone(),
            freshness: Some(freshness.clone()),
            dependencies: Arc::new(PreparingDependencies {
                progress: progress.clone(),
                inner: Arc::new(NativeDependencies {
                    cancellation: lifetime.clone(),
                    reporter: reporter.clone(),
                    routing: self.services.routing.clone(),
                }),
            }),
        });
        let changes: &dyn ChangesService = &Changes {
            lookup: Arc::new(GitBaseLookup {
                repositories: Arc::new(GitRepositories {
                    runner: self.services.git.runner(lifetime.clone()),
                    disk: Arc::new(SystemDisk),
                }),
            }),
            pinned: None,
            sources: Arc::new(GitSourceFactory {
                limits: Limits::default(),
                batch_bytes: 48 * 1024 * 1024,
                snapshots: self.services.extraction_snapshots.clone(),
            }),
            provider: Arc::new(ServeBase {
                slot: Arc::downgrade(&self.services.kept_base),
                runtime: runtime.clone(),
                freshness,
                reader: cancellation,
                origin: cancel.clone(),
                lifetime,
                inner: Arc::new(AttemptBase {
                    warnings: self.pending.clone(),
                    progress: progress.clone(),
                    inner: Arc::new(AdoptingBase {
                        pending: self.preparation.clone(),
                        inner,
                        lifetime: selection,
                        serial,
                        cancel: cancel.clone(),
                        operation: self.operation.clone(),
                        workers: runtime.workers.clone(),
                        ready: Mutex::default(),
                        sink: Arc::new(CurrentPreparation {
                            steps: steps.clone(),
                            progress,
                            cache: reporter,
                            warnings: self.pending.clone(),
                            diagnostics: self.services.diagnostics.clone(),
                            attempt: self.warnings.clone(),
                            cancel: cancel.clone(),
                        }),
                    }),
                }),
            }),
            comparison,
            steps,
        };
        match changes.classify(
            &self.config,
            self.services.base.as_deref(),
            self.head.clone(),
            self.services.install_scripts,
        ) {
            Ok(result) if !cancel.cancelled() => Ok(result),
            Ok(_) => Err(ServerError::ChangesReplaced),
            Err(source) => Err(ServerError::Comparison {
                source: Box::new(source),
            }),
        }
    }
}
