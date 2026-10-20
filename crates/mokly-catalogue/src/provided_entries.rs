//! Resolve provider metadata only after the exporting file determines entry paths.

use std::collections::BTreeMap;

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::controls::{ControlInput, ControlOption};
use mokly_model::prop_schema::Primitive;

use crate::declared_controls;
use crate::diagnostic::{Code, Issue, Warning, WarningSubject};
use crate::numeric_warnings;
use crate::preparation::PreparedCatalogue;
use crate::render_sources::{EntryReference, ProvidedRendering, ResolvedDefinition};

pub(crate) fn attach(
    prepared: &mut PreparedCatalogue,
    entries: &mut [ModelEntry],
    rendering: &ProvidedRendering,
) {
    let Some(parent) = entries.first().map(|entry| entry.metadata.path.clone()) else {
        return;
    };
    for entry in entries {
        let slug = entry
            .metadata
            .path
            .strip_prefix(&format!("{parent}/"))
            .unwrap_or("");
        if let Some(source) = rendering.entries.get(slug) {
            if slug.is_empty() {
                prepared.javascript.bindings.insert(
                    source.handle.clone(),
                    ResolvedDefinition {
                        path: entry.metadata.path.clone(),
                        title: entry.metadata.title.clone(),
                    },
                );
            }
            prepared
                .javascript
                .entries
                .insert(entry.metadata.path.clone(), source.clone());
        }
        if let Some(hints) = rendering.story_hints.get(slug) {
            let visual = match &mut entry.content {
                EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
                    visual
                }
                _ => continue,
            };
            for (key, hint) in hints {
                let Some(control) = visual.controls.get_mut(key) else {
                    continue;
                };
                if let Some(options) = &hint.options {
                    control.input = ControlInput::Select {
                        options: options
                            .iter()
                            .map(|value| ControlOption {
                                label: match value {
                                    Primitive::String(value) => value.clone(),
                                    _ => serde_json::to_string(value).unwrap_or_default(),
                                },
                                value: value.clone(),
                            })
                            .collect(),
                    };
                } else if let ControlInput::Number {
                    minimum,
                    maximum,
                    step,
                } = &mut control.input
                {
                    *minimum = hint.minimum.clone().or_else(|| minimum.clone());
                    *maximum = hint.maximum.clone().or_else(|| maximum.clone());
                    *step = hint.step.clone().or_else(|| step.clone());
                }
                control.label = hint.label.clone().or_else(|| control.label.clone());
                control.description = hint
                    .description
                    .clone()
                    .or_else(|| control.description.clone());
                declared_controls::normalize(control);
            }
            prepared
                .warnings
                .extend(numeric_warnings::for_story_hints(hints, entry));
        }
    }
    for excluded in &rendering.excluded_props {
        let path = excluded
            .variant
            .as_ref()
            .map_or_else(|| parent.clone(), |slug| format!("{parent}/{slug}"));
        prepared.warnings.push(Warning {
            code: "props-not-data",
            subject: WarningSubject::Entry(path),
            message: format!("prop {} is not plain data", excluded.key),
        });
    }
}

pub(crate) fn references(
    prepared: &mut PreparedCatalogue,
    pending: &[(String, ProvidedRendering)],
    issues: &mut Vec<Issue>,
) {
    let handles: BTreeMap<_, _> = prepared
        .javascript
        .bindings
        .iter()
        .map(|(handle, binding)| (handle.clone(), binding.path.clone()))
        .collect();
    for (parent, rendering) in pending {
        for entry in &mut prepared.model.entries {
            let slug = if entry.metadata.path == *parent {
                ""
            } else if entry.metadata.variant_of.as_ref() == Some(parent) {
                entry
                    .metadata
                    .path
                    .strip_prefix(&format!("{parent}/"))
                    .unwrap_or("")
            } else {
                continue;
            };
            if let EntryContent::Screen { use_case_paths, .. } = &mut entry.content
                && let Some(references) = rendering.use_cases.get(slug)
            {
                *use_case_paths = references
                    .iter()
                    .filter_map(|reference| resolve(reference, &handles, issues))
                    .collect();
            }
            if let EntryContent::UseCase { steps } = &mut entry.content {
                for (step, reference) in steps.iter_mut().zip(&rendering.steps) {
                    if let Some(path) = resolve(reference, &handles, issues) {
                        step.screen_path = path;
                    }
                }
            }
        }
    }
}

fn resolve(
    reference: &EntryReference,
    handles: &BTreeMap<String, String>,
    issues: &mut Vec<Issue>,
) -> Option<String> {
    match reference {
        EntryReference::Path(path) => Some(path.clone()),
        EntryReference::Handle(handle) => match handles.get(handle) {
            Some(path) => Some(path.clone()),
            None => {
                issues.push(Issue::new(
                    Code::UnknownLinkDefinition,
                    format!("definition handle {handle} is not exported by an entry module"),
                ));
                None
            }
        },
    }
}
