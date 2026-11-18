//! Ordinary Changes and cold-start preparation share the historical service graph.

use std::sync::{Arc, Mutex};

use mokly_catalogue::diagnostic::Warning;
use mokly_compare::base_freshness::{Freshness, FreshnessChecks};
use mokly_compare::base_render::{BaseProvider, Changes, GitSourceFactory};
use mokly_compare::base_selection::GitBaseLookup;
use mokly_compare::comparison_steps::{Step, Steps};
use mokly_compare::comparison_types::Comparison;
use mokly_compare::install_inputs::SystemInstallInputs;
use mokly_compare::working_inputs::SystemWorkingInputs;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::tree::Limits;
use mokly_server::changes::{ChangeCancellation, ChangeProgress};
use mokly_server::usage_completion::UsageCompletion;

use crate::base_dependencies::{BaseDependencies, NativeDependencies};
use crate::changes_base::NativeBase;
use crate::serve_base::ServeBase;
use crate::serve_base_cancel::{BaseLifetime, PreparingBase};
use crate::serve_base_preparation::Preparation;
use crate::serve_changes::Source;
use crate::serve_changes_base::{
    AttemptBase, CacheNotice, CombinedCancel, EarlyBase, PreparationNotice, PreparingDependencies,
    RunSteps,
};
use crate::serve_early_pool::PreparingPool;
use crate::serve_preparation_control::PreparationControl;

/// Attempt-local services retain the existing cancellation and lease policy.
pub(super) struct BaseAttempt {
    pub(super) changes: Changes,
    pub(super) cancellation: Arc<CombinedCancel>,
    pub(super) lifetime: Arc<dyn BaseLifetime>,
    _early: EarlyCleanup,
}

struct EarlyCleanup(Option<Arc<dyn PreparingPool>>);
impl Drop for EarlyCleanup {
    fn drop(&mut self) {
        if let Some(pool) = &self.0 {
            pool.finish();
        }
    }
}

struct QuietSteps;
impl Steps for QuietSteps {
    fn step(&self, _step: Step) {}
}

impl Source {
    /// Compose a base attempt without starting a terminal phase or staging a comparison.
    pub(super) fn base_changes(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
        progress: Option<Arc<dyn ChangeProgress>>,
        usage: Option<Arc<dyn UsageCompletion>>,
        warnings: Arc<Mutex<Vec<Warning>>>,
        reporter: Arc<dyn PreparationNotice>,
        comparison: Arc<dyn Comparison>,
    ) -> BaseAttempt {
        let cancellation = Arc::new(CombinedCancel {
            operation: self.operation.clone(),
            command: self.services.cancellation.clone(),
            generation: cancel.clone(),
        });
        let lifetime: Arc<dyn BaseLifetime> = Arc::new(PreparingBase::new(cancellation.clone()));
        let early = usage.as_ref().map(|usage| {
            self.services
                .sidecars
                .preparing(lifetime.clone(), usage.clone())
        });
        let runtime = self.classification_runtime(lifetime.clone());
        let runtime = match &early {
            Some(early) => {
                let mut runtime = (*runtime).clone();
                runtime.pool = early.clone();
                Arc::new(runtime)
            }
            None => runtime,
        };
        let preparation: Option<Arc<dyn PreparationControl>> =
            usage.zip(early.clone()).map(|(usage, pool)| {
                let preparation: Arc<dyn PreparationControl> = Arc::new(Preparation::new(
                    usage,
                    cancel.clone(),
                    pool,
                    self.services.runtime.dependency_usage.clone(),
                ));
                preparation
            });
        let freshness: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
            working: Arc::new(SystemWorkingInputs),
            installs: Arc::new(SystemInstallInputs {
                cancellation: cancellation.clone(),
            }),
        });
        let dependencies: Arc<dyn BaseDependencies> = Arc::new(NativeDependencies {
            cancellation: lifetime.clone(),
            reporter: reporter.clone(),
        });
        let dependencies: Arc<dyn BaseDependencies> = match &progress {
            Some(progress) => Arc::new(PreparingDependencies {
                inner: dependencies,
                progress: progress.clone(),
            }),
            None => dependencies,
        };
        let inner: Arc<dyn BaseProvider> = Arc::new(NativeBase {
            preparation: preparation.clone(),
            runtime: runtime.clone(),
            cancellation: lifetime.clone(),
            freshness: Some(freshness.clone()),
            dependencies,
        });
        let inner: Arc<dyn BaseProvider> = match &progress {
            Some(progress) => Arc::new(AttemptBase {
                warnings,
                inner,
                progress: progress.clone(),
            }),
            None => Arc::new(EarlyBase {
                warnings,
                inner,
                notice: reporter,
            }),
        };
        let steps: Arc<dyn Steps> = match progress {
            Some(_) => Arc::new(RunSteps {
                progress: self.services.progress.clone(),
                cancel: cancel.clone(),
            }),
            None => Arc::new(QuietSteps),
        };
        BaseAttempt {
            changes: Changes {
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
                    preparation,
                    slot: Arc::downgrade(&self.services.kept_base),
                    runtime,
                    freshness,
                    reader: cancellation.clone(),
                    origin: cancel,
                    lifetime: lifetime.clone(),
                    inner,
                }),
                comparison,
                steps,
            },
            cancellation,
            lifetime,
            _early: EarlyCleanup(early),
        }
    }

    /// Ordinary output uses the active warning and classification fences.
    pub(super) fn cache_notice(
        &self,
        cancel: Arc<dyn ChangeCancellation>,
    ) -> Arc<dyn PreparationNotice> {
        Arc::new(CacheNotice {
            announced: self.services.cache_announced.clone(),
            warnings: self.warnings.clone(),
            terminal: self.services.terminal.clone(),
            style: self.services.style.clone(),
            redactor: self.services.redactor.clone(),
            cancel,
        })
    }
}
