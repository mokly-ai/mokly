//! Native composition root for the shared build and publish output pipeline.

use chrono::{SecondsFormat, Utc};
use std::env;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::{BuildError, BuildService, CatalogueBuild};
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::grammar::Build;
use mokly_cli::static_build::{self, Drain, Phases, Request, StaticBuild, Timestamp};
use mokly_git::control;
use mokly_git::disk::SystemDisk;
use mokly_git::repository::{GitRepositories, Repositories};
use mokly_git::system::SystemRunner;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::upload::Publication;
use mokly_platform::processes::SystemProcessGroups;
use mokly_platform::rename::SystemRename;
use mokly_server::assets::{PackageAssets, ViewerAssets};
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;
use mokly_static::assembly::CatalogueAssembler;
use mokly_static::filesystem::SystemFiles;
use mokly_static::fingerprint::{CapturedTree, SourceFingerprints};
use mokly_static::transaction::{self, OutputTransactions};

use crate::render_runtime::Services;
use crate::viewer_assets;

pub(super) struct Context {
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) pool: Arc<Mutex<Option<Arc<dyn SidecarPool>>>>,
    pub(super) phases: Arc<dyn Phases>,
}

pub(super) struct PublicationInput {
    pub(super) identity: Publication,
    pub(super) repository: PathBuf,
}

pub(super) fn run(
    cwd: &Path,
    options: &Build,
    context: &Context,
    publication: Option<PublicationInput>,
) -> Result<(Artifact, PathBuf), BuildError> {
    context.phases.start(static_build::Phase::Configuration);
    let live: Arc<dyn SourceTree> = Arc::new(CancellableTree {
        inner: Arc::new(WorkingTree),
        cancellation: context.cancellation.clone(),
    });
    let captured = Arc::new(CapturedTree::new(live));
    let tree: Arc<dyn SourceTree> = captured.clone();
    let config = match (Loader { tree: tree.clone() }).load(cwd, options.common.config.as_deref()) {
        Ok(config) => config,
        Err(source) => return Err(BuildError::Catalogue { source }),
    };
    if !options.no_changes {
        let base = options
            .common
            .base
            .clone()
            .or_else(|| {
                config
                    .input
                    .review
                    .as_ref()
                    .and_then(|review| review.base.clone())
            })
            .unwrap_or_else(|| "origin/main".into());
        context
            .phases
            .start(static_build::Phase::Comparing(base.clone()));
        let repositories: &dyn Repositories = &GitRepositories {
            runner: Arc::new(SystemRunner {
                clock: Arc::new(control::SystemClock::default()),
                cancellation: Arc::new(Cancel(context.cancellation.clone())),
                groups: Arc::new(SystemProcessGroups),
            }),
            disk: Arc::new(SystemDisk),
        };
        if let Err(source) = repositories
            .open(&config.repo_root)
            .and_then(|repository| repository.merge_base(&base))
        {
            return Err(BuildError::Git { base, source });
        }
    }
    let assets: &dyn ViewerAssets = &PackageAssets {
        tree: Arc::new(WorkingTree),
    };
    let dist = viewer_assets::dist().ok_or(BuildError::Viewer)?;
    let viewer = match assets.load(&dist) {
        Ok(files) => files
            .into_iter()
            .map(|(path, file)| File {
                path,
                bytes: file.bytes,
            })
            .collect(),
        Err(_) => return Err(BuildError::Viewer),
    };
    let services = match Services::new(
        tree.clone(),
        cwd,
        &config.repo_root,
        &options.common,
        Arc::new(RenderDiagnostics(context.phases.clone())),
        context.cancellation.clone(),
    ) {
        Ok(services) => services,
        Err(source) => {
            return Err(BuildError::Rendering {
                source: Box::new(source),
                warnings: Vec::new(),
            });
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
    let files = Arc::new(SystemFiles);
    let service: &dyn StaticBuild = &static_build::Builder {
        render,
        transactions: Arc::new(OutputTransactions {
            files: files.clone(),
            rename: Arc::new(SystemRename),
        }),
        assembler: Arc::new(CatalogueAssembler { tree }),
        fingerprints: Arc::new(SourceFingerprints { files }),
        inputs: captured,
        cancellation: Arc::new(Cancel(context.cancellation.clone())),
        drain: drain.clone(),
        phases: context.phases.clone(),
        timestamp: Arc::new(SystemTimestamp),
    };
    let directory = mokly_static::location::output(&config, options.out.as_deref());
    let allowed = publication
        .as_ref()
        .and_then(|_| directory.parent())
        .unwrap_or(&config.repo_root);
    let repository = publication
        .as_ref()
        .map_or(&config.repo_root, |input| &input.repository);
    let metadata = publication.as_ref().map(|input| input.identity.clone());
    let result = service.build(Request {
        cwd,
        config: &config,
        options,
        viewer,
        allowed,
        repository,
        publication: metadata,
        runtime_directories: std::iter::once(dist)
            .chain(
                env::current_exe()
                    .ok()
                    .and_then(|path| path.parent().map(Path::to_owned)),
            )
            .chain(env::var_os("MOKLY_PACKAGE_ROOT").map(PathBuf::from))
            .collect(),
    });
    let stopped = drain.stop();
    match result {
        Ok((artifact, _)) => {
            stopped?;
            Ok((artifact, config.repo_root))
        }
        Err(error) => Err(error),
    }
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
struct Cancel(Arc<dyn Cancellation>);
impl transaction::Cancellation for Cancel {
    fn requested(&self) -> bool {
        self.0.requested()
    }
}
impl control::Cancellation for Cancel {
    fn cancelled(&self) -> bool {
        self.0.requested()
    }
}

struct SystemTimestamp;
impl Timestamp for SystemTimestamp {
    fn now(&self) -> String {
        Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
    }
}

struct RenderDiagnostics(Arc<dyn Phases>);
impl mokly_sidecar::workers::Diagnostics for RenderDiagnostics {
    fn emit(&self, message: &str) {
        self.0.diagnostic(message);
    }
}
