//! Check cancellation around the retained Changes result and its warning policy.

use std::path::Path;
use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_compare::base_render::selected_base;
use mokly_compare::comparison_types::ComparisonResult;
use mokly_compare::error::Error;
use mokly_graph::error::GraphError;
use mokly_graph::types::RenderGeneration;
use mokly_model::public_metadata::ChangesStatus;
use mokly_static::changes::ChangeState;
use mokly_static::error;

use crate::build::{BuildChanges, BuildError, CatalogueBuild};
use crate::changes_diagnostics;
use crate::grammar::Build;

impl CatalogueBuild {
    #[tracing::instrument(name = "changes.classify", skip_all, fields(status = "error"))]
    pub(crate) fn classify_changes(
        &self,
        config: &ResolvedConfig,
        options: &Build,
        generation: Arc<dyn RenderGeneration>,
        warnings: &mut Vec<Warning>,
    ) -> Result<BuildChanges, BuildError> {
        self.checkpoint()?;
        let changes = if options.no_changes {
            BuildChanges::Disabled
        } else {
            match self.changes.classify(
                config,
                options.common.base.as_deref(),
                generation,
                options.common.base_install_scripts_override(),
            ) {
                Ok(result) => {
                    warnings.extend(result.warnings.iter().cloned());
                    BuildChanges::Ready(Arc::new(result))
                }
                Err(source) => {
                    if self.inputs.is_some()
                        && let Some(path) = changed_input(&source)
                    {
                        return Err(BuildError::Static {
                            source: error::Error::InputsChanged { path: path.into() },
                        });
                    }
                    if let Some(inputs) = &self.inputs
                        && let Err(source) = inputs.verify()
                    {
                        return Err(BuildError::Static { source });
                    }
                    warnings.extend(changes_diagnostics::warnings(&source));
                    if let Some(unavailable) = changes_diagnostics::unavailable(
                        &source,
                        selected_base(config, options.common.base.as_deref()),
                    ) {
                        unavailable
                    } else {
                        return Err(BuildError::Comparison {
                            base_ref: selected_base(config, options.common.base.as_deref()).into(),
                            source: Box::new(source),
                            warnings: warnings.clone(),
                        });
                    }
                }
            }
        };
        self.checkpoint()?;
        tracing::Span::current().record("status", "ok");
        Ok(changes)
    }
}

fn changed_input(error: &Error) -> Option<&Path> {
    match error {
        Error::Base { source, .. } => changed_input(source),
        Error::SourceFailure { source } => changed_input(source),
        Error::Graph {
            source: GraphError::InputsChanged { path },
        } => Some(path),
        _ => None,
    }
}

impl ChangeState for BuildChanges {
    fn status(&self) -> ChangesStatus {
        match self {
            Self::Disabled => ChangesStatus::Disabled,
            Self::Ready(_) => ChangesStatus::Ready,
            Self::Unavailable { .. } => ChangesStatus::Unavailable,
        }
    }
    fn base(&self) -> Option<&str> {
        match self {
            Self::Disabled => None,
            Self::Ready(result) => Some(&result.snapshot.base_ref),
            Self::Unavailable { base_ref, .. } => Some(base_ref),
        }
    }
    fn ready(&self) -> Option<&ComparisonResult> {
        match self {
            Self::Ready(result) => Some(result),
            _ => None,
        }
    }
}
