//! Shared runtime dependencies injected by the executable composition root.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use mokly_catalogue::config::normalize;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::definition_provider::{DefinitionProvider, Definitions};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::error::{CatalogueError, InternalError};
use mokly_compare::ancestor_roots;
use mokly_graph::cache::RenderCache;
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{GraphFactory, RenderGraph};
use mokly_graph::workers::RenderWorkers;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

use crate::bundle::BundleState;
use crate::dependency_usage::{DependencyUsage, UsedDependencies};
use crate::error::Result;
use crate::graph::JavaScriptGraph;
use crate::postcss_cache::CssCache;
use crate::side::{BaseSide, SideInputs};
use crate::{definitions, side};

static CONTEXT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Definition and graph factories share one sidecar pool and one fragment cache.
#[derive(Clone)]
pub struct Runtime {
    /// Working or historical source reader.
    pub tree: Arc<dyn SourceTree>,
    pub(crate) inventory_tree: Arc<dyn SourceTree>,
    /// Physical reader for the selected installed third-party dependencies.
    pub dependency_tree: Arc<dyn SourceTree>,
    /// Lazily started Node processes.
    pub pool: Arc<dyn SidecarPool>,
    /// Shared byte-bounded render cache.
    pub cache: Arc<dyn RenderCache>,
    /// Worker scheduler supplied by the composition root.
    pub workers: Arc<dyn RenderWorkers>,
    /// Current Mokly package version.
    pub version: String,
    /// Base-side leases, absent for a working-tree generation.
    pub base: Option<Arc<BaseSide>>,
    /// Ancestor dependency directories used by the working generation.
    pub dependency_usage: Arc<dyn DependencyUsage>,
    pub(crate) css: Arc<Mutex<CssCache>>,
    pub(crate) bundles: Arc<Mutex<BTreeMap<String, BundleState>>>,
}

impl Runtime {
    pub(crate) fn base_warning(&self) -> Option<Warning> {
        self.base
            .as_ref()?
            .dependencies
            .warning
            .as_ref()
            .map(|warning| Warning {
                code: warning.code(),
                subject: WarningSubject::Configuration(warning.configuration.as_str().into()),
                message: warning.message(),
            })
    }
    /// Assemble runtime services without starting a sidecar or reading sources.
    pub fn new(
        tree: Arc<dyn SourceTree>,
        dependency_tree: Arc<dyn SourceTree>,
        pool: Arc<dyn SidecarPool>,
        cache: Arc<dyn RenderCache>,
        workers: Arc<dyn RenderWorkers>,
        version: String,
        base: Option<Arc<BaseSide>>,
    ) -> Self {
        Self {
            inventory_tree: tree.clone(),
            tree,
            dependency_tree,
            pool,
            cache,
            workers,
            version,
            base,
            dependency_usage: Arc::new(UsedDependencies::default()),
            css: Arc::new(Mutex::new(CssCache::default())),
            bundles: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }

    pub(crate) fn side(&self, config: &ResolvedConfig) -> Result<SideInputs> {
        let mut side = side::inputs(
            config,
            self.base.as_ref(),
            CONTEXT_SEQUENCE.fetch_add(1, Ordering::Relaxed),
        )?;
        let mut roots = Vec::new();
        let ancestors = ancestor_roots::directories(&side.configuration_directory);
        for (original, root) in side.dependency_roots.into_iter().enumerate() {
            let root = normalize(&root);
            let root = match self.dependency_tree.project(&root) {
                Ok(Some(node)) => node.identity,
                _ => root,
            };
            let index = roots
                .iter()
                .position(|candidate| candidate == &root)
                .unwrap_or(roots.len());
            if index == roots.len() {
                roots.push(root);
            }
            if let Some(directory) = ancestors.get(original) {
                let authored = PathBuf::from(directory)
                    .join("node_modules")
                    .to_string_lossy()
                    .replace('\\', "/");
                side.dependency_aliases
                    .insert(authored, ancestor_roots::logical(index));
            }
        }
        side.dependency_roots = roots;
        Ok(side)
    }
}

impl DefinitionProvider for Runtime {
    fn describe(
        &self,
        config: &ResolvedConfig,
        files: &[SourceFile],
    ) -> mokly_catalogue::error::Result<Definitions> {
        match definitions::describe(self, config, files) {
            Ok(definitions) => Ok(definitions),
            Err(source) => match source.diagnostic() {
                Some(source) => Err(CatalogueError::Runtime { source }),
                None => Err(CatalogueError::Internal(InternalError::Provider {
                    source: Box::new(source),
                })),
            },
        }
    }
}

impl GraphFactory for Runtime {
    fn create(&self, _config: &ResolvedConfig) -> mokly_graph::error::Result<Arc<dyn RenderGraph>> {
        let mut runtime = self.clone();
        runtime.tree = Arc::new(SourceSnapshot::new(self.tree.clone()));
        runtime.dependency_tree = Arc::new(SourceSnapshot::new(self.dependency_tree.clone()));
        Ok(Arc::new(JavaScriptGraph { runtime }))
    }
}

#[cfg(test)]
#[path = "_tests_/runtime_tests.rs"]
mod runtime_tests;
