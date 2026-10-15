//! Native comparison composition shares the head cache and the base render graph.

use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader};
use mokly_catalogue::definition_provider::DeferredDefinitions;
use mokly_catalogue::discovery::Discoverer;
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_compare::base_render::{
    BaseProvider, BaseRequest, Changes, ChangesService, GitSourceFactory,
};
use mokly_compare::comparison::Engine;
use mokly_compare::error::{Error, Result};
use mokly_compare::moves::Detector;
use mokly_css::parsed_cache::MemoryParsedCss;
use mokly_git::control::{SystemClock, Token};
use mokly_git::disk::SystemDisk;
use mokly_git::repository::GitRepositories;
use mokly_git::system::SystemRunner;
use mokly_git::tree::Limits;
use mokly_graph::cache::RenderCache;
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_platform::processes::SystemProcessGroups;

use crate::render_runtime::NativeGraphs;

/// Construct the native host boundaries at the binary composition root.
pub(super) fn service(cache: Arc<dyn RenderCache>) -> Arc<dyn ChangesService> {
    Arc::new(Changes {
        repositories: Arc::new(GitRepositories {
            runner: Arc::new(SystemRunner {
                clock: Arc::new(SystemClock::default()),
                cancellation: Arc::new(Token::default()),
                groups: Arc::new(SystemProcessGroups),
            }),
            disk: Arc::new(SystemDisk),
        }),
        sources: Arc::new(GitSourceFactory {
            limits: Limits::default(),
            batch_bytes: 48 * 1024 * 1024,
        }),
        provider: Arc::new(NativeBase { cache }),
        comparison: Arc::new(Engine {
            moves: Arc::new(Detector),
            css: Arc::new(MemoryParsedCss::new(64 * 1024 * 1024)),
        }),
    })
}

struct NativeBase {
    cache: Arc<dyn RenderCache>,
}

impl BaseProvider for NativeBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> Result<Arc<dyn RenderGeneration>> {
        let tree = request.sources.tree.clone();
        let loader: &dyn ConfigLoader = &Loader { tree: tree.clone() };
        let file = request.working_config.file.to_string_lossy();
        let config = match loader.load(&request.working_config.repo_root, Some(&file)) {
            Ok(config) => config,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        let builder: &dyn CatalogueBuilder = &Builder {
            tree: tree.clone(),
            discovery: Arc::new(Discoverer { tree: tree.clone() }),
            definitions: Arc::new(DeferredDefinitions),
        };
        let catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        if !catalogue.deferred_modules.is_empty() {
            return Err(Error::Deferred {
                modules: catalogue.deferred_modules,
            });
        }
        let factory: &dyn GraphFactory = &NativeGraphs {
            tree,
            cache: self.cache.clone(),
        };
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
