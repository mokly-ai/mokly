//! Discovery-only build orchestration. Rendering and static writes have later owners.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilder;
use mokly_model::axes::EntryKind;
use thiserror::Error;

use crate::grammar::Build;

/// Validated catalogue counts and warnings for terminal presentation.
#[derive(Clone, Debug)]
pub struct BuildSummary {
    /// Counts come only from the validated catalogue model, including variants.
    pub counts: BTreeMap<EntryKind, usize>,
    /// All sorted and deduplicated warnings from this attempt.
    pub warnings: Vec<Warning>,
    /// Sources awaiting JavaScript description in the sidecar milestone.
    pub deferred_modules: Vec<String>,
}

/// Typed build failure; warning records survive both error paths.
#[derive(Debug, Error)]
pub enum BuildError {
    /// Config loading or catalogue preparation failed.
    #[error("[mokly-cli/build] catalogue preparation failed: {source}")]
    Catalogue {
        /// Original typed catalogue failure.
        source: CatalogueError,
    },
    /// Strict validation found warnings.
    #[error("[mokly-cli/build] {} build warning(s) with --strict", .warnings.len())]
    Strict {
        /// Sorted warnings which the reporter prints before the failure.
        warnings: Vec<Warning>,
    },
}

/// Build command service, consumed through `dyn BuildService` at the CLI root.
#[cfg_attr(test, unimock::unimock(api = BuildServiceMock))]
pub trait BuildService: Send + Sync {
    /// Discover and validate the catalogue in memory, with no file writes.
    fn run(&self, cwd: &Path, options: &Build) -> Result<BuildSummary, BuildError>;
}

/// Build coordinator with injected config and catalogue boundaries.
pub struct CatalogueBuild {
    /// Data-only configuration loader.
    pub config: Arc<dyn ConfigLoader>,
    /// Source discovery and validation.
    pub catalogue: Arc<dyn CatalogueBuilder>,
}

impl BuildService for CatalogueBuild {
    fn run(&self, cwd: &Path, options: &Build) -> Result<BuildSummary, BuildError> {
        let config = match self.config.load(cwd, options.common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        let output: PathBuf = options.out.as_ref().map_or_else(
            || config.repo_root.join("mokly-static"),
            |path| cwd.join(path),
        );
        let prepared = match self.catalogue.prepare(&config, Some(&output)) {
            Ok(prepared) => prepared,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        if options.strict && !prepared.warnings.is_empty() {
            return Err(BuildError::Strict {
                warnings: prepared.warnings,
            });
        }
        let mut counts = BTreeMap::new();
        for entry in &prepared.model.entries {
            *counts.entry(entry.content.kind()).or_default() += 1;
        }
        Ok(BuildSummary {
            counts,
            warnings: prepared.warnings,
            deferred_modules: prepared.deferred_modules,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/build_tests.rs"]
mod build_tests;
