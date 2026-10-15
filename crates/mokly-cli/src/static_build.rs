//! CLI composition between rendered catalogues, static assembly, and transactions.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config::relative;
use mokly_catalogue::config_types::ResolvedConfig;
use mokly_model::output::artifact::{Artifact, File};
use mokly_model::output::upload::{BuildInventory, Publication};
use mokly_static::assembly::{Assembler, Assembly};
use mokly_static::error;
use mokly_static::fingerprint::{Fingerprints, InputTree};
use mokly_static::input_selection;
use mokly_static::location::Boundary;
use mokly_static::transaction::{Cancellation, Transaction, Transactions};

use crate::build::{BuildError, BuildService, BuildSummary};
use crate::grammar::Build;

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
    /// Print validation warnings before installation and before a summary.
    fn warnings(&self, warnings: &[mokly_catalogue::diagnostic::Warning]);
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
    /// Private parent for publish, repository root for build.
    pub allowed: &'a Path,
    /// Git root for upload configuration identity.
    pub repository: &'a Path,
    /// Publication metadata context, excluding browser identity.
    pub publication: Option<Publication>,
    /// Package and executable directories protected from output replacement.
    pub runtime_directories: Vec<std::path::PathBuf>,
}

/// Wall clock read only at publication metadata finalization.
pub trait Timestamp: Send + Sync {
    /// UTC with exact millisecond precision.
    fn now(&self) -> String;
}

/// Unified build pipeline used by both public verbs.
pub trait StaticBuild: Send + Sync {
    /// Install output and return the very same immutable artifact.
    fn build(&self, request: Request<'_>) -> Result<(Artifact, BuildSummary), BuildError>;
}

/// CLI-owned composition of independent static and render services.
pub struct Builder {
    /// Complete catalogue rendering.
    pub render: Arc<dyn BuildService>,
    /// Safe output ownership and replacement.
    pub transactions: Arc<dyn Transactions>,
    /// Output projection from the generation.
    pub assembler: Arc<dyn Assembler>,
    /// Live source membership hash boundary.
    pub fingerprints: Arc<dyn Fingerprints>,
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
    fn build(&self, request: Request<'_>) -> Result<(Artifact, BuildSummary), BuildError> {
        let output = mokly_static::location::output(request.config, request.options.out.as_deref());
        let mut boundary = Boundary::catalogue(request.config, request.allowed.into());
        boundary.roots.extend(request.runtime_directories.clone());
        let mut transaction = static_result(self.transactions.open(&output, boundary))?;
        let recovery_path = transaction.recovery_path().to_owned();
        let result = self.prepare(&request, transaction.as_mut());
        let result = match result {
            Err(source) if self.cancellation.requested() => Err(BuildError::Interrupted {
                source: Box::new(source),
            }),
            Ok(_) if self.cancellation.requested() => Err(BuildError::Cancelled),
            result => result,
        };
        let stopped = self.drain.stop();
        let result = match (result, stopped) {
            (Ok(value), Ok(())) => Ok(value),
            (Err(primary), Err(cleanup)) => Err(BuildError::Static {
                source: error::Error::Recovery {
                    primary: Box::new(build_cause(primary)),
                    cleanup: Box::new(build_cause(cleanup)),
                    path: recovery_path.clone(),
                },
            }),
            (Err(error), Ok(())) | (Ok(_), Err(error)) => Err(error),
        };
        match result {
            Ok((artifact, summary)) => {
                static_result(transaction.install(self.cancellation.as_ref()))?;
                Ok((artifact, summary))
            }
            Err(primary) => match transaction.abandon() {
                Ok(()) => Err(primary),
                Err(cleanup) => Err(BuildError::Static {
                    source: error::Error::Recovery {
                        primary: Box::new(build_cause(primary)),
                        cleanup: Box::new(cleanup),
                        path: recovery_path,
                    },
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
        let before = static_result(
            self.fingerprints
                .capture(&request.config.repo_root, &excluded),
        )?;
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
        let base = if request.options.no_changes {
            None
        } else {
            Some(
                request
                    .options
                    .common
                    .base
                    .clone()
                    .or_else(|| {
                        request
                            .config
                            .input
                            .review
                            .as_ref()
                            .and_then(|review| review.base.clone())
                    })
                    .unwrap_or_else(|| "origin/main".into()),
            )
        };
        self.phases.start(Phase::Writing);
        let metadata = if let Some(publication) = &request.publication {
            let inventory = BuildInventory {
                config_path: relative(&request.config.file, request.repository),
                exported_at: self.timestamp.now(),
                comparison: None,
            };
            match publication.metadata(&inventory) {
                Ok(metadata) => Some(metadata),
                Err(source) => {
                    return Err(BuildError::Static {
                        source: error::InternalError::Format { source }.into(),
                    });
                }
            }
        } else {
            None
        };
        let artifact = static_result(self.assembler.assemble(
            Assembly {
                config: request.config,
                generation: rendered.generation.as_ref(),
                config_path: relative(&request.config.file, &request.config.repo_root),
                directory: transaction.output().into(),
                viewer: request.viewer.clone(),
                base,
                metadata,
            },
            self.cancellation.as_ref(),
        ))?;
        static_result(transaction.stage(&artifact, self.cancellation.as_ref()))?;
        static_result(self.inputs.verify())?;
        let after = static_result(
            self.fingerprints
                .capture(&request.config.repo_root, &excluded),
        )?;
        static_result(input_selection::verify(
            request.config,
            &rendered.generation.catalogue().model.sources,
            &rendered.generation.public_files(),
            &before,
            &after,
        ))?;
        Ok((artifact, rendered.summary))
    }
}

fn static_result<T>(result: error::Result<T>) -> Result<T, BuildError> {
    match result {
        Ok(value) => Ok(value),
        Err(source) => Err(BuildError::Static { source }),
    }
}
fn build_cause(error: BuildError) -> error::Error {
    match error {
        BuildError::Static { source } => source,
        BuildError::Cancelled => error::Error::Cancelled,
        error => error::Error::Primary {
            source: Box::new(error),
        },
    }
}
