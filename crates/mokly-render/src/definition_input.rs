//! Convert the typed transport into the shared Rust authoring input.

use std::collections::BTreeMap;

use mokly_catalogue::definition_provider::ProvidedDefinition;
use mokly_catalogue::input::EntryInput;
use mokly_catalogue::render_sources::{
    EntryReference, ExcludedProp, ProvidedRendering, RenderMethod, RenderSource, StoryControlHint,
};
use mokly_model::axes::EntryKind;
use mokly_model::catalogue::{SourceLocation, UseCaseStep};
use mokly_sidecar::controls::StoryHints;
use mokly_sidecar::definition_metadata;
use mokly_sidecar::definitions::Definition;

use crate::error::{Result, convert};

pub(crate) fn location(definition: &Definition) -> SourceLocation {
    let (file, export) = definition
        .handle
        .rsplit_once('#')
        .unwrap_or((&definition.handle, "default"));
    SourceLocation {
        path: definition
            .source_path
            .clone()
            .unwrap_or_else(|| file.into()),
        export: Some(export.into()),
        line: 1,
        column: 1,
    }
}

pub(crate) fn entry(
    definition: &Definition,
    kind: EntryKind,
    story: bool,
) -> Result<ProvidedDefinition> {
    let (exporting_file, _) = definition
        .handle
        .rsplit_once('#')
        .unwrap_or((&definition.handle, "default"));
    let metadata = &definition.metadata;
    let mut rendering = ProvidedRendering::default();
    let method = if story {
        RenderMethod::Story
    } else {
        match kind {
            EntryKind::Screen => RenderMethod::Screen,
            EntryKind::Component => RenderMethod::Component,
            _ => RenderMethod::Page,
        }
    };
    let parent = RenderSource {
        handle: definition.handle.clone(),
        method,
        slots: BTreeMap::new(),
        stylesheets: definition.stylesheets.clone(),
    };
    rendering.entries.insert(String::new(), parent.clone());
    rendering.use_cases.insert(
        String::new(),
        definition.use_case_paths.iter().map(reference).collect(),
    );
    for key in definition.excluded_props.iter().flatten() {
        rendering.excluded_props.push(ExcludedProp {
            variant: None,
            key: key.clone(),
        });
    }
    if let Some(hints) = &definition.arg_types {
        rendering.story_hints.insert(
            String::new(),
            hints
                .iter()
                .map(|(name, value)| (name.clone(), hint(value)))
                .collect(),
        );
    }
    let mut variants = Vec::new();
    for variant in &definition.variants {
        let mut source = parent.clone();
        source.slots = variant.slots.clone();
        if story {
            source.handle = format!("{exporting_file}#{}", variant.slug);
        }
        rendering.entries.insert(variant.slug.clone(), source);
        rendering.use_cases.insert(
            variant.slug.clone(),
            variant
                .use_case_paths
                .iter()
                .flatten()
                .map(reference)
                .collect(),
        );
        for key in variant.excluded_props.iter().flatten() {
            rendering.excluded_props.push(ExcludedProp {
                variant: Some(variant.slug.clone()),
                key: key.clone(),
            });
        }
        let mut value: serde_json::Value = convert(variant)?;
        if let Some(object) = value.as_object_mut() {
            object.remove("excludedProps");
            object.remove("useCasePaths");
            if kind != EntryKind::Component {
                object.remove("slots");
            }
        }
        variants.push(value);
    }
    rendering.steps = definition
        .steps
        .iter()
        .map(|step| reference(&step.screen_path))
        .collect();
    let input = EntryInput {
        title: metadata.title.clone().unwrap_or_default(),
        description: metadata.description.clone().unwrap_or_default(),
        tags: metadata.tags.clone(),
        slug: metadata.slug.clone(),
        path: metadata.path.clone(),
        moved_from: metadata.moved_from.clone(),
        rationale: metadata.rationale.clone(),
        related_docs: metadata.related_docs.clone(),
        color_schemes: convert(&definition.color_schemes)?,
        address: definition.address.clone(),
        use_case_paths: Vec::new(),
        prop_schema: definition.prop_schema.clone(),
        props: convert(&definition.props)?,
        variants,
        element: definition.element.clone(),
        slots: definition.slots.clone(),
        steps: definition
            .steps
            .iter()
            .map(|step| UseCaseStep {
                screen_path: String::new(),
                title: step.title.clone(),
                description: step.description.clone(),
            })
            .collect(),
        controls: match &definition.controls {
            Some(controls) => Some(convert(controls)?),
            None => None,
        },
        infer_component_schema: story,
        control_order: definition.control_order.clone(),
    };
    Ok(ProvidedDefinition {
        exporting_file: exporting_file.into(),
        source: location(definition),
        kind,
        input,
        rendering,
    })
}

fn reference(value: &definition_metadata::EntryReference) -> EntryReference {
    match value {
        definition_metadata::EntryReference::Path(path) => EntryReference::Path(path.clone()),
        definition_metadata::EntryReference::Definition { handle } => {
            EntryReference::Handle(handle.clone())
        }
    }
}

pub(crate) fn hint(value: &StoryHints) -> StoryControlHint {
    StoryControlHint {
        options: value.options.clone(),
        minimum: value.control.as_ref().and_then(|value| value.min.clone()),
        maximum: value.control.as_ref().and_then(|value| value.max.clone()),
        step: value.control.as_ref().and_then(|value| value.step.clone()),
        label: value.name.clone(),
        description: value.description.clone(),
    }
}
