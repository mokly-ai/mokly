//! Canonical JSON encoding; array order is supplied by each shape owner.
//! Number spelling comes from serde_json's float formatter, so a serde_json upgrade can
//! change canonical bytes and the deployment ids derived from them. For example,
//! serde_json 1.0.154 uses zmij, which writes `1e+16` where ryu wrote `1e16`.

use std::cmp::Ordering;
use std::io;

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

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

/// Hash a detail's canonical JSON with its id and current revision zeroed.
pub fn detail_id(value: &impl Serialize) -> Result<String> {
    let value = match serde_json::to_value(value) {
        Ok(Value::Object(mut object)) => {
            object.insert("detailId".into(), Value::String("0".repeat(64)));
            if object.contains_key("revision") {
                object.insert("revision".into(), Value::from(0));
            }
            Value::Object(object)
        }
        Ok(_) => {
            return Err(ModelError::Internal(InternalError::Json {
                source: serde_json::Error::io(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "detail must be an object",
                )),
            }));
        }
        Err(source) => return Err(ModelError::Internal(InternalError::Json { source })),
    };
    let bytes = to_string(&value)?.into_bytes();
    Ok(Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

#[cfg(test)]
#[path = "_tests_/canonical_tests.rs"]
mod canonical_tests;
