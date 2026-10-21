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
use mokly_compare::base_render::{BaseProvider, BaseRequest};
use mokly_compare::dependency_paths;
use mokly_compare::dependency_types::Tier;
use mokly_compare::error::{Error, Result};
use mokly_compare::inputs::{InputReader, SourceInputs};
use mokly_compare::working_inputs::{SystemWorkingInputs, WorkingInputs};
use mokly_git::tree::Limits;
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
            Some(self.dependencies.prepare(
                request,
                &config,
                &self.runtime.dependency_usage.directories(),
                &self.runtime.dependency_usage.unmapped_directories(),
            )?)
        } else {
            None
        };
        let scripts_hint = base.as_ref().is_some_and(|base| {
            base.dependencies.tier == Tier::Installed && !request.install_scripts
        });
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
            )?
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
        let mut catalogue = match builder.prepare(&config, None) {
            Ok(catalogue) => catalogue,
            Err(source) => {
                let error = Error::Catalogue { source };
                return Err(if scripts_hint {
                    Error::BaseInstallScripts {
                        source: Box::new(error),
                    }
                } else {
                    error
                });
            }
        };
        catalogue.warnings.extend(warning);
        if self.cancellation.requested() {
            return Err(Error::Cancelled);
        }
        let factory: &dyn GraphFactory = runtime.as_ref();
        let graph = match factory.create(&config) {
            Ok(graph) => graph,
            Err(source) => {
                let error = Error::Graph { source };
                return Err(if scripts_hint {
                    Error::BaseInstallScripts {
                        source: Box::new(error),
                    }
                } else {
                    error
                });
            }
        };
        match graph.prepare(config, catalogue, None) {
            Ok(generation) => Ok(generation),
            Err(source) => {
                let error = Error::Graph { source };
                Err(if scripts_hint {
                    Error::BaseInstallScripts {
                        source: Box::new(error),
                    }
                } else {
                    error
                })
            }
        }
    }
}

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
