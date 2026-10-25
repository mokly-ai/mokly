//! Plain JSON data kept distinct from schemas and public tagged wire values.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Number;
use ts_rs::TS;

use crate::limits;

/// Complete, plain JSON prop values keyed by their authored names.
pub type Props = BTreeMap<String, DataValue>;

/// A plain data value. Validate its depth, keys, and schema before use.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum DataValue {
    /// JSON null.
    Null,
    /// Boolean data.
    Boolean(bool),
    /// Finite JSON number; retains negative zero.
    Number(#[serde(deserialize_with = "deserialize_number")] Number),
    /// String data.
    String(String),
    /// Dense ordered array.
    Array(Vec<DataValue>),
    /// Plain object.
    Object(Props),
}

/// Replace top-level keys only. Neither input is mutated.
pub fn merge_props(parent: &Props, overrides: &Props) -> Props {
    let mut merged = parent.clone();
    merged.extend(overrides.clone());
    merged
}

/// HTML scalar spelling follows JavaScript's finite-number text, including zero.
pub fn number_text(value: &Number) -> String {
    match value.as_f64() {
        Some(0.0) => "0".into(),
        Some(value) => ryu_js::Buffer::new().format(value).to_owned(),
        None => value.to_string(),
    }
}

/// Round integers outside JavaScript's safe range to their nearest binary64 value.
pub fn round_unsafe_integer(value: Number) -> Number {
    if unsafe_integer(&value)
        && let Some(rounded) = value.as_f64().and_then(Number::from_f64)
    {
        rounded
    } else {
        value
    }
}

fn deserialize_number<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Number, D::Error> {
    Number::deserialize(deserializer).map(round_unsafe_integer)
}

/// Return JSON pointers for unsafe integers, including nested objects and arrays.
pub fn unsafe_integer_paths(props: &Props) -> Vec<String> {
    let mut pending: Vec<_> = props
        .iter()
        .map(|(key, value)| (limits::pointer("", key), value))
        .collect();
    let mut paths = Vec::new();
    while let Some((path, value)) = pending.pop() {
        match value {
            DataValue::Number(value) if unsafe_integer(value) => paths.push(path),
            DataValue::Array(values) => pending.extend(
                values
                    .iter()
                    .enumerate()
                    .map(|(index, value)| (limits::pointer(&path, &index.to_string()), value)),
            ),
            DataValue::Object(values) => pending.extend(
                values
                    .iter()
                    .map(|(key, value)| (limits::pointer(&path, key), value)),
            ),
            _ => {}
        }
    }
    paths.sort();
    paths
}

fn unsafe_integer(value: &Number) -> bool {
    value
        .as_f64()
        .is_some_and(|value| value.fract() == 0.0 && value.abs() > 9_007_199_254_740_991.0)
}

#[cfg(test)]
#[path = "_tests_/data_numbers_tests.rs"]
mod data_numbers_tests;
