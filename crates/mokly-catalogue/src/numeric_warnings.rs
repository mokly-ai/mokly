//! Warn on binary64 normalization after final entry paths are known.

use std::collections::BTreeMap;

use mokly_model::catalogue::{EntryContent, ModelEntry};
use mokly_model::controls::{ComponentControl, ControlInput};
use mokly_model::data::{Props, unsafe_integer_paths};
use mokly_model::limits::pointer;
use mokly_model::prop_schema::Primitive;
use serde_json::Number;

use crate::diagnostic::{Warning, WarningSubject, json_quoted};
use crate::render_sources::StoryControlHint;
use crate::schema_warnings;

enum Field<'a> {
    Prop,
    Invocation {
        component: &'a str,
        instance: &'a str,
    },
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
                schema_warnings::schema_paths(&visual.prop_schema)
                    .into_iter()
                    .map(|path| warning(Field::Schema, &path, entry)),
            );
        }
    }
    warnings
}

/// Diagnose each unsafe complete prop value without exposing its data in the message.
fn for_entry(props: &Props, entry: &ModelEntry) -> Vec<Warning> {
    unsafe_integer_paths(props)
        .into_iter()
        .map(|path| warning(Field::Prop, &path, entry))
        .collect()
}

/// Diagnose unsafe integer props returned by one component invocation.
pub fn for_invocation(
    props: &Props,
    entry: &ModelEntry,
    component_path: &str,
    instance_id: &str,
) -> Vec<Warning> {
    unsafe_integer_paths(props)
        .into_iter()
        .map(|path| {
            warning(
                Field::Invocation {
                    component: component_path,
                    instance: instance_id,
                },
                &path,
                entry,
            )
        })
        .collect()
}

fn warning(field: Field<'_>, path: &str, entry: &ModelEntry) -> Warning {
    let message = format_message(field, path);
    let subject = if matches!(entry.content, EntryContent::Component { .. }) {
        WarningSubject::Component(entry.metadata.path.clone())
    } else {
        WarningSubject::Entry(entry.metadata.path.clone())
    };
    Warning {
        code: "props-unsafe-integer",
        subject,
        message,
    }
}

fn format_message(field: Field<'_>, path: &str) -> String {
    let subject = match field {
        Field::Prop => format!("prop {}", json_quoted(path)),
        Field::Invocation {
            component,
            instance,
        } => format!(
            "component {} instance {} prop {}",
            json_quoted(component),
            json_quoted(instance),
            json_quoted(path),
        ),
        Field::Schema => format!("schema keyword {}", json_quoted(path)),
        Field::Control => format!("control {}", json_quoted(path)),
    };
    format!(
        "{subject} is outside the JavaScript safe integer range and uses the nearest binary64 value"
    )
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
