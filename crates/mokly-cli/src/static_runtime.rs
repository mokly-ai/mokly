//! Native composition root for the shared build and publish output pipeline.

use std::env;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{SecondsFormat, Utc};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildError, BuildService, CatalogueBuild};
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::grammar::Build;
use mokly_cli::pre_installation;
use mokly_cli::static_admission::{Admission, OutputAdmission};
use mokly_cli::static_build::{self, Drain, Phases, Request, StaticBuild, Timestamp};
use mokly_model::output::artifact::Artifact;
use mokly_model::output::upload::Publication;
use mokly_platform::rename::{Rename, SystemRename};
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;
use mokly_static::assembly::CatalogueAssembler;
use mokly_static::filesystem::{Files, SystemFiles};
use mokly_static::fingerprint::{CapturedTree, SourceFingerprints};
use mokly_static::transaction::{OutputTransactions, Transaction, Transactions};

#[cfg(debug_assertions)]
use crate::test_faults;
use crate::{static_setup, viewer_assets};

pub(super) struct Context {
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    pub(super) phases: Arc<dyn Phases>,
}

pub(super) struct PublicationInput {
    pub(super) identity: Publication,
    pub(super) repository: PathBuf,
    pub(super) warnings_are_fatal: bool,
}

pub(super) fn run(
    cwd: &Path,
    options: &Build,
    context: &Context,
    publication: Option<PublicationInput>,
) -> Result<(Artifact, PathBuf), BuildError> {
    context.phases.start(static_build::Phase::Configuration);
    let source: Arc<dyn SourceTree> = Arc::new(WorkingTree);
    #[cfg(debug_assertions)]
    let source = test_faults::tree(source);
    let live: Arc<dyn SourceTree> = Arc::new(CancellableTree {
        inner: source,
        cancellation: context.cancellation.clone(),
    });
    let captured = Arc::new(CapturedTree::new(live));
    let tree: Arc<dyn SourceTree> = captured.clone();
    let files: Arc<dyn Files> = Arc::new(SystemFiles);
    let rename: Arc<dyn Rename> = Arc::new(SystemRename);
    #[cfg(debug_assertions)]
    let (files, rename) = (test_faults::files(files), test_faults::rename(rename));
    let transactions: Arc<dyn Transactions> = Arc::new(OutputTransactions { files, rename });
    #[cfg(debug_assertions)]
    let transactions = test_faults::transactions(transactions);
    let runtime_roots = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_owned))
        .into_iter()
        .chain(env::var_os("MOKLY_PACKAGE_ROOT").map(PathBuf::from))
        .chain(viewer_assets::dist())
        .collect();
    let admission: &dyn Admission = &OutputAdmission {
        config: Arc::new(Loader { tree: tree.clone() }),
        transactions,
        cancellation: context.cancellation.clone(),
        runtime_roots,
    };
    let admitted = admission.open(cwd, options, publication.is_some())?;
    let config = admitted.config;
    let mut transaction = admitted.transaction;
    let result = prepare(
        cwd,
        options,
        context,
        &config,
        captured,
        publication,
        transaction.as_mut(),
    );
    result.map(|artifact| (artifact, config.repo_root))
}

fn prepare(
    cwd: &Path,
    options: &Build,
    context: &Context,
    config: &ResolvedConfig,
    captured: Arc<CapturedTree>,
    publication: Option<PublicationInput>,
    transaction: &mut dyn Transaction,
) -> Result<Artifact, BuildError> {
    let tree: Arc<dyn SourceTree> = captured.clone();
    let setup = pre_installation::settle(
        static_setup::setup(cwd, options, context, config, tree.clone()),
        context.cancellation.as_ref(),
    );
    let (services, viewer) = match setup {
        Ok(value) => value,
        Err(primary) => {
            return match transaction.abandon() {
                Ok(()) => Err(primary),
                Err(cleanup) => Err(BuildError::Cleanup {
                    primary: Box::new(primary),
                    cleanup: Box::new(cleanup),
                    path: transaction.recovery_path().into(),
                }),
            };
        }
    };
    *context
        .pool
        .lock()
        .unwrap_or_else(|error| error.into_inner()) = Some(services.pool.clone());
    let drain: Arc<dyn Drain> = Arc::new(PoolDrain {
        pool: services.pool,
        stopped: Mutex::new(false),
    });
    let render: Arc<dyn BuildService> = Arc::new(CatalogueBuild {
        inputs: Some(captured.clone()),
        cancellation: context.cancellation.clone(),
        graphs: services.runtime.clone(),
        config: Arc::new(LoadedConfig(config.clone())),
        catalogue: Arc::new(Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree: tree.clone() }),
            definitions: services.runtime,
        }),
    });
    #[cfg(debug_assertions)]
    let render = test_faults::render(render);
    let files = Arc::new(SystemFiles);
    let service: &dyn StaticBuild = &static_build::Builder {
        render,
        assembler: Arc::new(CatalogueAssembler { tree }),
        fingerprints: Arc::new(SourceFingerprints { files }),
        inputs: captured,
        cancellation: context.cancellation.clone(),
        drain: drain.clone(),
        phases: context.phases.clone(),
        timestamp: Arc::new(SystemTimestamp),
    };
    let repository = publication
        .as_ref()
        .map_or(&config.repo_root, |input| &input.repository);
    let metadata = publication.as_ref().map(|input| input.identity.clone());
    service
        .build(
            Request {
                cwd,
                config,
                options,
                viewer,
                repository,
                publication: metadata,
                warnings_are_fatal: publication
                    .as_ref()
                    .is_some_and(|input| input.warnings_are_fatal),
            },
            transaction,
        )
        .map(|(artifact, _)| artifact)
}

struct LoadedConfig(ResolvedConfig);
impl ConfigLoader for LoadedConfig {
    fn load(&self, _: &Path, _: Option<&str>) -> mokly_catalogue::error::Result<ResolvedConfig> {
        Ok(self.0.clone())
    }
}
struct PoolDrain {
    pool: Arc<dyn SidecarPool>,
    stopped: Mutex<bool>,
}
impl Drain for PoolDrain {
    fn stop(&self) -> Result<(), BuildError> {
        let mut stopped = self
            .stopped
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if *stopped {
            return Ok(());
        }
        *stopped = true;
        match self.pool.shutdown() {
            Ok(()) => Ok(()),
            Err(source) => Err(BuildError::Rendering {
                source: Box::new(mokly_graph::error::GraphError::Internal(
                    mokly_graph::error::InternalError::Provider {
                        source: Box::new(source),
                    },
                )),
                warnings: Vec::new(),
            }),
        }
    }
}
struct SystemTimestamp;
impl Timestamp for SystemTimestamp {
    fn now(&self) -> String {
        Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
    }
}
