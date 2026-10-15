//! Bounded decoding of canonical wire props, including negative zero.

use std::collections::BTreeMap;

use serde_json::Number;
use thiserror::Error;

use crate::canonical::compare_utf16;
use crate::data::{DataValue, Props};
use crate::limits;
use crate::wire_props::{ComponentWireProps, ComponentWireValue};

/// A malformed tagged prop value.
#[derive(Clone, Debug, Error)]
pub enum WireError {
    /// Number is non-finite or not in the canonical shortest spelling.
    #[error("[mokly-model/wire] invalid canonical number at {path}")]
    Number {
        /// Exact JSON Pointer.
        path: String,
    },
    /// Object tuple keys repeat or are not UTF-16 ordered.
    #[error("[mokly-model/wire] unordered or duplicate object key at {path}")]
    Keys {
        /// Exact JSON Pointer.
        path: String,
    },
    /// Plain-data depth, visit, or reserved-key contract failed.
    #[error("[mokly-model/wire] {message} at {path}")]
    Data {
        /// Exact JSON Pointer.
        path: String,
        /// Typed plain-data validation failure.
        message: DataViolation,
    },
}

/// Plain-data rule violated by a tagged value.
#[derive(Clone, Debug, Eq, PartialEq, Error)]
pub enum DataViolation {
    /// Nested data exceeds the profile's depth.
    #[error("exceeds 64 nesting levels")]
    Depth,
    /// Data exceeds the profile's traversal budget.
    #[error("exceeds 10000 visited nodes")]
    Nodes,
    /// An object declares a forbidden property name.
    #[error("reserved property name")]
    ReservedKey,
}

/// Decode wire props, enforcing canonical number and object spellings.
pub fn decode(props: &ComponentWireProps) -> Result<Props, WireError> {
    let mut visited = 1;
    props
        .iter()
        .map(|(key, value)| {
            let path = limits::pointer("", key);
            key_allowed(key, &path)?;
            decode_value(value, &path, 1, &mut visited).map(|value| (key.clone(), value))
        })
        .collect()
}

fn key_allowed(key: &str, path: &str) -> Result<(), WireError> {
    if matches!(key, "__proto__" | "constructor" | "prototype") {
        Err(WireError::Data {
            path: path.into(),
            message: DataViolation::ReservedKey,
        })
    } else {
        Ok(())
    }
}

fn decode_value(
    value: &ComponentWireValue,
    path: &str,
    depth: usize,
    visited: &mut usize,
) -> Result<DataValue, WireError> {
    if depth > limits::MAX_DEPTH {
        return Err(WireError::Data {
            path: path.into(),
            message: DataViolation::Depth,
        });
    }
    if *visited == limits::MAX_NODES {
        return Err(WireError::Data {
            path: path.into(),
            message: DataViolation::Nodes,
        });
    }
    *visited += 1;
    match value {
        ComponentWireValue::Null(_) => Ok(DataValue::Null),
        ComponentWireValue::Boolean(_, value) => Ok(DataValue::Boolean(*value)),
        ComponentWireValue::String(_, value) => Ok(DataValue::String(value.clone())),
        ComponentWireValue::Number(_, text) => {
            let number = match text.parse::<f64>() {
                Ok(number) if number.is_finite() => number,
                _ => return Err(WireError::Number { path: path.into() }),
            };
            let canonical = if number == 0.0 && number.is_sign_negative() {
                "-0".into()
            } else {
                ryu_js::Buffer::new().format(number).to_owned()
            };
            if text != &canonical {
                return Err(WireError::Number { path: path.into() });
            }
            if text != "-0"
                && number.abs() <= 9_007_199_254_740_991.0
                && let Ok(integer) = text.parse::<i64>()
            {
                return Ok(DataValue::Number(Number::from(integer)));
            }
            match Number::from_f64(number) {
                Some(number) => Ok(DataValue::Number(number)),
                None => Err(WireError::Number { path: path.into() }),
            }
        }
        ComponentWireValue::Array(_, values) => values
            .iter()
            .enumerate()
            .map(|(index, value)| {
                decode_value(
                    value,
                    &limits::pointer(path, &index.to_string()),
                    depth + 1,
                    visited,
                )
            })
            .collect::<Result<Vec<_>, _>>()
            .map(DataValue::Array),
        ComponentWireValue::Object(_, values) => {
            let mut previous: Option<&str> = None;
            let mut result = BTreeMap::new();
            for (key, value) in values {
                key_allowed(key, &limits::pointer(path, key))?;
                if previous.is_some_and(|previous| !compare_utf16(previous, key).is_lt()) {
                    return Err(WireError::Keys {
                        path: limits::pointer(path, key),
                    });
                }
                previous = Some(key);
                result.insert(
                    key.clone(),
                    decode_value(value, &limits::pointer(path, key), depth + 1, visited)?,
                );
            }
            Ok(DataValue::Object(result))
        }
    }
}

#[cfg(test)]
#[path = "_tests_/wire_props_tests.rs"]
mod wire_props_tests;
