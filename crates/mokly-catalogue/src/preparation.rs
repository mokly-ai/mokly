//! Catalogue preparation orchestration over injected discovery and description boundaries.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::Arc;

use mokly_model::axes::ColorScheme;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::CatalogueModel;
use mokly_source_interface::tree::SourceTree;

use crate::config::relative;
use crate::config_types::ResolvedConfig;
use crate::config_warnings;
use crate::control_warnings;
use crate::definition_provider::DefinitionProvider;
use crate::diagnostic::{Code, Issue, Warning, normalize_warnings};
use crate::discovery::{Discovery, Inventory, SourceKind};
use crate::error::{CatalogueError, Result};
use crate::locations::at;
use crate::numeric_warnings;
use crate::prepare_sources::{append, canonical_order, duplicate_indices};
use crate::render_sources::JavaScriptCatalogue;
use crate::template_types::{ElementRegistry, Template};
use crate::validate_templates;
use crate::{documents, folders, identity, links, moves, parsing, registry, relationships};

/// Prepared private catalogue, with render sources kept out of every public shape.
#[derive(Clone, Debug)]
pub struct PreparedCatalogue {
    /// Validated in-memory catalogue model.
    pub model: CatalogueModel,
    /// Resolved source set reused by rendering and watch.
    pub inventory: Inventory,
    /// Parent HTML bodies. Variants reuse their parent's body.
    pub templates: BTreeMap<String, Template>,
    /// Markdown bodies, with BOM and front matter removed.
    pub documents: BTreeMap<String, String>,
    /// Saved variant slot fragments, kept private.
    pub slot_fragments: BTreeMap<String, BTreeMap<String, crate::template_types::SavedSlot>>,
    /// One shared HTML and JavaScript component namespace.
    pub elements: ElementRegistry,
    /// JavaScript sources awaiting the Milestone 8 sidecar implementation.
    pub deferred_modules: Vec<String>,
    /// Private JavaScript handles, bundle inputs, and saved React slots.
    pub javascript: JavaScriptCatalogue,
    /// Repository-relative dependency directories reached by this generation's completed bundles.
    pub dependency_directories: BTreeSet<String>,
    /// Sorted unique non-fatal warnings.
    pub warnings: Vec<Warning>,
}

/// Non-pure preparation boundary, consumed through `dyn CatalogueBuilder`.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CatalogueBuilderMock))]
pub trait CatalogueBuilder: Send + Sync {
    /// Discover, describe, parse, and validate one source-tree pass.
    fn prepare(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<PreparedCatalogue>;
}

/// Catalogue coordinator with no direct filesystem or sidecar dependency.
pub struct Builder {
    /// Read-only working or Git tree.
    pub tree: Arc<dyn SourceTree>,
    /// Once-per-pass root inventory.
    pub discovery: Arc<dyn Discovery>,
    /// JavaScript description provider for selected modules or a configured renderer.
    pub definitions: Arc<dyn DefinitionProvider>,
}

impl CatalogueBuilder for Builder {
    fn prepare(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<PreparedCatalogue> {
        let inventory = self.discovery.discover(config, output)?;
        self.validate(config, inventory)
    }
}

impl Builder {
    #[tracing::instrument(name = "catalogue.validate", skip_all, err)]
    fn validate(&self, config: &ResolvedConfig, inventory: Inventory) -> Result<PreparedCatalogue> {
        let paths: Vec<_> = inventory
            .files
            .iter()
            .filter(|file| !file.excluded)
            .map(|file| file.absolute.clone())
            .collect();
        if let Err(source) = self.tree.prefetch(&paths) {
            return Err(CatalogueError::Config(Issue::new(
                Code::ConfigInvalid,
                format!("source prefetch failed: {}", source.code()),
            )));
        }
        let schemes = config
            .input
            .color_schemes
            .clone()
            .unwrap_or_else(|| vec![ColorScheme::Light]);
        let mut prepared = PreparedCatalogue {
            model: CatalogueModel {
                entries: Vec::new(),
                folders: inventory
                    .folders
                    .iter()
                    .map(|folder| folder.record.clone())
                    .collect(),
                sources: inventory.sources.clone(),
                color_schemes: schemes.clone(),
            },
            inventory,
            templates: BTreeMap::new(),
            documents: BTreeMap::new(),
            slot_fragments: BTreeMap::new(),
            elements: BTreeMap::new(),
            deferred_modules: Vec::new(),
            javascript: JavaScriptCatalogue::default(),
            dependency_directories: BTreeSet::new(),
            warnings: Vec::new(),
        };
        let mut failed = BTreeSet::new();
        let mut markdown_targets = BTreeMap::new();
        let mut issues = duplicate_indices(&prepared.inventory.files);
        for file in &prepared.inventory.files.clone() {
            if file.excluded {
                continue;
            }
            if matches!(file.kind, SourceKind::Module | SourceKind::Stories) {
                prepared.deferred_modules.push(file.path.clone());
                continue;
            }
            let bytes = match self.tree.read(&file.absolute) {
                Ok(bytes) => bytes,
                Err(error) => {
                    return Err(CatalogueError::Config(Issue::new(
                        Code::ConfigInvalid,
                        format!("{}: {}", file.path, error.code()),
                    )));
                }
            };
            let text = match String::from_utf8(bytes) {
                Ok(text) => text,
                Err(error) => {
                    issues.push(
                        Issue::new(
                            if file.kind == SourceKind::Document {
                                Code::DocumentFrontMatter
                            } else {
                                Code::HtmlFrontMatter
                            },
                            if file.kind == SourceKind::Document {
                                format!("{}: front matter file must be UTF-8", file.path)
                            } else {
                                format!("{} must be UTF-8", file.path)
                            },
                        )
                        .at(at(
                            &file.path,
                            &String::from_utf8_lossy(error.as_bytes()),
                            error.utf8_error().valid_up_to(),
                        )),
                    );
                    continue;
                }
            };
            let parsed = if file.kind == SourceKind::Document {
                documents::parse(text, &file.path)
            } else {
                parsing::parse(text, &file.path, file.kind)
            };
            match parsed {
                Ok(parsed) => {
                    if file.kind == SourceKind::Document {
                        markdown_targets.insert(
                            file.path.clone(),
                            links::markdown(&parsed.text, parsed.body_offset, &file.path),
                        );
                    }
                    append(
                        &mut prepared,
                        parsed,
                        file,
                        config,
                        &mut issues,
                        &mut failed,
                    );
                }
                Err(issue) => issues.push(issue),
            }
        }
        self.append_definitions(&mut prepared, config, &mut failed, &mut issues)?;
        if config.file.starts_with(&config.repo_root) {
            prepared
                .model
                .sources
                .push(relative(&config.file, &config.repo_root));
        }
        prepared.model.sources.extend(
            config
                .authored_inputs
                .iter()
                .map(|path| relative(path, &config.repo_root)),
        );
        prepared.model.sources.sort_by(|a, b| compare_utf16(a, b));
        prepared.model.sources.dedup();
        issues.extend(identity::collisions(&prepared.model.entries));
        issues.extend(moves::validate(&prepared.model.entries));
        issues.extend(relationships::validate(
            &mut prepared.model.entries,
            &failed,
        ));
        issues.extend(folders::validate(
            &prepared.model.folders,
            &prepared.model.entries,
        ));
        let (elements, registration_issues) = registry::register(&prepared.model.entries);
        prepared.elements = elements;
        issues.extend(registration_issues);
        issues.extend(validate_templates::validate(
            &mut prepared,
            &failed,
            &markdown_targets,
        ));
        prepared.warnings.extend(config_warnings::collect(config));
        prepared
            .warnings
            .extend(control_warnings::collect(&prepared.model.entries));
        prepared
            .warnings
            .extend(numeric_warnings::collect(&prepared.model.entries));
        normalize_warnings(&mut prepared.warnings);
        if !issues.is_empty() {
            return Err(CatalogueError::Invalid {
                issues,
                warnings: prepared.warnings,
            });
        }
        canonical_order(&mut prepared.model.entries);
        prepared
            .model
            .folders
            .sort_by(|a, b| compare_utf16(&a.path, &b.path));
        tracing::debug!(
            entries = prepared.model.entries.len(),
            sources = prepared.model.sources.len(),
            "catalogue prepared"
        );
        Ok(prepared)
    }
}

#[cfg(test)]
#[path = "_tests_/reference_tests.rs"]
mod reference_tests;
