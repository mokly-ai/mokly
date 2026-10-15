//! Describe feeds every exported definition into the catalogue's one validator.

use mokly_catalogue::config_types::ResolvedConfig;
use mokly_catalogue::definition_provider::Definitions;
use mokly_catalogue::discovery::{SourceFile, SourceKind};
use mokly_catalogue::render_sources::{DefinitionIssue, ResolvedDefinition};
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::FolderRecord;

use crate::error::Result;
use crate::runtime::Runtime;
use crate::{bundle, definition_input, diagnostics};

pub(crate) fn describe(
    runtime: &Runtime,
    config: &ResolvedConfig,
    files: &[SourceFile],
) -> Result<Definitions> {
    if files.is_empty() {
        return Ok(Definitions::default());
    }
    let (generation, described) = bundle::describe(runtime, config, files)?;
    let mut result = Definitions {
        sources: generation
            .modules
            .keys()
            .filter(|path| !path.split('/').any(|part| part == "node_modules"))
            .cloned()
            .collect(),
        generation: Some(generation),
        ..Default::default()
    };
    let mut diagnostics = described.diagnostics;
    if let Some(warning) = runtime.base_warning() {
        result.warnings.push(warning);
    }
    for (kind, definitions) in [
        (EntryKind::Screen, described.screens),
        (EntryKind::Component, described.components),
        (EntryKind::Page, described.pages),
        (EntryKind::UseCase, described.use_cases),
    ] {
        for definition in definitions {
            let story = files.iter().any(|file| {
                file.kind == SourceKind::Stories
                    && definition.handle.starts_with(&format!("{}#", file.path))
            });
            let mut entry = definition_input::entry(&definition, kind, story)?;
            let (owned, remaining): (Vec<_>, Vec<_>) =
                diagnostics.into_iter().partition(|diagnostic| {
                    diagnostic.module == entry.exporting_file
                        && diagnostic.export_name == entry.source.export
                });
            diagnostics = remaining;
            entry.rendering.issues = owned
                .iter()
                .map(|diagnostic| DefinitionIssue {
                    variant: diagnostic.variant_slug.clone(),
                    issue: diagnostics::issue(diagnostic),
                })
                .collect();
            if story {
                for variant in &definition.variants {
                    let id = format!("{}#{}", entry.exporting_file, variant.slug);
                    if let Some(story) = described.stories.iter().find(|story| story.id == id) {
                        entry.rendering.story_hints.insert(
                            variant.slug.clone(),
                            story
                                .arg_types
                                .iter()
                                .map(|(key, hint)| (key.clone(), definition_input::hint(hint)))
                                .collect(),
                        );
                    }
                }
            }
            result.entries.push(entry);
        }
    }
    for definition in described.folders {
        let source = definition_input::location(&definition);
        let path = definition.metadata.path.clone().unwrap_or_default();
        result.bindings.insert(
            definition.handle,
            ResolvedDefinition {
                path: path.clone(),
                title: definition
                    .metadata
                    .title
                    .clone()
                    .unwrap_or_else(|| path.clone()),
            },
        );
        result.folders.push(FolderRecord {
            path,
            title: definition.metadata.title,
            order: definition.order,
            hidden: definition.hidden,
            source,
        });
    }
    result
        .issues
        .extend(diagnostics.iter().map(diagnostics::issue));
    Ok(result)
}
