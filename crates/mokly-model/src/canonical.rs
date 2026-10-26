//! Canonical JSON encoding; array order is supplied by each shape owner.

use std::cmp::Ordering;

use serde::Serialize;
use serde_json::Value;

use crate::error::{InternalError, ModelError, Result};

/// Compare strings by UTF-16 code units, independent of locale.
pub fn compare_utf16(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

/// Sort object keys recursively, preserving every array and explicit empty.
pub fn sorted(value: Value) -> Value {
    match value {
        Value::Object(object) => {
            let mut fields: Vec<_> = object.into_iter().collect();
            fields.sort_by(|(left, _), (right, _)| compare_utf16(left, right));
            Value::Object(
                fields
                    .into_iter()
                    .map(|(key, value)| (key, sorted(value)))
                    .collect(),
            )
        }
        Value::Array(values) => Value::Array(values.into_iter().map(sorted).collect()),
        value => value,
    }
}

/// Encode two-space JSON with recursively sorted keys and one final LF.
/// Shape owners sort entries, instances, slots and regions before encoding.
/// Authored variant, step and tag order is retained.
pub fn to_string(value: &impl Serialize) -> Result<String> {
    let value = match serde_json::to_value(value) {
        Ok(value) => value,
        Err(source) => return Err(ModelError::Internal(InternalError::Json { source })),
    };
    match serde_json::to_string_pretty(&sorted(value)) {
        Ok(mut text) => {
            text.push('\n');
            Ok(text)
        }
        Err(source) => Err(ModelError::Internal(InternalError::Json { source })),
    }
}

#[cfg(test)]
#[path = "_tests_/canonical_tests.rs"]
mod canonical_tests;
