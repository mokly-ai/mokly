//! Shared runtime dependencies injected by the executable composition root.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::definition_provider::{DefinitionProvider, Definitions};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::discovery::SourceFile;
use mokly_catalogue::error::{CatalogueError, InternalError};
use mokly_graph::cache::RenderCache;
use mokly_graph::resource_inputs::{MemoryResourceInputs, ResourceInputs};
use mokly_graph::source_snapshot::SourceSnapshot;
use mokly_graph::types::{GraphFactory, RenderGraph};
use mokly_graph::workers::RenderWorkers;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

use crate::bundle::BundleState;
use crate::error::Result;
use crate::graph::JavaScriptGraph;
use crate::leases::PreparedLease;
use crate::postcss_cache::CssCache;
use crate::side::{BaseSide, SideInputs};
use crate::stylesheet_cache::StylesheetCache;
use crate::{definitions, side};

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
    pub(crate) resources: Arc<dyn ResourceInputs>,
    pub(crate) prepared: Arc<Mutex<BTreeMap<String, Weak<PreparedLease>>>>,
    pub(crate) styles: Arc<Mutex<StylesheetCache>>,
    pub(crate) sequence: Arc<AtomicU64>,
    pub(crate) css: Arc<Mutex<CssCache>>,
    pub(crate) bundles: Arc<Mutex<BTreeMap<String, Weak<BundleState>>>>,
}

impl Runtime {
    /// Clone the factories over one attempt's source snapshot and shared runtime caches.
    pub fn with_tree(&self, tree: Arc<dyn SourceTree>) -> Self {
        let mut runtime = self.clone();
        runtime.tree = tree;
        runtime
    }
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
            resources: Arc::new(MemoryResourceInputs::default()),
            prepared: Arc::new(Mutex::new(BTreeMap::new())),
            styles: Arc::new(Mutex::new(StylesheetCache::default())),
            sequence: Arc::new(AtomicU64::new(0)),
            css: Arc::new(Mutex::new(CssCache::default())),
            bundles: Arc::new(Mutex::new(BTreeMap::new())),
        }
    }

    pub(crate) fn side(&self, config: &ResolvedConfig) -> Result<SideInputs> {
        let mut side = side::inputs(
            config,
            self.base.as_ref(),
            self.sequence.fetch_add(1, Ordering::Relaxed),
        )?;
        let mut roots = Vec::new();
        for root in side.dependency_roots {
            let root = match self.dependency_tree.project(&root) {
                Ok(Some(node)) => node.identity,
                _ => root,
            };
            if !roots.contains(&root) {
                roots.push(root);
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
        let mut attempt = self.clone();
        attempt.tree = Arc::new(SourceSnapshot::new(self.tree.clone()));
        attempt.dependency_tree = Arc::new(SourceSnapshot::new(self.dependency_tree.clone()));
        match definitions::describe(&attempt, config, files) {
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
