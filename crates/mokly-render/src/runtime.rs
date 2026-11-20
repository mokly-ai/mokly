//! Shared runtime dependencies injected by the executable composition root.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, Weak};

use mokly_catalogue::config::normalize;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_compare::ancestor_roots;
use mokly_css::reference_cache::{MemoryReferenceCache, ReferenceCache};
use mokly_graph::cache::RenderCache;
use mokly_graph::delivery_inputs::STYLE_REFERENCE_BYTES;
use mokly_graph::document_store::DocumentStore;
use mokly_graph::public_inputs::{ClosureInputs, MemoryClosureInputs};
use mokly_graph::resource_inputs::{MemoryResourceInputs, ResourceInputs};
use mokly_graph::workers::RenderWorkers;
use mokly_sidecar::methods::BundleCapture;
use mokly_sidecar::pool::SidecarPool;
use mokly_source_interface::tree::SourceTree;

use crate::bundle::BundleState;
use crate::dependency_usage::{DependencyUsage, UsedDependencies};
use crate::edit_plans::Records;
use crate::leases::PreparedLease;
use crate::physical_inputs::PhysicalInputs;
use crate::postcss_cache::CssCache;
use crate::side;
use crate::side::{BaseSide, SideInputs};
use crate::stylesheet_store::StylesheetCache;

static CONTEXT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Definition and graph factories share one sidecar pool and one fragment cache.
#[derive(Clone)]
pub struct Runtime {
    /// Optional Serve store shared by working and historical generations.
    pub document_store: Option<Arc<dyn DocumentStore>>,
    /// Working or historical source reader.
    pub tree: Arc<dyn SourceTree>,
    pub(crate) inventory_tree: Arc<dyn SourceTree>,
    /// Physical reader for the selected installed third-party dependencies.
    pub dependency_tree: Arc<dyn SourceTree>,
    /// Filesystem reader for physical compilation evidence outside the side tree.
    pub physical_inputs: Arc<dyn PhysicalInputs>,
    /// Lazily started Node processes.
    pub pool: Arc<dyn SidecarPool>,
    /// Per-request evidence policy; Serve selects edit mode after its first publication.
    pub bundle_capture: BundleCapture,
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
    /// Inline style reference scans shared by every generation of this runtime and of each
    /// base runtime that `for_base` makes from it.
    pub(crate) style_references: Arc<dyn ReferenceCache>,
    pub(crate) resources: Arc<dyn ResourceInputs>,
    pub(crate) closures: Arc<dyn ClosureInputs>,
    pub(crate) prepared: Arc<Mutex<BTreeMap<String, Weak<PreparedLease>>>>,
    pub(crate) styles: Arc<Mutex<StylesheetCache>>,
    /// None marks an original head. Some marks a base, including an empty or expired source.
    pub(crate) head_styles: Option<Weak<Mutex<StylesheetCache>>>,
    pub(crate) watch_stylesheets: bool,
    /// One lock shared by every clone. `describe` holds it for the whole attempt, so two
    /// descriptions never interleave their bundle registry checks and sidecar calls.
    pub(crate) describing: Arc<Mutex<()>>,
    pub(crate) css: Arc<Mutex<CssCache>>,
    pub(crate) bundles: Arc<Mutex<BTreeMap<String, Weak<BundleState>>>>,
    pub(crate) edit_plans: Option<Arc<Mutex<Records>>>,
}

impl Runtime {
    /// Enable persistent documents only at the Serve composition root.
    pub fn with_document_store(mut self, store: Arc<dyn DocumentStore>) -> Self {
        self.document_store = Some(store);
        self
    }

    /// Enable physical stylesheet watch mapping for the working side of Serve.
    pub fn with_stylesheet_watching(mut self) -> Self {
        if self.base.is_none() {
            self.watch_stylesheets = true;
        }
        self
    }

    /// Keep bounded captured plans for the head preparations of one Serve command.
    pub fn with_serve_edit_plans(mut self) -> Self {
        if self.base.is_none() && self.edit_plans.is_none() {
            self.edit_plans = Some(Arc::new(Mutex::new(Records::default())));
        }
        self
    }

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
    #[expect(
        clippy::too_many_arguments,
        reason = "source trees and physical reuse evidence have separate injectable read boundaries"
    )]
    pub fn new(
        tree: Arc<dyn SourceTree>,
        dependency_tree: Arc<dyn SourceTree>,
        physical_inputs: Arc<dyn PhysicalInputs>,
        pool: Arc<dyn SidecarPool>,
        cache: Arc<dyn RenderCache>,
        workers: Arc<dyn RenderWorkers>,
        version: String,
        base: Option<Arc<BaseSide>>,
    ) -> Self {
        Self::assemble(
            tree,
            dependency_tree,
            physical_inputs,
            pool,
            cache,
            workers,
            version,
            base,
            Arc::new(MemoryReferenceCache::new(STYLE_REFERENCE_BYTES)),
        )
    }

    /// The runtime of one base preparation over `tree`. It shares the dependency reader, physical
    /// inputs, sidecar pool, render cache, workers, and style memo of this runtime. It starts its
    /// own stores and reads the original head's stylesheet store only through a weak reference.
    pub fn for_base(
        &self,
        tree: Arc<dyn SourceTree>,
        version: String,
        base: Option<Arc<BaseSide>>,
    ) -> Self {
        let mut runtime = Self::assemble(
            tree,
            self.dependency_tree.clone(),
            self.physical_inputs.clone(),
            self.pool.clone(),
            self.cache.clone(),
            self.workers.clone(),
            version,
            base,
            self.style_references.clone(),
        );
        runtime.document_store = self.document_store.clone();
        runtime.watch_stylesheets = false;
        runtime.head_styles = Some(match &self.head_styles {
            Some(head) => head.clone(),
            None => Arc::downgrade(&self.styles),
        });
        runtime
    }

    /// Every field of a runtime, so that each constructor passes the style memo.
    #[expect(
        clippy::too_many_arguments,
        reason = "each constructor passes the shared services and the style memo explicitly"
    )]
    fn assemble(
        tree: Arc<dyn SourceTree>,
        dependency_tree: Arc<dyn SourceTree>,
        physical_inputs: Arc<dyn PhysicalInputs>,
        pool: Arc<dyn SidecarPool>,
        cache: Arc<dyn RenderCache>,
        workers: Arc<dyn RenderWorkers>,
        version: String,
        base: Option<Arc<BaseSide>>,
        style_references: Arc<dyn ReferenceCache>,
    ) -> Self {
        Self {
            document_store: None,
            inventory_tree: tree.clone(),
            tree,
            dependency_tree,
            physical_inputs,
            pool,
            bundle_capture: BundleCapture::Full,
            cache,
            workers,
            version,
            watch_stylesheets: false,
            head_styles: base.as_ref().map(|_| Weak::new()),
            base,
            dependency_usage: Arc::new(UsedDependencies::default()),
            style_references,
            resources: Arc::new(MemoryResourceInputs::default()),
            closures: Arc::new(MemoryClosureInputs::default()),
            prepared: Arc::new(Mutex::new(BTreeMap::new())),
            styles: Arc::new(Mutex::new(StylesheetCache::default())),
            describing: Arc::new(Mutex::new(())),
            css: Arc::new(Mutex::new(CssCache::default())),
            bundles: Arc::new(Mutex::new(BTreeMap::new())),
            edit_plans: None,
        }
    }

    pub(crate) fn side(&self, config: &ResolvedConfig) -> SideInputs {
        let mut side = side::inputs(
            config,
            self.base.as_ref(),
            CONTEXT_SEQUENCE.fetch_add(1, Ordering::Relaxed),
        );
        let mut roots = Vec::new();
        let ancestors = ancestor_roots::directories(&side.configuration_directory);
        for (original, root) in side.dependency_roots.into_iter().enumerate() {
            let root = normalize(&root);
            let authored = side
                .module_resolution
                .dependency_root
                .as_ref()
                .and_then(|repository| root.strip_prefix(repository).ok())
                .map(|path| path.to_string_lossy().replace('\\', "/"))
                .or_else(|| {
                    ancestors.get(original).map(|directory| {
                        PathBuf::from(directory)
                            .join("node_modules")
                            .to_string_lossy()
                            .replace('\\', "/")
                    })
                });
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
            if let Some(authored) = authored {
                side.dependency_aliases
                    .insert(authored, ancestor_roots::logical(index));
            }
        }
        side.dependency_roots = roots;
        side
    }
}

#[cfg(test)]
#[path = "_tests_/runtime_tests.rs"]
mod runtime_tests;

#[cfg(test)]
#[path = "_tests_/bundle_reuse_tests.rs"]
mod bundle_reuse_tests;
