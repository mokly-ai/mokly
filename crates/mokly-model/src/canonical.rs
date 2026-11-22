//! Canonical JSON encoding; array order is supplied by each shape owner.
//! Number spelling comes from serde_json's float formatter, so a serde_json upgrade can
//! change canonical bytes and the deployment ids derived from them. For example,
//! serde_json 1.0.154 uses zmij, which writes `1e+16` where ryu wrote `1e16`.

use std::cmp::Ordering;
use std::io;

use serde::Serialize;
use serde::ser::{SerializeMap, SerializeSeq, Serializer};
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
    encode_value(&value)
}

fn encode_value(value: &Value) -> Result<String> {
    let mut text = match serde_json::to_string_pretty(&Sorted(value)) {
        Ok(text) => text,
        Err(source) => return Err(ModelError::Internal(InternalError::Json { source })),
    };
    text.push('\n');
    Ok(text)
}

/// A borrowed value that serializes each object's keys in UTF-16 order as it writes them,
/// so the encoder builds no sorted copy of the value.
struct Sorted<'a>(&'a Value);

impl Serialize for Sorted<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        match self.0 {
            Value::Object(object) => {
                let mut fields: Vec<_> = object.iter().collect();
                fields.sort_by(|(left, _), (right, _)| compare_utf16(left, right));
                let mut map = serializer.serialize_map(Some(fields.len()))?;
                for (key, value) in fields {
                    map.serialize_entry(key, &Sorted(value))?;
                }
                map.end()
            }
            Value::Array(values) => {
                let mut sequence = serializer.serialize_seq(Some(values.len()))?;
                for value in values {
                    sequence.serialize_element(&Sorted(value))?;
                }
                sequence.end()
            }
            value => value.serialize(serializer),
        }
    }
}

/// Encode a detail's canonical identity preimage with its id and current revision zeroed.
/// An absent revision remains absent. The returned text has one final LF.
pub fn detail_preimage(value: &impl Serialize) -> Result<String> {
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
    encode_value(&value)
}

/// Hash a detail's canonical JSON with its id and current revision zeroed.
pub fn detail_id(value: &impl Serialize) -> Result<String> {
    Ok(Sha256::digest(detail_preimage(value)?)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

#[cfg(test)]
#[path = "_tests_/canonical_tests.rs"]
mod canonical_tests;
