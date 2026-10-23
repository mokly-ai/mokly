//! Warn on binary64 normalization after final entry paths are known.

use std::collections::BTreeMap;

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::controls::{ComponentControl, ControlInput};
use mokly_model::data::{Props, unsafe_integer_paths};
use mokly_model::limits::pointer;
use mokly_model::prop_schema::{Primitive, PropSchema};
use serde_json::Number;

use crate::diagnostic::{Warning, WarningSubject};
use crate::render_sources::StoryControlHint;

enum Field {
    Prop,
    Schema,
    Control,
}

pub(crate) fn collect(entries: &[ModelEntry]) -> Vec<Warning> {
    let mut warnings = Vec::new();
    for entry in entries {
        let visual = match &entry.content {
            EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => visual,
            _ => continue,
        };
        warnings.extend(for_entry(&visual.props, entry));
        if entry.metadata.variant_of.is_none() {
            warnings.extend(
                schema_paths(&visual.prop_schema)
                    .into_iter()
                    .map(|path| warning(Field::Schema, &path, entry)),
            );
        }
    }
    warnings
}

/// Diagnose each unsafe complete prop value without exposing its data in the message.
pub fn for_entry(props: &Props, entry: &ModelEntry) -> Vec<Warning> {
    unsafe_integer_paths(props)
        .into_iter()
        .map(|path| warning(Field::Prop, &path, entry))
        .collect()
}

fn warning(field: Field, path: &str, entry: &ModelEntry) -> Warning {
    let kind = match field {
        Field::Prop => "prop",
        Field::Schema => "schema keyword",
        Field::Control => "control",
    };
    let subject = if matches!(entry.content, EntryContent::Component { .. }) {
        WarningSubject::Component(entry.metadata.path.clone())
    } else {
        WarningSubject::Entry(entry.metadata.path.clone())
    };
    Warning {
        code: "props-unsafe-integer",
        subject,
        message: format!(
            "{kind} {path:?} is outside the JavaScript safe integer range and uses the nearest binary64 value"
        ),
    }
}

/// Authored control metadata is checked once, before schema defaults are added.
pub(crate) fn for_controls(
    controls: &BTreeMap<String, ComponentControl>,
    entry: &ModelEntry,
) -> Vec<Warning> {
    let mut paths = Vec::new();
    for (key, control) in controls {
        let path = pointer("", key);
        match &control.input {
            ControlInput::Text { max_length } => {
                record(max_length.as_ref(), pointer(&path, "maxLength"), &mut paths);
            }
            ControlInput::Number {
                minimum,
                maximum,
                step,
            } => {
                bounds(&path, minimum, maximum, step, &mut paths);
            }
            ControlInput::Select { options } => {
                choices(
                    &path,
                    options.iter().map(|option| &option.value),
                    &mut paths,
                );
            }
            ControlInput::Boolean => {}
        }
    }
    paths
        .into_iter()
        .map(|path| warning(Field::Control, &path, entry))
        .collect()
}

/// Applied story hints keep the same control paths as explicit declarations.
pub(crate) fn for_story_hints(
    hints: &BTreeMap<String, StoryControlHint>,
    entry: &ModelEntry,
) -> Vec<Warning> {
    let controls = match &entry.content {
        EntryContent::Screen { visual, .. } | EntryContent::Component { visual, .. } => {
            &visual.controls
        }
        _ => return Vec::new(),
    };
    let mut paths = Vec::new();
    for (key, hint) in hints {
        let Some(control) = controls.get(key) else {
            continue;
        };
        let path = pointer("", key);
        if let Some(options) = &hint.options {
            choices(&path, options.iter(), &mut paths);
        } else if matches!(control.input, ControlInput::Number { .. }) {
            bounds(&path, &hint.minimum, &hint.maximum, &hint.step, &mut paths);
        }
    }
    paths
        .into_iter()
        .map(|path| warning(Field::Control, &path, entry))
        .collect()
}

fn bounds(
    path: &str,
    minimum: &Option<Number>,
    maximum: &Option<Number>,
    step: &Option<Number>,
    paths: &mut Vec<String>,
) {
    for (key, number) in [("minimum", minimum), ("maximum", maximum), ("step", step)] {
        record(number.as_ref(), pointer(path, key), paths);
    }
}

fn choices<'a>(path: &str, values: impl Iterator<Item = &'a Primitive>, paths: &mut Vec<String>) {
    for (index, value) in values.enumerate() {
        if let Primitive::Number(value) = value {
            record(
                Some(value),
                pointer(
                    &pointer(&pointer(path, "options"), &index.to_string()),
                    "value",
                ),
                paths,
            );
        }
    }
}

fn schema_paths(schema: &PropSchema) -> Vec<String> {
    let mut paths = Vec::new();
    let mut pending = vec![(String::new(), schema)];
    while let Some((path, schema)) = pending.pop() {
        for (keyword, value) in [
            ("minimum", &schema.minimum),
            ("maximum", &schema.maximum),
            ("multipleOf", &schema.multiple_of),
            ("minLength", &schema.min_length),
            ("maxLength", &schema.max_length),
            ("minItems", &schema.min_items),
            ("maxItems", &schema.max_items),
        ] {
            record(value.as_ref(), pointer(&path, keyword), &mut paths);
        }
        let choices = schema
            .enumeration
            .iter()
            .flatten()
            .enumerate()
            .map(|(index, value)| (pointer(&pointer(&path, "enum"), &index.to_string()), value))
            .chain(
                schema
                    .constant
                    .iter()
                    .map(|value| (pointer(&path, "const"), value)),
            )
            .chain(
                schema
                    .one_of
                    .iter()
                    .flatten()
                    .enumerate()
                    .map(|(index, value)| {
                        (
                            pointer(
                                &pointer(&pointer(&path, "oneOf"), &index.to_string()),
                                "const",
                            ),
                            &value.value,
                        )
                    }),
            );
        for (path, value) in choices {
            if let Primitive::Number(value) = value {
                record(Some(value), path, &mut paths);
            }
        }
        pending.extend(
            schema
                .properties
                .iter()
                .flatten()
                .map(|(key, schema)| (pointer(&pointer(&path, "properties"), key), schema)),
        );
        pending.extend(
            schema
                .items
                .iter()
                .map(|schema| (pointer(&path, "items"), schema.as_ref())),
        );
        pending.extend(
            schema
                .any_of
                .iter()
                .flatten()
                .enumerate()
                .map(|(index, schema)| {
                    (
                        pointer(&pointer(&path, "anyOf"), &index.to_string()),
                        schema,
                    )
                }),
        );
    }
    paths.sort();
    paths
}

fn record(number: Option<&Number>, path: String, paths: &mut Vec<String>) {
    if number
        .and_then(Number::as_f64)
        .is_some_and(|value| value.fract() == 0.0 && value.abs() > 9_007_199_254_740_991.0)
    {
        paths.push(path);
    }
}

#[cfg(test)]
#[path = "_tests_/numeric_warnings_tests.rs"]
mod numeric_warnings_tests;
