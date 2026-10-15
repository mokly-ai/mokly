//! Derived component controls, shared by the index and live editing.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Number;
use ts_rs::TS;

use crate::prop_schema::{JsonType, Primitive, PropSchema, Types};

/// User-facing select option.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ControlOption {
    /// Nonempty display label.
    pub label: String,
    /// Validated primitive value.
    pub value: Primitive,
}

/// Optional display labels with a typed control.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ComponentControl {
    /// Display label; defaults to the schema title or property name.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub label: Option<String>,
    /// Optional help text.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    /// Control behavior and bounds.
    #[serde(flatten)]
    pub input: ControlInput,
}

/// Control behavior, excluding optionality which comes from the schema.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum ControlInput {
    /// String input.
    Text {
        /// Maximum permitted string length.
        #[serde(rename = "maxLength", skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        max_length: Option<Number>,
    },
    /// Boolean toggle.
    Boolean,
    /// Numeric input with zero-based steps.
    Number {
        /// Inclusive lower bound.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        minimum: Option<Number>,
        /// Inclusive upper bound.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        maximum: Option<Number>,
        /// Positive multiple counted from zero.
        #[serde(skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        step: Option<Number>,
    },
    /// Primitive choices.
    Select {
        /// Validated choices in authored order.
        options: Vec<ControlOption>,
    },
}

/// Derive every editable property; object and union shapes remain uneditable.
pub fn derive(schema: &PropSchema) -> BTreeMap<String, ComponentControl> {
    schema
        .properties
        .iter()
        .flat_map(|props| props.iter())
        .filter_map(|(name, schema)| {
            let options = if let Some(choices) = &schema.one_of {
                Some(
                    choices
                        .iter()
                        .map(|choice| ControlOption {
                            label: choice.title.clone().unwrap_or_else(|| label(&choice.value)),
                            value: choice.value.clone(),
                        })
                        .collect(),
                )
            } else {
                schema.enumeration.as_ref().map(|choices| {
                    choices
                        .iter()
                        .map(|value| ControlOption {
                            label: label(value),
                            value: value.clone(),
                        })
                        .collect()
                })
            };
            let input = if let Some(options) = options {
                ControlInput::Select { options }
            } else {
                match schema.types.as_ref()? {
                    Types::Single(JsonType::String) => ControlInput::Text {
                        max_length: schema.max_length.clone(),
                    },
                    Types::Single(JsonType::Boolean) => ControlInput::Boolean,
                    Types::Single(kind @ (JsonType::Number | JsonType::Integer)) => {
                        ControlInput::Number {
                            minimum: schema.minimum.clone(),
                            maximum: schema.maximum.clone(),
                            step: schema.multiple_of.clone().or_else(|| {
                                matches!(kind, JsonType::Integer).then(|| Number::from(1))
                            }),
                        }
                    }
                    _ => return None,
                }
            };
            Some((
                name.clone(),
                ComponentControl {
                    label: schema.title.clone(),
                    description: schema.description.clone(),
                    input,
                },
            ))
        })
        .collect()
}

fn label(value: &Primitive) -> String {
    match value {
        Primitive::String(value) => value.clone(),
        Primitive::Null => "null".into(),
        Primitive::Number(value) => value.to_string(),
        Primitive::Boolean(value) => value.to_string(),
    }
}
