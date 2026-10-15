//! Historical definitions and graph preparation share the working runtime's services.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::discovery::{Discoverer, Discovery, Inventory, SourceKind};
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::version::VERSION;
use mokly_compare::base_render::{BaseProvider, BaseRequest};
use mokly_compare::error::{Error, Result};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTree;

use crate::base_dependencies::BaseDependencies;

pub(super) struct NativeBase {
    pub(super) runtime: Arc<Runtime>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) dependencies: Arc<dyn BaseDependencies>,
}

impl BaseProvider for NativeBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> Result<Arc<dyn RenderGeneration>> {
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: request.sources.tree.clone(),
            cancellation: self.cancellation.clone(),
        });
        let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
        let file = request.working_config.file.to_string_lossy();
        let config = if matches!(tree.project(&request.working_config.file), Ok(None)) {
            ResolvedConfig {
                input: Config::default(),
                roots: Vec::new(),
                authored_inputs: Vec::new(),
                ..request.working_config.clone()
            }
        } else {
            match loader.load(&request.working_config.repo_root, Some(&file)) {
                Ok(config) => config,
                Err(source) => return Err(Error::Catalogue { source }),
            }
        };
        let discovery: &dyn Discovery = &Discoverer { tree: tree.clone() };
        let inventory = match discovery.discover(&config, None) {
            Ok(inventory) => inventory,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        let needs_sidecar = config.input.postcss.is_some()
            || config.input.renderer.is_some()
            || inventory.files.iter().any(|file| {
                !file.excluded && matches!(file.kind, SourceKind::Module | SourceKind::Stories)
            });
        let base = if needs_sidecar {
            Some(self.dependencies.prepare(request, &config)?)
        } else {
            None
        };
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let runtime = Arc::new(Runtime::new(
            tree.clone(),
            self.runtime.dependency_tree.clone(),
            self.runtime.pool.clone(),
            self.runtime.cache.clone(),
            self.runtime.workers.clone(),
            VERSION.into(),
            base,
        ));
        let builder: &dyn CatalogueBuilder = &Builder {
            tree,
            discovery: Arc::new(Discovered(inventory)),
            definitions: runtime.clone(),
        };
        let catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let factory: &dyn GraphFactory = runtime.as_ref();
        let graph = match factory.create(&config) {
            Ok(graph) => graph,
            Err(source) => return Err(Error::Graph { source }),
        };
        match graph.prepare(config, catalogue, None) {
            Ok(generation) => Ok(generation),
            Err(source) => Err(Error::Graph { source }),
        }
    }
}

struct Discovered(Inventory);
impl Discovery for Discovered {
    fn discover(
        &self,
        _config: &ResolvedConfig,
        _output: Option<&Path>,
    ) -> mokly_catalogue::error::Result<Inventory> {
        Ok(self.0.clone())
    }
}
