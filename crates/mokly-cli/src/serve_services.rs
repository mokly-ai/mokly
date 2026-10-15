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
use mokly_cli::redaction::Redactor;
use mokly_cli::serve::{CatalogueServe, PreparedServe, ServePreparation};
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_render::runtime::Runtime;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

use crate::render_runtime::Services;

pub(super) struct ServeServices {
    pub(super) config: mokly_catalogue::config_types::ResolvedConfig,
    pub(super) tree: Arc<dyn SourceTree>,
    pub(super) preparation: Arc<dyn ServePreparation>,
    pub(super) pool: Arc<dyn SidecarPool>,
}

impl ServeServices {
    pub(super) fn new(
        cwd: &Path,
        common: &Common,
        redactor: Arc<Redactor>,
        cancellation: Arc<dyn Cancellation>,
    ) -> Result<Self, BuildError> {
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: Arc::new(WorkingTree),
            cancellation: cancellation.clone(),
        });
        let loader = Arc::new(Loader { tree: tree.clone() });
        let config = match loader.load(cwd, common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        let services = match Services::new(
            tree.clone(),
            cwd,
            &config.repo_root,
            common,
            redactor,
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
        let preparation = Arc::new(AttemptPreparation {
            tree: tree.clone(),
            runtime: services.runtime,
        });
        Ok(Self {
            config,
            tree,
            preparation,
            pool: services.pool,
        })
    }
}

struct AttemptPreparation {
    tree: Arc<dyn SourceTree>,
    runtime: Arc<Runtime>,
}
impl ServePreparation for AttemptPreparation {
    fn prepare(&self, cwd: &Path, options: &Common) -> Result<PreparedServe, BuildError> {
        let tree: Arc<dyn SourceTree> = Arc::new(SourceSnapshot::new(self.tree.clone()));
        let runtime = Arc::new(self.runtime.with_tree(tree.clone()));
        let preparation: &dyn ServePreparation = &CatalogueServe {
            config: Arc::new(Loader { tree: tree.clone() }),
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
