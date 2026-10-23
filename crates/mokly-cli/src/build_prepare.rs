//! Capture current inputs, render both sides, and retain comparison before output.

use std::collections::BTreeMap;
use std::path::Path;

use crate::build::{BuildError, BuildSummary, CatalogueBuild, PreparedBuild, strict_count};
use crate::grammar::Build;

impl CatalogueBuild {
    pub(crate) fn attempt(&self, cwd: &Path, options: &Build) -> Result<PreparedBuild, BuildError> {
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
        if let Some(inputs) = &self.inputs {
            let catalogue = generation.catalogue();
            let empty = BTreeMap::new();
            let digests = catalogue
                .javascript
                .generation
                .as_ref()
                .map_or(&empty, |generation| &generation.module_digests);
            if let Err(source) =
                inputs.capture(&config.repo_root, &catalogue.model.sources, digests)
            {
                return Err(BuildError::Static { source });
            }
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
        let mut warnings = rendered.warnings;
        let changes = self.classify_changes(&config, options, generation.clone(), &mut warnings)?;
        self.checkpoint()?;
        mokly_catalogue::diagnostic::normalize_warnings(&mut warnings);
        if options.strict && strict_count(&warnings) > 0 {
            return Err(BuildError::Strict { warnings });
        }
        let mut counts = BTreeMap::new();
        for entry in &prepared.model.entries {
            *counts.entry(entry.content.kind()).or_default() += 1;
        }
        Ok(PreparedBuild {
            config,
            generation,
            summary: BuildSummary {
                changes,
                documents: rendered.documents,
                counts,
                warnings,
                deferred_modules: prepared.deferred_modules,
            },
        })
    }
}
