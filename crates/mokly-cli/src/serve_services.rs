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
use mokly_cli::serve::{CatalogueServe, ServePreparation};
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

use crate::render_runtime::Services;

pub(super) struct ServeServices {
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
            crate::render_runtime::diagnostics(redactor),
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
        let preparation = Arc::new(CatalogueServe {
            config: loader,
            catalogue: Arc::new(Builder {
                tree: tree.clone(),
                discovery: Arc::new(Discoverer { tree: tree.clone() }),
                definitions: services.runtime.clone(),
            }),
            graphs: services.runtime,
        });
        Ok(Self {
            tree,
            preparation,
            pool: services.pool,
        })
    }
}
