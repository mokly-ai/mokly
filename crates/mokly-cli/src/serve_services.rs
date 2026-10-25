//! Serve shares one JavaScript pool and cache across preparation and live views.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::Builder;
use mokly_catalogue::working_tree::WorkingTree;
use mokly_cli::build::BuildError;
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::grammar::Common;
use mokly_cli::serve::{CatalogueServe, PreparedServe, ServePreparation};
use mokly_cli::serve_settings::ServeSettings;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::SidecarPool;
use mokly_sidecar::workers::Diagnostics;
use mokly_source_interface::tree::SourceTree;

use crate::render_runtime::Services;
use crate::serve_pool::{PoolScheduling, ServePool};
use mokly_cli::options;

pub(super) struct ServeServices {
    pub(super) sidecars: Arc<dyn PoolScheduling>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) config: mokly_catalogue::config_types::ResolvedConfig,
    pub(super) tree: Arc<dyn SourceTree>,
    pub(super) preparation: Arc<dyn ServePreparation>,
    pub(super) pool: Arc<dyn SidecarPool>,
}

impl ServeServices {
    pub(super) fn new(
        cwd: &Path,
        common: &Common,
        diagnostics: Arc<dyn Diagnostics>,
        cancellation: Arc<dyn Cancellation>,
    ) -> Result<Self, BuildError> {
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: Arc::new(WorkingTree),
            cancellation: cancellation.clone(),
        });
        let loader = Arc::new(Loader { tree: tree.clone() });
        let mut config = match loader.load(cwd, common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        options::apply_base_install_scripts(&mut config, common.base_install_scripts_override());
        let services = match Services::new(
            tree.clone(),
            cwd,
            &config.repo_root,
            common,
            diagnostics,
            cancellation,
        ) {
            Ok(services) => services,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: Vec::new(),
                });
            }
        };
        let sidecars: Arc<dyn PoolScheduling> =
            Arc::new(ServePool::new(services.pool, common.sidecars.unwrap_or(1)));
        let pool = sidecars.pool(None);
        let mut runtime = (*services.runtime).clone();
        runtime.pool = pool.clone();
        let runtime = Arc::new(runtime);
        let preparation = Arc::new(AttemptPreparation {
            tree: tree.clone(),
            runtime: runtime.clone(),
            settings: ServeSettings::new(&config),
        });
        Ok(Self {
            sidecars,
            runtime,
            config,
            tree,
            preparation,
            pool,
        })
    }
}

struct AttemptPreparation {
    settings: ServeSettings,
    tree: Arc<dyn SourceTree>,
    runtime: Arc<Runtime>,
}
impl ServePreparation for AttemptPreparation {
    fn prepare(&self, cwd: &Path, options: &Common) -> Result<PreparedServe, BuildError> {
        let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(self.tree.clone()));
        let loader = Loader { tree: tree.clone() };
        let mut config = match loader.load(cwd, options.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        options::apply_base_install_scripts(&mut config, options.base_install_scripts_override());
        self.settings.validate(&config)?;
        let runtime = Arc::new(self.runtime.with_tree(tree.clone()));
        let preparation: &dyn ServePreparation = &CatalogueServe {
            config: Arc::new(PreparedConfig(config)),
            catalogue: Arc::new(Builder {
                tree: tree.clone(),
                discovery: Arc::new(Discoverer { tree }),
                definitions: runtime.clone(),
            }),
            graphs: runtime,
        };
        preparation.prepare(cwd, options)
    }
}

struct PreparedConfig(mokly_catalogue::config_types::ResolvedConfig);
impl ConfigLoader for PreparedConfig {
    fn load(
        &self,
        _cwd: &Path,
        _config: Option<&str>,
    ) -> mokly_catalogue::error::Result<mokly_catalogue::config_types::ResolvedConfig> {
        Ok(self.0.clone())
    }
}
