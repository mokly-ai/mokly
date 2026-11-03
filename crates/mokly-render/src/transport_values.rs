//! Concrete mappings between sidecar records and the catalogue's typed inputs.

use std::collections::BTreeMap;

use mokly_catalogue::config_types::ModuleLoader;
use mokly_model::axes::ColorScheme;
use mokly_model::controls::{ComponentControl, ControlInput, ControlOption};
use mokly_model::data::{DataValue, Props};
use mokly_model::usage::{ComponentInputOwner, ComponentSourceLocation};
use mokly_sidecar::controls::Control;
use mokly_sidecar::methods;
use mokly_sidecar::usage::{InputOwner, InvocationSource};
use serde_json::Value;

/// Preserve each validated loader's wire spelling.
pub(crate) fn loaders(values: &BTreeMap<String, ModuleLoader>) -> BTreeMap<String, String> {
    values
        .iter()
        .map(|(extension, loader)| {
            let name = match loader {
                ModuleLoader::Base64 => "base64",
                ModuleLoader::Binary => "binary",
                ModuleLoader::Dataurl => "dataurl",
                ModuleLoader::Empty => "empty",
                ModuleLoader::File => "file",
                ModuleLoader::Js => "js",
                ModuleLoader::Json => "json",
                ModuleLoader::Jsx => "jsx",
                ModuleLoader::Text => "text",
                ModuleLoader::Ts => "ts",
                ModuleLoader::Tsx => "tsx",
            };
            (extension.clone(), name.into())
        })
        .collect()
}

/// Map the sidecar's view axis to the catalogue axis.
pub(crate) fn color_scheme(value: &methods::ColorScheme) -> ColorScheme {
    match value {
        methods::ColorScheme::Light => ColorScheme::Light,
        methods::ColorScheme::Dark => ColorScheme::Dark,
    }
}

/// Render already-validated plain data as JSON prop values.
pub(crate) fn plain_props(values: &Props) -> BTreeMap<String, Value> {
    values
        .iter()
        .map(|(key, value)| {
            (
                key.clone(),
                serde_json::to_value(value)
                    .expect("plain prop data contains only JSON values and string-keyed maps"),
            )
        })
        .collect()
}

/// Preserve the model's number normalization when importing decoded JSON props.
pub(crate) fn props(values: &BTreeMap<String, Value>) -> Props {
    values
        .iter()
        .map(|(key, value)| {
            (
                key.clone(),
                serde_json::from_value::<DataValue>(value.clone())
                    .expect("each JSON value has a plain prop data representation"),
            )
        })
        .collect()
}

/// Keep logical ownership independent from placement.
pub(crate) fn owner(value: &InputOwner) -> ComponentInputOwner {
    match value {
        InputOwner::Entry => ComponentInputOwner::Entry,
        InputOwner::Instance { instance_key } => ComponentInputOwner::Instance {
            instance_key: instance_key.clone(),
        },
    }
}

/// Transfer invocation source coordinates without conversion through JSON.
pub(crate) fn source(value: &InvocationSource) -> ComponentSourceLocation {
    ComponentSourceLocation {
        path: value.path.clone(),
        line: value.line,
        column: value.column,
    }
}

/// Transfer typed control labels, choices, and numeric bounds.
pub(crate) fn controls(values: &BTreeMap<String, Control>) -> BTreeMap<String, ComponentControl> {
    values
        .iter()
        .map(|(key, value)| (key.clone(), control(value)))
        .collect()
}

fn control(value: &Control) -> ComponentControl {
    let (label, input) = match value {
        Control::Text { label, max_length } => (
            label,
            ControlInput::Text {
                max_length: max_length.clone(),
            },
        ),
        Control::Boolean { label } => (label, ControlInput::Boolean),
        Control::Number {
            label,
            minimum,
            maximum,
            step,
        } => (
            label,
            ControlInput::Number {
                minimum: minimum.clone(),
                maximum: maximum.clone(),
                step: step.clone(),
            },
        ),
        Control::Select { label, options } => (
            label,
            ControlInput::Select {
                options: options
                    .iter()
                    .map(|option| ControlOption {
                        label: option.label.clone(),
                        value: option.value.clone(),
                    })
                    .collect(),
            },
        ),
    };
    ComponentControl {
        label: label.label.clone(),
        description: label.description.clone(),
        input,
    }
}
