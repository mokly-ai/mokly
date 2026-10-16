//! Catalogue validation and complete in-memory rendering before static output.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use mokly_catalogue::config::ConfigLoader;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_catalogue::error::CatalogueError;
use mokly_catalogue::preparation::CatalogueBuilder;
use mokly_compare::base_render::ChangesService;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::error::Error;
use mokly_graph::error::{GraphError, InternalError};
use mokly_graph::types::{GraphFactory, RenderGeneration};
use mokly_model::axes::EntryKind;
use thiserror::Error;

use crate::cancellation::Cancellation;
use crate::changes_output::ChangeDiagnostic;
use crate::grammar::Build;
use crate::pre_installation;

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
    /// A watched candidate changes settings owned by the running sidecar pool.
    #[error("[mokly-cli/serve] {setting} changed. Restart Serve to apply this setting.")]
    RestartRequired {
        /// Fixed process-level setting.
        setting: &'static str,
    },
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
    #[error("[mokly-cli/build] Git information could not be read for {base}: {source}")]
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
    /// Validation counts, warnings, and retained Changes for the M12/M9 join.
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
    /// Shared base preparation and comparison service.
    pub changes: Arc<dyn ChangesService>,
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
        let parent = tracing::Span::current();
        let result = std::thread::scope(|scope| {
            let thread = match std::thread::Builder::new()
                .name("mokly-build".into())
                .stack_size(64 * 1024 * 1024)
                .spawn_scoped(scope, || parent.in_scope(|| self.attempt(cwd, options)))
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
    pub(crate) fn checkpoint(&self) -> Result<(), BuildError> {
        if self.cancellation.requested() {
            Err(BuildError::Cancelled)
        } else {
            Ok(())
        }
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
