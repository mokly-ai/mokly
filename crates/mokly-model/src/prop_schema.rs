//! Structured JSON Schema profile shared with TypeScript readers.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Number;
use ts_rs::TS;

/// JSON types accepted by the prop schema profile.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum JsonType {
    /// String data.
    String,
    /// Finite numeric data.
    Number,
    /// Integral numeric data.
    Integer,
    /// Boolean data.
    Boolean,
    /// Null data.
    Null,
    /// Closed object data.
    Object,
    /// Dense array data.
    Array,
}

/// A single type or a union of types.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum Types {
    /// A single JSON type.
    Single(JsonType),
    /// A nonempty list of distinct types.
    Union(Vec<JsonType>),
}

/// A JSON primitive allowed by enum and const.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum Primitive {
    /// String constant.
    String(String),
    /// Finite numeric constant.
    Number(Number),
    /// Boolean constant.
    Boolean(bool),
    /// Null constant.
    Null,
}

/// A constant member of a oneOf select.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct Constant {
    /// Primitive choice value, checked before construction.
    #[serde(rename = "const")]
    pub value: Primitive,
    /// Optional display label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
}

/// A self-contained profile schema; compile it before use.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PropSchema {
    /// Declared type or type union.
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub types: Option<Types>,
    /// Declared property schemas.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub properties: Option<BTreeMap<String, PropSchema>>,
    /// Required declared properties.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub required: Option<Vec<String>>,
    /// Always false for an object schema.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub additional_properties: Option<bool>,
    /// Allowed primitive values.
    #[serde(rename = "enum", skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub enumeration: Option<Vec<Primitive>>,
    /// One allowed primitive value; Some(Null) is distinct from absence.
    #[serde(
        rename = "const",
        default,
        deserialize_with = "present_value",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub constant: Option<Primitive>,
    /// Constant choices with optional labels.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub one_of: Option<Vec<Constant>>,
    /// Union members; matching does not transform values.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub any_of: Option<Vec<PropSchema>>,
    /// Array element schema; absence accepts any JSON value.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub items: Option<Box<PropSchema>>,
    /// Minimum array length.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub min_items: Option<Number>,
    /// Maximum array length.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub max_items: Option<Number>,
    /// Minimum string length.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub min_length: Option<Number>,
    /// Maximum string length.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub max_length: Option<Number>,
    /// Minimum numeric value.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub minimum: Option<Number>,
    /// Maximum numeric value.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub maximum: Option<Number>,
    /// Positive numeric multiple, measured from zero.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub multiple_of: Option<Number>,
    /// Display label.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
    /// Help text.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    /// Root-only JSON Schema draft annotation.
    #[serde(rename = "$schema", skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub schema: Option<String>,
}

fn present_value<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<Primitive>, D::Error> {
    Ok(Some(Primitive::deserialize(deserializer)?))
}
