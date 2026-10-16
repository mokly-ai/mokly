//! Check cancellation around the retained Changes result and its warning policy.

use std::sync::Arc;

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::diagnostic::Warning;
use mokly_compare::base_render::selected_base;
use mokly_graph::types::RenderGeneration;

use crate::build::{BuildChanges, BuildError, CatalogueBuild};
use crate::changes_diagnostics;
use crate::grammar::Build;

impl CatalogueBuild {
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
            match self
                .changes
                .classify(config, options.common.base.as_deref(), generation)
            {
                Ok(result) => {
                    warnings.extend(result.warnings.iter().cloned());
                    BuildChanges::Ready(Arc::new(result))
                }
                Err(source) => {
                    warnings.extend(changes_diagnostics::warnings(&source));
                    if let Some(unavailable) = changes_diagnostics::unavailable(&source) {
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
        Ok(changes)
    }
}
