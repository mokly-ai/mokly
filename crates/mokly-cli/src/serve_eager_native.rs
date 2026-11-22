//! Serve composes tracked Git, source leases, one pool, and an explicitly owned task.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableWorkers;
use mokly_cli::serial_stylesheets::SerialStylesheets;
use mokly_compare::base_freshness::{Freshness, FreshnessChecks, InstallInputs};
use mokly_compare::base_render::GitSourceFactory;
use mokly_compare::base_retention::BaseRetentionRequest;
use mokly_compare::error::Result;
use mokly_compare::extraction_snapshots::Snapshots;
use mokly_compare::install_inputs::SystemInstallInputs;
use mokly_compare::working_inputs::SystemWorkingInputs;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::tree::Limits;
use mokly_graph::types::RenderGeneration;
use mokly_graph::write_activity::WriteActivity;
use mokly_render::runtime::Runtime;
use mokly_server::changes::{ChangeCancellation, ChangeToken};
use mokly_server::changes_background::PendingChanges;

use crate::base_dependencies::NativeDependencies;
use crate::base_render_admission::ImmediateBaseRenders;
use crate::changes_base::NativeBase;
use crate::serve_base::{BaseSlot, SlotAvailability};
use crate::serve_base_cancel::{BaseLifetime, PreparingBase};
use crate::serve_changes_base::{CombinedCancel, PreparingDependencies};
use crate::serve_eager::{AdoptedPreparation, EagerFactory, PendingBase};
use crate::serve_eager_admission::{EagerAdmission, PreparationAdmission};
use crate::serve_eager_cancel::{OriginCancellation, OriginScope};
use crate::serve_eager_diagnostics::DiagnosticRouting;
use crate::serve_eager_events::{OrderedEvents, PreparationEvents};
use crate::serve_eager_lookup::EagerLookup;
use crate::serve_eager_source_gate::{SourceStarts, SourceWait};
use crate::serve_eager_task::{NativeTasks, PreparationTask, PreparationTasks};
use crate::serve_eager_validation::ProvenValidation;
use crate::serve_eager_work::{NativePreparation, PendingProviders, PendingServices};
use crate::serve_eager_workers::{DeferredWorkers, PendingWorkers};
use crate::serve_git::GitWork;
use crate::serve_pool::PoolScheduling;

pub(super) struct NativeEagerFactory {
    pub(super) source_starts: Arc<dyn SourceStarts>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) sidecars: Arc<dyn PoolScheduling>,
    pub(super) slot: Weak<BaseSlot>,
    pub(super) git: Arc<dyn GitWork>,
    pub(super) command: Arc<dyn Cancellation>,
    pub(super) snapshots: Arc<dyn Snapshots>,
    pub(super) diagnostics: Arc<dyn DiagnosticRouting>,
    pub(super) activity: Arc<dyn WriteActivity>,
    pub(super) base: Option<String>,
    pub(super) install_scripts: Option<bool>,
}

impl EagerFactory for NativeEagerFactory {
    fn start(&self, config: &ResolvedConfig) -> Arc<dyn PendingBase> {
        let phase: Arc<dyn EagerAdmission> = Arc::new(PreparationAdmission::default());
        let origin: Arc<dyn OriginScope> = Arc::new(OriginCancellation::default());
        let lifetime: Arc<dyn BaseLifetime> = Arc::new(PreparingBase::owned(
            Arc::new(CombinedCancel {
                command: self.command.clone(),
                generation: origin.clone(),
                operation: Arc::new(ChangeToken::default()),
            }),
            origin.clone(),
        ));
        let events: Arc<dyn PreparationEvents> = Arc::new(OrderedEvents::default());
        let installs: Arc<dyn InstallInputs> = Arc::new(SystemInstallInputs {
            cancellation: lifetime.clone(),
        });
        let freshness: Arc<dyn Freshness> = Arc::new(FreshnessChecks {
            working: Arc::new(SystemWorkingInputs),
            installs: installs.clone(),
        });
        let work = Arc::new(NativePreparation {
            config: config.clone(),
            base: self.base.clone(),
            install_scripts: self
                .install_scripts
                .or_else(|| {
                    config
                        .input
                        .review
                        .as_ref()
                        .and_then(|review| review.base_install_scripts)
                })
                .unwrap_or(false),
            lookup: Arc::new(EagerLookup {
                repositories: Arc::new(GitRepositories {
                    runner: self.git.runner(lifetime.clone()),
                    disk: Arc::new(SystemDisk),
                }),
            }),
            sources: Arc::new(GitSourceFactory {
                limits: Limits::default(),
                batch_bytes: 48 * 1024 * 1024,
                snapshots: self.snapshots.clone(),
            }),
            providers: Arc::new(NativeProviders {
                source_starts: self.source_starts.clone(),
                runtime: self.runtime.clone(),
                sidecars: self.sidecars.clone(),
                lifetime: lifetime.clone(),
                events: events.clone(),
                freshness: freshness.clone(),
                phase: phase.clone(),
                installs,
            }),
            availability: Arc::new(SlotAvailability {
                slot: self.slot.clone(),
            }),
            working: Arc::new(SystemWorkingInputs),
            freshness,
            origin: origin.clone(),
            lifetime,
            events,
            diagnostics: self.diagnostics.clone(),
            runtime: self.runtime.clone(),
            activity: self.activity.clone(),
            state: Mutex::default(),
            consumed: Mutex::default(),
            accepted: AtomicBool::new(false),
            command: self.command.clone(),
            guard: Mutex::default(),
        });
        let tasks: &dyn PreparationTasks = &NativeTasks;
        let task = tasks.start(work.clone(), origin, phase);
        Arc::new(NativePending {
            config: config.clone(),
            task,
            work,
        })
    }
}

struct NativeProviders {
    source_starts: Arc<dyn SourceStarts>,
    installs: Arc<dyn InstallInputs>,
    runtime: Arc<Runtime>,
    sidecars: Arc<dyn PoolScheduling>,
    lifetime: Arc<dyn BaseLifetime>,
    events: Arc<dyn PreparationEvents>,
    freshness: Arc<dyn Freshness>,
    phase: Arc<dyn EagerAdmission>,
}

impl PendingProviders for NativeProviders {
    fn create(&self) -> PendingServices {
        let validation = ProvenValidation::shared(
            self.phase.clone(),
            self.lifetime.clone(),
            self.installs.clone(),
        );
        let workers: Arc<dyn PendingWorkers> = Arc::new(DeferredWorkers {
            preparation: Arc::new(SerialStylesheets {
                inner: self.runtime.workers.clone(),
            }),
            capture: Mutex::default(),
        });
        let mut runtime = (*self.runtime).clone();
        runtime.workers = Arc::new(CancellableWorkers {
            inner: workers.clone(),
            cancellation: self.lifetime.clone(),
        });
        runtime.pool = self
            .sidecars
            .eager_pool(self.lifetime.clone(), self.phase.clone());
        PendingServices {
            source_admission: SourceWait::shared(self.source_starts.clone(), self.lifetime.clone()),
            workers,
            validation: validation.clone(),
            provider: Arc::new(NativeBase {
                validation: Some(validation.clone()),
                admission: Arc::new(ImmediateBaseRenders),
                runtime: Arc::new(runtime),
                cancellation: self.lifetime.clone(),
                freshness: Some(self.freshness.clone()),
                dependencies: Arc::new(PreparingDependencies {
                    progress: self.events.clone(),
                    inner: Arc::new(NativeDependencies {
                        cancellation: self.lifetime.clone(),
                        reporter: self.events.clone(),
                        routing: None,
                    }),
                }),
            }),
        }
    }
}

struct NativePending {
    config: ResolvedConfig,
    task: Arc<dyn PreparationTask>,
    work: Arc<NativePreparation>,
}

impl PendingChanges for NativePending {
    fn dispatched(&self) {
        self.task.dispatched();
    }
    fn cancel_and_join(&self) {
        self.task.cancel_and_join();
    }
}

impl PendingBase for NativePending {
    fn config(&self) -> &ResolvedConfig {
        &self.config
    }
    fn head(&self, head: Arc<dyn RenderGeneration>) {
        self.task.head(head);
    }
    fn adopt(
        &self,
        request: &BaseRetentionRequest<'_>,
        cancel: Arc<dyn ChangeCancellation>,
        operation: Arc<dyn ChangeCancellation>,
    ) -> Result<Option<AdoptedPreparation>> {
        if request.working_config != &self.config {
            self.task.cancel_and_join();
            return Ok(None);
        }
        self.task.sources_ready(cancel.clone());
        if !self.task.ended() && !self.work.current(request)? {
            self.task.cancel();
            let joined = self.task.join();
            self.work.release_pending();
            joined?;
            return Ok(None);
        }
        self.work.origin.operation(operation);
        self.task.continue_for_classification(cancel);
        self.task.join()?;
        self.work.take_prepared(request)
    }
    fn settled(&self, accepted: bool) {
        self.work.accepted.store(accepted, Ordering::Release);
        if accepted {
            let _ = self.task.join();
            self.work.release_pending();
        } else {
            self.task.cancel_and_join();
        }
    }
}

#[cfg(test)]
#[path = "_tests_/eager_evidence_tests.rs"]
mod eager_evidence_tests;
