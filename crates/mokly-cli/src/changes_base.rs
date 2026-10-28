//! Historical definitions and graph preparation share the working runtime's services.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::{ConfigLoader, Loader, relative};
use mokly_catalogue::config_types::{Config, ResolvedConfig};
use mokly_catalogue::diagnostic::{Warning, WarningSubject};
use mokly_catalogue::discovery::{Discoverer, Discovery, Inventory, SourceKind};
use mokly_catalogue::preparation::{Builder, CatalogueBuilder};
use mokly_cli::cancellation::Cancellation;
use mokly_cli::cancelled_work::CancellableTree;
use mokly_cli::version::VERSION;
use mokly_compare::base_render::{
    BasePreparationError, BasePreparationResult, BaseProvider, BaseRequest, PreparedBase,
};
use mokly_compare::cache_types::Lease;
use mokly_compare::dependency_paths;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::{Error, Result};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::tree::Limits;
use mokly_graph::types::GraphFactory;
use mokly_render::runtime::Runtime;
use mokly_source_interface::tree::SourceTree;

use crate::base_dependencies::BaseDependencies;

/// Prepare the base generation through a second `Runtime` over the base tree. It reuses
/// the head runtime's pool, render cache, and workers. A base that needs a sidecar gets a
/// `BaseSide`, which keeps its source and dependency leases while the base graph lives.
pub(super) struct NativeBase {
    pub(super) runtime: Arc<Runtime>,
    pub(super) cancellation: Arc<dyn Cancellation>,
    pub(super) dependencies: Arc<dyn BaseDependencies>,
}

impl BaseProvider for NativeBase {
    fn prepare(&self, request: &BaseRequest<'_>) -> BasePreparationResult {
        if self.cancellation.requested() {
            return Err(BasePreparationError::new(false, Error::Cancelled));
        }
        let tree: Arc<dyn SourceTree> = Arc::new(CancellableTree {
            inner: request.sources.tree.clone(),
            cancellation: self.cancellation.clone(),
        });
        let early = self
            .early_sources(request)
            .map_err(|source| BasePreparationError::new(false, source))?;
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
                Err(source) => {
                    return Err(BasePreparationError::new(
                        false,
                        Error::Catalogue { source },
                    ));
                }
            }
        };
        let discovery: &dyn Discovery = &Discoverer { tree: tree.clone() };
        let inventory = match discovery.discover(&config, None) {
            Ok(inventory) => inventory,
            Err(source) => {
                return Err(BasePreparationError::new(
                    false,
                    Error::Catalogue { source },
                ));
            }
        };
        let needs_sidecar = config.input.postcss.is_some()
            || config.input.renderer.is_some()
            || inventory.files.iter().any(|file| {
                !file.excluded && matches!(file.kind, SourceKind::Module | SourceKind::Stories)
            });
        let base = if needs_sidecar {
            Some(
                self.dependencies
                    .prepare(
                        request,
                        &config,
                        &self.runtime.dependency_usage.directories(),
                        &self.runtime.dependency_usage.unmapped_directories(),
                        early,
                    )
                    .map_err(|source| BasePreparationError::new(false, source))?,
            )
        } else {
            None
        };
        let scripts_off = base.as_ref().is_some_and(|base| {
            base.dependencies.tier == Tier::Installed && !request.install_scripts
        });
        if let Some(base) = &base {
            request
                .sources
                .sources
                .attach(base.sources.clone())
                .map_err(|source| BasePreparationError::new(scripts_off, source))?;
        }
        let warning = if needs_sidecar {
            None
        } else {
            html_dependencies(
                request,
                &config,
                &request
                    .head
                    .catalogue()
                    .dependency_directories
                    .iter()
                    .cloned()
                    .collect::<Vec<_>>(),
            )
            .map_err(|source| BasePreparationError::new(scripts_off, source))?
        };
        if self.cancellation.requested() {
            return Err(BasePreparationError::new(scripts_off, Error::Cancelled));
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
        let mut catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => {
                return Err(BasePreparationError::new(
                    scripts_off,
                    Error::Catalogue { source },
                ));
            }
        };
        catalogue.warnings.extend(warning);
        if self.cancellation.requested() {
            return Err(BasePreparationError::new(scripts_off, Error::Cancelled));
        }
        let factory: &dyn GraphFactory = runtime.as_ref();
        let graph = match factory.create(&config) {
            Ok(graph) => graph,
            Err(source) => {
                return Err(BasePreparationError::new(
                    scripts_off,
                    Error::Graph { source },
                ));
            }
        };
        match graph.prepare(config, catalogue, None) {
            Ok(generation) => Ok(PreparedBase {
                generation,
                scripts_off,
            }),
            Err(source) => Err(BasePreparationError::new(
                scripts_off,
                Error::Graph { source },
            )),
        }
    }
}

impl NativeBase {
    /// Before the base configuration loads, leases an existing complete extraction
    /// and attaches it to the base sources, when the working configuration names a
    /// renderer or PostCSS. This optional step never builds an extraction, and a
    /// failure other than cancellation leaves the base reads on Git.
    fn early_sources(&self, request: &BaseRequest<'_>) -> Result<Option<Arc<Lease>>> {
        let input = &request.working_config.input;
        if input.renderer.is_none() && input.postcss.is_none() {
            return Ok(None);
        }
        let attached = self
            .dependencies
            .existing_sources(request)
            .and_then(|lease| match lease {
                Some(lease) => {
                    request.sources.sources.attach(lease.clone())?;
                    Ok(Some(lease))
                }
                None => Ok(None),
            });
        match attached {
            Err(Error::Cancelled) => Err(Error::Cancelled),
            Err(error) => {
                tracing::debug!(%error, "base reads stay on Git before the dependency step");
                Ok(None)
            }
            result => result,
        }
    }
}

/// Compare the governing manifests and lockfiles of the used dependency directories on
/// both sides. It reads only those exact paths, with no tree listing, so an HTML-only
/// base needs no extraction. A difference gives one `base-dependencies` warning.
fn html_dependencies(
    request: &BaseRequest<'_>,
    config: &ResolvedConfig,
    used: &[String],
) -> Result<Option<Warning>> {
    let paths = dependency_paths::governing(used)?;
    if paths.is_empty() {
        return Ok(None);
    }
    let reader: &dyn InputReader = &SourceInputs;
    let base = reader.read_paths(request.sources.sources.as_ref(), &paths, Limits::default())?;
    let working: &dyn WorkingInputs = &SystemWorkingInputs;
    let head = working.read_paths(
        request.repository.as_ref(),
        &base,
        &paths,
        Limits::default(),
    )?;
    Ok((base != head).then(|| Warning {
        code: "base-dependencies",
        subject: WarningSubject::Configuration(relative(&config.file, &config.repo_root)),
        message: "Base dependencies differ. HTML comparison uses working-tree dependencies.".into(),
    }))
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
