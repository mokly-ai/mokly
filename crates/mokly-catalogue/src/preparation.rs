//! Catalogue preparation orchestration over injected discovery and description boundaries.

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Arc;

use mokly_model::axes::ColorScheme;
use mokly_model::canonical::compare_utf16;
use mokly_model::catalogue::CatalogueModel;
use mokly_source_interface::tree::SourceTree;

use crate::config::{relative, traversal};
use crate::config_types::ResolvedConfig;
use crate::definition_provider::DefinitionProvider;
use crate::diagnostic::{Code, Issue, Warning, normalize_warnings};
use crate::discovery::{Discovery, Inventory, SourceKind};
use crate::error::{CatalogueError, Result};
use crate::input::ParsedEntry;
use crate::prepare_sources::{append, canonical_order, duplicate_indices};
use crate::template_types::{ElementRegistry, Template};
use crate::validate_templates;
use crate::yaml::Document;
use crate::{documents, folders, identity, moves, parsing, prepare_entry, registry, relationships};

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
    pub slot_fragments: BTreeMap<String, BTreeMap<String, String>>,
    /// One shared HTML and JavaScript component namespace.
    pub elements: ElementRegistry,
    /// JavaScript sources awaiting the Milestone 8 sidecar implementation.
    pub deferred_modules: Vec<String>,
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
    /// JavaScript description provider, called only when selected files need it.
    pub definitions: Arc<dyn DefinitionProvider>,
}

impl CatalogueBuilder for Builder {
    fn prepare(&self, config: &ResolvedConfig, output: Option<&Path>) -> Result<PreparedCatalogue> {
        let inventory = self.discovery.discover(config, output)?;
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
            warnings: Vec::new(),
        };
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
                Err(_) => {
                    issues.push(Issue::new(
                        Code::HtmlFrontMatter,
                        format!("{} must be UTF-8", file.path),
                    ));
                    continue;
                }
            };
            let parsed = if file.kind == SourceKind::Document {
                documents::parse(text, &file.path)
            } else {
                parsing::parse(text, &file.path, file.kind)
            };
            match parsed {
                Ok(parsed) => append(&mut prepared, parsed, file, config, &mut issues),
                Err(issue) => issues.push(issue),
            }
        }
        let javascript: Vec<_> = prepared
            .inventory
            .files
            .iter()
            .filter(|file| {
                !file.excluded && matches!(file.kind, SourceKind::Module | SourceKind::Stories)
            })
            .cloned()
            .collect();
        if !javascript.is_empty() {
            let described = self.definitions.describe(&javascript)?;
            if !described.deferred {
                prepared.deferred_modules.clear();
            }
            prepared.model.folders.extend(described.folders);
            for source in described.sources {
                if traversal(&source) || Path::new(&source).is_absolute() {
                    issues.push(Issue::new(
                        Code::ConfigInvalid,
                        format!("invalid inventoried source {source}"),
                    ));
                    continue;
                }
                let source_path = config.repo_root.join(&source);
                match self.tree.project(&source_path) {
                    Ok(Some(node))
                        if node.kind == mokly_source_interface::tree::FileKind::File
                            && node.identity.starts_with(&config.repo_root) =>
                    {
                        prepared
                            .model
                            .sources
                            .extend([source, relative(&node.identity, &config.repo_root)]);
                    }
                    _ => issues.push(Issue::new(
                        Code::ConfigInvalid,
                        format!(
                            "inventoried source {source} must be a regular file inside repoRoot"
                        ),
                    )),
                }
            }
            for definition in described.entries {
                let Some(file) = javascript
                    .iter()
                    .find(|file| file.path == definition.exporting_file)
                else {
                    issues.push(Issue::new(
                        Code::InvalidMetadata,
                        "definition is not exported by a resolved entry module",
                    ));
                    continue;
                };
                if !prepared.model.sources.contains(&definition.source.path) {
                    issues.push(Issue::new(
                        Code::InvalidMetadata,
                        "definition source is not inventoried",
                    ));
                    continue;
                }
                let parsed = ParsedEntry {
                    input: definition.input,
                    document: Document {
                        value: serde_json::Value::Null,
                        positions: BTreeMap::new(),
                    },
                    body: String::new(),
                    body_offset: 0,
                    text: String::new(),
                };
                match prepare_entry::prepare(
                    &parsed,
                    file,
                    &config.roots[file.root_index],
                    definition.kind,
                    definition.source,
                    &schemes,
                ) {
                    Ok((entries, errors)) => {
                        prepared.model.entries.extend(entries);
                        issues.extend(errors);
                    }
                    Err(issue) => issues.push(issue),
                }
            }
        }
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
        issues.extend(relationships::validate(&mut prepared.model.entries));
        issues.extend(folders::validate(
            &prepared.model.folders,
            &prepared.model.entries,
        ));
        let (elements, registration_issues) = registry::register(&prepared.model.entries);
        prepared.elements = elements;
        issues.extend(registration_issues);
        issues.extend(validate_templates::validate(&mut prepared));
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
