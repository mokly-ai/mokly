//! Tagged public props that retain negative zero and exact numeric values.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::canonical::compare_utf16;
use crate::data::{DataValue, Props};

/// Public encoded props, sorted by UTF-16 when canonical JSON is written.
pub type ComponentWireProps = BTreeMap<String, ComponentWireValue>;

/// Literal null wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum NullTag {
    /// The null tag.
    #[serde(rename = "null")]
    Value,
}

/// Literal boolean wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum BooleanTag {
    /// The boolean tag.
    #[serde(rename = "boolean")]
    Value,
}

/// Literal number wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum NumberTag {
    /// The number tag.
    #[serde(rename = "number")]
    Value,
}

/// Literal string wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum StringTag {
    /// The string tag.
    #[serde(rename = "string")]
    Value,
}

/// Literal array wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum ArrayTag {
    /// The array tag.
    #[serde(rename = "array")]
    Value,
}

/// Literal object wire tag.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub enum ObjectTag {
    /// The object tag.
    #[serde(rename = "object")]
    Value,
}

/// Canonical tagged data, decoded and validated before use.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum ComponentWireValue {
    /// Null tuple.
    Null([NullTag; 1]),
    /// Boolean tuple.
    Boolean(BooleanTag, bool),
    /// Shortest round-trip number spelling; negative zero is -0.
    Number(NumberTag, String),
    /// String tuple.
    String(StringTag, String),
    /// Ordered array tuple.
    Array(ArrayTag, Vec<ComponentWireValue>),
    /// UTF-16 ordered key/value tuples.
    Object(ObjectTag, Vec<(String, ComponentWireValue)>),
}

/// Encode validated complete props without losing negative zero.
pub fn encode(props: &Props) -> ComponentWireProps {
    props
        .iter()
        .map(|(key, value)| (key.clone(), encode_value(value)))
        .collect()
}

fn encode_value(value: &DataValue) -> ComponentWireValue {
    match value {
        DataValue::Null => ComponentWireValue::Null([NullTag::Value]),
        DataValue::Boolean(value) => ComponentWireValue::Boolean(BooleanTag::Value, *value),
        DataValue::String(value) => ComponentWireValue::String(StringTag::Value, value.clone()),
        DataValue::Number(number) => {
            let text = if let Some(value) = number.as_f64() {
                if value == 0.0 && value.is_sign_negative() {
                    "-0".into()
                } else {
                    ryu_js::Buffer::new().format(value).to_owned()
                }
            } else {
                number.to_string()
            };
            ComponentWireValue::Number(NumberTag::Value, text)
        }
        DataValue::Array(values) => {
            ComponentWireValue::Array(ArrayTag::Value, values.iter().map(encode_value).collect())
        }
        DataValue::Object(values) => {
            let mut values: Vec<_> = values
                .iter()
                .map(|(key, value)| (key.clone(), encode_value(value)))
                .collect();
            values.sort_by(|a, b| compare_utf16(&a.0, &b.0));
            ComponentWireValue::Object(ObjectTag::Value, values)
        }
    }
}
