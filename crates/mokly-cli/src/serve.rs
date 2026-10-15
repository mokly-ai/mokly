//! Validated fixed Serve generation preparation over injected catalogue services.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::preparation::CatalogueBuilder;
use mokly_graph::types::{GraphFactory, RenderGeneration};

use crate::build::{BuildError, BuildSummary};
use crate::grammar::Common;

/// Catalogue state before the listener is reserved; no document has rendered.
pub struct PreparedServe {
    /// Resolved configuration and repository paths.
    pub config: ResolvedConfig,
    /// Document keys and lazy render recipes.
    pub generation: Arc<dyn RenderGeneration>,
    /// Validated counts and startup warnings.
    pub summary: BuildSummary,
}

/// Preparation boundary shared with later watch candidates.
#[cfg_attr(test, unimock::unimock(api = ServePreparationMock))]
pub trait ServePreparation: Send + Sync {
    /// Validate all source and route identities before binding a port.
    fn prepare(&self, cwd: &Path, options: &Common) -> Result<PreparedServe, BuildError>;
}

/// Catalogue preparation through the shared definition and render factories.
pub struct CatalogueServe {
    /// Configuration loading boundary.
    pub config: Arc<dyn ConfigLoader>,
    /// Source preparation and definition provider.
    pub catalogue: Arc<dyn CatalogueBuilder>,
    /// Resolved-config render graph factory.
    pub graphs: Arc<dyn GraphFactory>,
}

impl ServePreparation for CatalogueServe {
    fn prepare(&self, cwd: &Path, options: &Common) -> Result<PreparedServe, BuildError> {
        let config = match self.config.load(cwd, options.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        let output = config.repo_root.join("mokly-static");
        let prepared = match self.catalogue.prepare(&config, Some(&output)) {
            Ok(prepared) => prepared,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        if !prepared.deferred_modules.is_empty() {
            return Err(BuildError::Deferred {
                modules: prepared.deferred_modules,
                warnings: prepared.warnings,
            });
        }
        let graph = match self.graphs.create(&config) {
            Ok(graph) => graph,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: prepared.warnings,
                });
            }
        };
        let generation = match graph.prepare(config.clone(), prepared.clone(), Some(&output)) {
            Ok(generation) => generation,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: prepared.warnings,
                });
            }
        };
        let mut counts = BTreeMap::new();
        for entry in &prepared.model.entries {
            *counts.entry(entry.content.kind()).or_default() += 1;
        }
        Ok(PreparedServe {
            config,
            generation,
            summary: BuildSummary {
                documents: 0,
                counts,
                warnings: prepared.warnings,
                deferred_modules: Vec::new(),
            },
        })
    }
}
