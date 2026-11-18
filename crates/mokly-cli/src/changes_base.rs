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
use mokly_compare::base_freshness::Freshness;
use mokly_compare::base_render::{
    BasePreparationError, BasePreparationResult, BaseProvider, BaseRequest, PreparedBase,
};
use mokly_compare::comparison_steps::Step;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::{Error, Result};
use mokly_git::error;
use mokly_git::source_key::CheckoutIdentity;
use mokly_graph::types::GraphFactory;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTree;

use crate::base_dependencies::BaseDependencies;
use crate::changes_freshness::{SelectionRequest, html_dependencies, reusable, working_roots};
use crate::serve_preparation_control::PreparationControl;

/// Prepare the base generation through a second `Runtime` over the base tree. It reuses
/// the head runtime's pool, render cache, and workers. A base that needs a sidecar gets a
/// `BaseSide`, which keeps its source and dependency leases while the base graph lives.
pub(super) struct NativeBase {
    pub(super) preparation: Option<Arc<dyn PreparationControl>>,
    pub(super) runtime: Arc<Runtime>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) dependencies: Arc<dyn BaseDependencies>,
    pub(super) freshness: Option<Arc<dyn Freshness>>,
}

impl BaseProvider for NativeBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        let mut scripts_off = false;
        let checkout = match &self.freshness {
            Some(_) => match request.repository.checkout_identity(&request.commit) {
                Ok(checkout) => Some(checkout),
                Err(error::Error::Cancelled) => {
                    return Err(BasePreparationError::new(false, Error::Cancelled));
                }
                Err(error) => {
                    tracing::debug!(%error, "base checkout evidence is unavailable");
                    None
                }
            },
            None => None,
        };
        match self.prepare_generation(request, &mut scripts_off, checkout) {
            Ok(prepared) => Ok(prepared),
            Err(source) => Err(BasePreparationError::new(scripts_off, source)),
        }
    }
}

impl NativeBase {
    fn prepare_generation(
        &self,
        request: &BaseRequest<'_>,
        scripts_off: &mut bool,
        checkout: Option<CheckoutIdentity>,
    ) -> Result<PreparedBase> {
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: request.sources.tree.clone(),
            cancellation: self.cancellation.clone(),
        });
        let early = self.early_sources(request)?;
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
        let (directories, unmapped) = if needs_sidecar {
            (
                self.runtime.dependency_usage.directories(),
                self.runtime.dependency_usage.unmapped_directories(),
            )
        } else {
            (
                request
                    .head
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .cloned()
                    .collect(),
                Vec::new(),
            )
        };
        if let Some(preparation) = &self.preparation {
            preparation.selected(needs_sidecar, directories.clone(), unmapped.clone());
        }
        let (base, selection, warning) = if needs_sidecar {
            let prepared = self.dependencies.prepare(
                request,
                &config,
                &SelectionRequest {
                    directories: &directories,
                    unmapped: &unmapped,
                    record: checkout.is_some(),
                },
                early,
            )?;
            (Some(prepared.side), prepared.selection, None)
        } else {
            let (warning, selection) =
                html_dependencies(request, &config, &directories, checkout.is_some())?;
            (None, selection, warning)
        };
        *scripts_off = base.as_ref().is_some_and(|base| {
            base.dependencies.tier == Tier::Installed && !request.install_scripts
        });
        if let Some(base) = &base {
            request.sources.sources.attach(base.sources.clone())?;
        }
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        request.steps.step(Step::Rendering);
        let runtime = Arc::new(Runtime::new(
            tree.clone(),
            self.runtime.dependency_tree.clone(),
            self.runtime.physical_inputs.clone(),
            self.runtime.pool.clone(),
            self.runtime.cache.clone(),
            self.runtime.workers.clone(),
            VERSION.into(),
            base.clone(),
        ));
        let builder: &dyn CatalogueBuilder = &Builder {
            tree,
            discovery: Arc::new(Discovered(inventory)),
            definitions: runtime.clone(),
        };
        let mut catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => return Err(Error::Catalogue { source }),
        };
        catalogue.warnings.extend(warning);
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let factory: &dyn GraphFactory = runtime.as_ref();
        let graph = match factory.create(&config) {
            Ok(graph) => graph,
            Err(source) => return Err(Error::Graph { source }),
        };
        let roots = if checkout.is_some() && reusable(base.as_ref()) {
            working_roots(
                base.as_ref(),
                &config,
                runtime.dependency_usage.directories().into_iter(),
            )
        } else {
            None
        };
        let generation = match graph.prepare(config, catalogue, None) {
            Ok(generation) => generation,
            Err(source) => return Err(Error::Graph { source }),
        };
        let roots = roots.map(|mut roots| {
            roots.extend(
                generation
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .map(|directory| request.working_config.repo_root.join(directory)),
            );
            roots.sort();
            roots.dedup();
            roots
        });
        let freshness = match (&self.freshness, checkout, selection) {
            (Some(freshness), Some(checkout), Some(selection)) if reusable(base.as_ref()) => {
                match freshness.record(
                    checkout,
                    selection,
                    roots.as_deref(),
                    generation.catalogue(),
                ) {
                    Ok(inputs) => inputs,
                    Err(Error::Cancelled) => return Err(Error::Cancelled),
                    Err(error) => {
                        tracing::debug!(%error, "base freshness evidence is unavailable");
                        None
                    }
                }
            }
            _ => None,
        };
        Ok(PreparedBase {
            generation,
            scripts_off: *scripts_off,
            freshness,
        })
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

#[cfg(test)]
#[path = "_tests_/changes_base_tests.rs"]
mod changes_base_tests;

#[cfg(test)]
#[path = "_tests_/changes_base_success_tests.rs"]
mod changes_base_success_tests;

#[cfg(test)]
#[path = "_tests_/changes_freshness_tests.rs"]
mod changes_freshness_tests;

#[cfg(test)]
#[path = "_tests_/changes_evidence_tests.rs"]
mod changes_evidence_tests;
