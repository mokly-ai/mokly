//! Catalogue validation and complete in-memory rendering before static output.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilder;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_model::axes::EntryKind;
use thiserror::Error;

use crate::cancellation::Cancellation;
use crate::grammar::Build;
use crate::pre_installation;

/// Validated catalogue counts and warnings for terminal presentation.
#[derive(Clone, Debug)]
pub struct BuildSummary {
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
    /// A signal stopped work before installation; the original diagnostic remains.
    #[error("[mokly-cli/build] {source}")]
    Interrupted {
        /// Primary failure before any earlier output moved.
        source: Box<BuildError>,
    },
    /// The build failed and stopping render workers also failed.
    #[error("[mokly-cli/build] {primary}; render shutdown failed: {shutdown}")]
    Shutdown {
        /// Original failure, including a classified cancellation.
        primary: Box<BuildError>,
        /// Independent render shutdown failure.
        shutdown: Box<BuildError>,
    },
    /// Transaction cleanup failed after an earlier command error.
    #[error("[mokly-cli/build] {primary}; output cleanup failed: {cleanup}")]
    Cleanup {
        /// Original typed command failure.
        primary: Box<BuildError>,
        /// Typed cleanup failure; never a sidecar error.
        cleanup: Box<mokly_static::error::Error>,
        /// Exact retained operation path.
        path: PathBuf,
    },
    /// The selected publication policy refuses warnings without an explicit --strict.
    #[error(
        "[mokly-cli/build] The catalogue has build warnings. Fix the reported warnings and retry."
    )]
    Warnings,
    /// The matching viewer package is unavailable.
    #[error("[mokly-cli/build] Build or reinstall the matching @mokly/viewer package.")]
    Viewer,
    /// Static output or its recovery failed.
    #[error("[mokly-cli/build] {source}")]
    Static {
        /// Typed output failure, including both recovery causes.
        source: mokly_static::error::Error,
    },
    /// Comparison history could not be resolved.
    #[error("[mokly-cli/build] Git information could not be read for {base:?}: {source}")]
    Git {
        /// Selected reference.
        base: String,
        /// Bounded Git failure.
        source: mokly_git::error::Error,
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

/// Complete render retained for output assembly without reloading the catalogue.
pub struct PreparedBuild {
    /// Resolved configuration used by the generation.
    pub config: ResolvedConfig,
    /// Render graph with complete documents and authored closure.
    pub generation: Arc<dyn RenderGeneration>,
    /// Validation counts and warnings.
    pub summary: BuildSummary,
}

/// Build command service, consumed through `dyn BuildService` at the CLI root.
#[cfg_attr(test, unimock::unimock(api = BuildServiceMock))]
pub trait BuildService: Send + Sync {
    /// Keep the validated generation for static output assembly.
    fn prepare(&self, cwd: &Path, options: &Build) -> Result<PreparedBuild, BuildError>;
    /// Discover and validate the catalogue in memory, with no file writes.
    fn run(&self, cwd: &Path, options: &Build) -> Result<BuildSummary, BuildError>;
}

/// Build coordinator with injected config and catalogue boundaries.
pub struct CatalogueBuild {
    /// Static builds capture all explicit inputs before document callbacks run.
    pub inputs: Option<Arc<dyn mokly_static::fingerprint::InputTree>>,
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
        Ok(self.prepare(cwd, options)?.summary)
    }

    fn prepare(&self, cwd: &Path, options: &Build) -> Result<PreparedBuild, BuildError> {
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
        pre_installation::settle(result, self.cancellation.as_ref())
    }
}

fn runtime(source: InternalError) -> BuildError {
    BuildError::Rendering {
        source: Box::new(GraphError::Internal(source)),
        warnings: Vec::new(),
    }
}

impl CatalogueBuild {
    fn checkpoint(&self) -> Result<(), BuildError> {
        if self.cancellation.requested() {
            Err(BuildError::Cancelled)
        } else {
            Ok(())
        }
    }

    fn attempt(&self, cwd: &Path, options: &Build) -> Result<PreparedBuild, BuildError> {
        self.checkpoint()?;
        let config = match self.config.load(cwd, options.common.config.as_deref()) {
            Ok(config) => config,
            Err(source) => return Err(BuildError::Catalogue { source }),
        };
        self.checkpoint()?;
        let output = mokly_static::location::output(&config, options.out.as_deref());
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
        if let Some(inputs) = &self.inputs
            && let Err(source) =
                inputs.capture(&config.repo_root, &generation.catalogue().model.sources)
        {
            return Err(BuildError::Static { source });
        }
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
        if options.strict && !rendered.warnings.is_empty() {
            return Err(BuildError::Strict {
                warnings: rendered.warnings,
            });
        }
        let mut counts = BTreeMap::new();
        for entry in &prepared.model.entries {
            *counts.entry(entry.content.kind()).or_default() += 1;
        }
        Ok(PreparedBuild {
            config,
            generation,
            summary: BuildSummary {
                documents: rendered.documents,
                counts,
                warnings: rendered.warnings,
                deferred_modules: prepared.deferred_modules,
            },
        })
    }
}

#[cfg(test)]
#[path = "_tests_/build_tests.rs"]
mod build_tests;
