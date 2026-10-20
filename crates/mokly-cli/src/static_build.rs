//! CLI composition between rendered catalogues, static assembly, and transactions.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::upload::Publication;
use mokly_static::assembly::{Assembler, Assembly};
use mokly_static::changes::PublicationInput;
use mokly_static::error;
use mokly_static::fingerprint::InputTree;
use mokly_static::transaction::{self, Transaction};

use crate::build::{BuildChanges, BuildError, BuildService, BuildSummary};
use crate::cancellation::Cancellation;
use crate::grammar::Build;
use crate::pre_installation;

/// One-shot phase reporting shared by build and publish.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Phase {
    /// Load the configuration once.
    Configuration,
    /// Prepare and render every current document.
    Rendering,
    /// Resolve the selected comparison.
    Comparing(String),
    /// Assemble and write the completed output.
    Writing,
    /// Validate and compress immutable upload bytes.
    PreparingUpload,
    /// Run exchange v1.
    Uploading,
}

/// Phase notifications contain no source payloads or secrets.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = PhasesMock))]
pub trait Phases: Send + Sync {
    /// Complete the earlier phase and begin this phase.
    fn start(&self, phase: Phase);
    /// Emit consumer diagnostics through the same terminal owner.
    fn diagnostic(&self, message: &str);
    /// Emit a formatted stdout note under the phase reporter lock.
    fn note(&self, message: &str);
    /// Print validation warnings before installation and before a summary.
    fn warnings(&self, warnings: &[mokly_catalogue::diagnostic::Warning]);
    /// Report the retained comparison result and historical diagnostics.
    fn changes(&self, changes: &BuildChanges);
}

/// Render lifecycle drained before installation, even on failure.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DrainMock))]
pub trait Drain: Send + Sync {
    /// Stop render work and sidecars before the transaction's commit point.
    fn stop(&self) -> Result<(), BuildError>;
}

/// Static command inputs that do not belong to the render graph.
pub struct Request<'a> {
    /// Invocation directory.
    pub cwd: &'a Path,
    /// Already loaded configuration.
    pub config: &'a ResolvedConfig,
    /// Normalized build grammar.
    pub options: &'a Build,
    /// Exact matching viewer package bytes.
    pub viewer: Vec<File>,
    /// Git root for upload configuration identity.
    pub repository: &'a Path,
    /// Publication metadata context, excluding browser identity.
    pub publication: Option<Publication>,
    /// Publication warnings are fatal according to the isolated policy.
    pub warnings_are_fatal: bool,
}

/// Wall clock read only at publication metadata finalization.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = TimestampMock))]
pub trait Timestamp: Send + Sync {
    /// UTC with exact millisecond precision.
    fn now(&self) -> String;
}

/// Unified build pipeline used by both public verbs.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = StaticBuildMock))]
pub trait StaticBuild: Send + Sync {
    /// Install output and return the very same immutable artifact.
    fn build(
        &self,
        request: Request<'_>,
        transaction: &mut dyn Transaction,
    ) -> Result<(Artifact, BuildSummary), BuildError>;
}

/// CLI-owned composition of independent static and render services.
pub struct Builder {
    /// Complete catalogue rendering.
    pub render: Arc<dyn BuildService>,
    /// Output projection from the generation.
    pub assembler: Arc<dyn Assembler>,
    /// Exact read set from config, discovery, graph, and closure.
    pub inputs: Arc<dyn InputTree>,
    /// Signals shared by all phases.
    pub cancellation: Arc<dyn Cancellation>,
    /// Sidecar lifecycle.
    pub drain: Arc<dyn Drain>,
    /// Publication finalization clock.
    pub timestamp: Arc<dyn Timestamp>,
    /// Command output phases.
    pub phases: Arc<dyn Phases>,
}

impl StaticBuild for Builder {
    fn build(
        &self,
        request: Request<'_>,
        transaction: &mut dyn Transaction,
    ) -> Result<(Artifact, BuildSummary), BuildError> {
        let recovery_path = transaction.recovery_path().to_owned();
        let result = pre_installation::settle(
            self.prepare(&request, transaction),
            self.cancellation.as_ref(),
        );
        let stopped = self.drain.stop();
        let result = match (result, stopped) {
            (Ok(value), Ok(())) => Ok(value),
            (Err(primary), Err(shutdown)) => Err(BuildError::Shutdown {
                primary: Box::new(primary),
                shutdown: Box::new(shutdown),
            }),
            (Err(error), Ok(())) | (Ok(_), Err(error)) => Err(error),
        };
        let _protection = self
            .cancellation
            .protect_output()
            .ok_or(BuildError::Cancelled)?;
        match result {
            Ok((artifact, summary)) => {
                static_result(
                    transaction.install(&StaticCancellation(self.cancellation.as_ref())),
                )?;
                Ok((artifact, summary))
            }
            Err(primary) => match transaction.abandon() {
                Ok(()) => Err(primary),
                Err(cleanup) => Err(BuildError::Cleanup {
                    primary: Box::new(primary),
                    cleanup: Box::new(cleanup),
                    path: recovery_path,
                }),
            },
        }
    }
}

impl Builder {
    fn prepare(
        &self,
        request: &Request<'_>,
        transaction: &mut dyn Transaction,
    ) -> Result<(Artifact, BuildSummary), BuildError> {
        let excluded = vec![transaction.output().into()];
        static_result(self.inputs.begin(request.config, &excluded))?;
        self.phases.start(Phase::Rendering);
        let rendered = self.render.prepare(request.cwd, request.options)?;
        let protected = rendered
            .generation
            .catalogue()
            .model
            .sources
            .iter()
            .map(|path| request.config.repo_root.join(path))
            .collect();
        static_result(transaction.protect(protected))?;
        self.phases.warnings(&rendered.summary.warnings);
        if !matches!(rendered.summary.changes, BuildChanges::Disabled) {
            self.phases.changes(&rendered.summary.changes);
        }
        if request.warnings_are_fatal && !rendered.summary.warnings.is_empty() {
            return Err(BuildError::Warnings);
        }
        self.phases.start(Phase::Writing);
        let publication = request
            .publication
            .as_ref()
            .map(|identity| PublicationInput {
                identity: identity.clone(),
                config_path: relative(&request.config.file, request.repository),
                exported_at: self.timestamp.now(),
            });
        let artifact = static_result(self.assembler.assemble(
            Assembly {
                config: request.config,
                generation: rendered.generation.as_ref(),
                config_path: relative(&request.config.file, &request.config.repo_root),
                directory: transaction.output().into(),
                viewer: request.viewer.clone(),
                changes: &rendered.summary.changes,
                publication,
            },
            &StaticCancellation(self.cancellation.as_ref()),
        ))?;
        static_result(
            transaction.stage(&artifact, &StaticCancellation(self.cancellation.as_ref())),
        )?;
        static_result(self.inputs.verify())?;
        Ok((artifact, rendered.summary))
    }
}

fn static_result<T>(result: error::Result<T>) -> Result<T, BuildError> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(BuildError::Static { source }),
    }
}
/// Static transaction adapter shares the command's delivered signal state.
pub struct StaticCancellation<'a>(pub &'a dyn Cancellation);
impl transaction::Cancellation for StaticCancellation<'_> {
    fn requested(&self) -> bool {
        self.0.drain();
        self.0.requested()
    }
}

#[cfg(test)]
#[path = "_tests_/static_build/mod.rs"]
mod tests;
