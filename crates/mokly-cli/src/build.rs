//! Catalogue validation and complete in-memory rendering before static output.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilder;
use mokly_compare::base_render::ChangesService;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::error::Error;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::GraphFactory;
use mokly_model::axes::EntryKind;
use thiserror::Error;

use crate::cancellation::Cancellation;
use crate::changes_output::ChangeDiagnostic;
use crate::grammar::Build;

/// Validated catalogue counts and warnings for terminal presentation.
#[derive(Clone, Debug)]
pub struct BuildSummary {
    /// In-memory Changes result retained for static output.
    pub changes: BuildChanges,
    /// Complete rendered view, page, and document count.
    pub documents: usize,
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
    /// Git or internal comparison failure aborts output publication.
    #[error("[mokly-cli/build] comparison against {base_ref:?} failed: {source}")]
    Comparison {
        /// Selected authored or default ref.
        base_ref: String,
        /// Original comparison failure.
        source: Box<Error>,
        /// Current build and base preparation warnings.
        warnings: Vec<Warning>,
    },
    /// The command was interrupted before successful completion.
    #[error("[mokly-cli/build] build cancelled")]
    Cancelled,
    /// The injected definition provider cannot evaluate discovered JavaScript.
    #[error("[mokly-cli/build] JavaScript rendering is unavailable for {}", .modules.join(", "))]
    Deferred {
        /// Repository-relative JavaScript inputs awaiting an implementation.
        modules: Vec<String>,
        /// Warnings produced by preparation.
        warnings: Vec<Warning>,
    },
    /// Graph preparation or complete view rendering failed.
    #[error("[mokly-cli/build] rendering failed: {source}")]
    Rendering {
        /// Original typed render failure.
        source: Box<GraphError>,
        /// Warnings already raised by preparation.
        warnings: Vec<Warning>,
    },
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
    /// Shared base preparation and comparison service.
    pub changes: Arc<dyn ChangesService>,
    /// Cancellation state checked at every build phase.
    pub cancellation: Arc<dyn Cancellation>,
    /// Data-only configuration loader.
    pub config: Arc<dyn ConfigLoader>,
    /// Source discovery and validation.
    pub catalogue: Arc<dyn CatalogueBuilder>,
    /// Resolved-configuration graph composition root.
    pub graphs: Arc<dyn GraphFactory>,
}

impl BuildService for CatalogueBuild {
    fn run(&self, cwd: &Path, options: &Build) -> Result<BuildSummary, BuildError> {
        let result = std::thread::scope(|scope| {
            let thread = match std::thread::Builder::new()
                .name("mokly-build".into())
                .stack_size(64 * 1024 * 1024)
                .spawn_scoped(scope, || self.attempt(cwd, options))
            {
                Ok(thread) => thread,
                Err(source) => return Err(runtime(InternalError::PreparationThread { source })),
            };
            match thread.join() {
                Ok(result) => result,
                Err(_) => Err(runtime(InternalError::PreparationPanicked)),
            }
        });
        if self.cancellation.requested() {
            Err(BuildError::Cancelled)
        } else {
            result
        }
    }
}

fn runtime(source: InternalError) -> BuildError {
    BuildError::Rendering {
        source: Box::new(GraphError::Internal(source)),
        warnings: Vec::new(),
    }
}

impl CatalogueBuild {
    pub(crate) fn checkpoint(&self) -> Result<(), BuildError> {
        if self.cancellation.requested() {
            Err(BuildError::Cancelled)
        } else {
            Ok(())
        }
    }

    fn attempt(&self, cwd: &Path, options: &Build) -> Result<BuildSummary, BuildError> {
        self.checkpoint()?;
        let config = match self.config.load(cwd, options.common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        self.checkpoint()?;
        let output: PathBuf = options.out.as_ref().map_or_else(
            || config.repo_root.join("mokly-static"),
            |path| cwd.join(path),
        );
        let prepared = match self.catalogue.prepare(&config, Some(&output)) {
            Ok(prepared) => prepared,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        self.checkpoint()?;
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
        self.checkpoint()?;
        let generation = match graph.prepare(config.clone(), prepared.clone(), Some(&output)) {
            Ok(generation) => generation,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: prepared.warnings,
                });
            }
        };
        self.checkpoint()?;
        let rendered = match generation.render_all() {
            Ok(summary) => summary,
            Err(source) => {
                return Err(BuildError::Rendering {
                    source: Box::new(source),
                    warnings: prepared.warnings,
                });
            }
        };
        self.checkpoint()?;
        let mut warnings = rendered.warnings;
        let changes = self.classify_changes(&config, options, generation, &mut warnings)?;
        self.checkpoint()?;
        mokly_catalogue::diagnostic::normalize_warnings(&mut warnings);
        if options.strict && !warnings.is_empty() {
            return Err(BuildError::Strict { warnings });
        }
        let mut counts = BTreeMap::new();
        for entry in &prepared.model.entries {
            *counts.entry(entry.content.kind()).or_default() += 1;
        }
        Ok(BuildSummary {
            changes,
            documents: rendered.documents,
            counts,
            warnings,
            deferred_modules: prepared.deferred_modules,
        })
    }
}

#[cfg(test)]
#[path = "_tests_/build_tests.rs"]
mod build_tests;

/// Build computes Changes once and keeps the result for the static writer.
#[derive(Clone, Debug)]
pub enum BuildChanges {
    /// --no-changes starts no Git or comparison work.
    Disabled,
    /// Complete validated result and the same historical generation.
    Ready(Arc<ComparisonResult>),
    /// The current catalogue remains usable when historical sources fail validation.
    Unavailable {
        /// Full immutable historical commit.
        base_commit: String,
        /// Short reason for the unavailable completion line.
        reason: String,
        /// Preserved base validation diagnostic.
        diagnostics: Vec<ChangeDiagnostic>,
    },
}

#[cfg(test)]
#[path = "_tests_/changes_failure_tests.rs"]
mod changes_failure_tests;

#[cfg(test)]
#[path = "_tests_/changes_checkpoint_tests.rs"]
mod changes_checkpoint_tests;
