//! Attach described JavaScript definitions to the shared preparation pass.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use mokly_source_interface::tree::FileKind;

use crate::config::{relative, traversal};
use crate::config_types::ResolvedConfig;
use crate::diagnostic::{Code, Issue};
use crate::discovery::SourceKind;
use crate::error::Result;
use crate::identity;
use crate::input::ParsedEntry;
use crate::preparation::{Builder, PreparedCatalogue};
use crate::prepare_entry;
use crate::provided_entries;
use crate::yaml::Document;

impl Builder {
    pub(crate) fn append_definitions(
        &self,
        prepared: &mut PreparedCatalogue,
        config: &ResolvedConfig,
        failed: &mut BTreeSet<String>,
        issues: &mut Vec<Issue>,
    ) -> Result<()> {
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
            let described = self.definitions.describe(config, &javascript)?;
            if !described.deferred {
                prepared.deferred_modules.clear();
            }
            prepared.model.folders.extend(described.folders);
            prepared.javascript.generation = described.generation;
            prepared.javascript.bindings = described.bindings;
            prepared.warnings.extend(described.warnings);
            issues.extend(described.issues);
            let mut pending = Vec::new();
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
                        if node.kind == FileKind::File
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
                    issues: definition
                        .rendering
                        .issues
                        .iter()
                        .map(|diagnostic| {
                            let mut issue = diagnostic.issue.clone();
                            if let Some(slug) = &diagnostic.variant
                                && let Ok((path, _)) = identity::derive(
                                    &definition.input,
                                    file,
                                    &config.roots[file.root_index],
                                    &definition.source,
                                )
                            {
                                issue.entry_path = Some(format!("{path}/{slug}"));
                            }
                            issue
                        })
                        .collect(),
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
                    definition.source.clone(),
                    &prepared.model.color_schemes,
                ) {
                    Ok(mut result) => {
                        for issue in &mut result.issues {
                            if let Some(location) = &mut issue.location {
                                if location.export.is_none() {
                                    location.export = definition.source.export.clone();
                                }
                            } else {
                                issue.location = Some(definition.source.clone());
                            }
                        }
                        if let Some(parent) = result.entries.first() {
                            pending
                                .push((parent.metadata.path.clone(), definition.rendering.clone()));
                        }
                        provided_entries::attach(
                            prepared,
                            &mut result.entries,
                            &definition.rendering,
                        );
                        if result.failed {
                            failed.extend(
                                result
                                    .entries
                                    .iter()
                                    .map(|entry| entry.metadata.path.clone()),
                            );
                        }
                        prepared.model.entries.extend(result.entries);
                        issues.extend(result.issues);
                    }
                    Err(issue) => issues.push(issue),
                }
            }
            provided_entries::references(prepared, &pending, issues);
        }
        Ok(())
    }
}
