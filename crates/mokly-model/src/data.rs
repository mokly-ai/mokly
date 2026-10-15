//! Plain JSON data kept distinct from schemas and public tagged wire values.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Number;
use ts_rs::TS;

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
    Number(Number),
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
