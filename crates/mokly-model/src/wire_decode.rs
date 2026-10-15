//! Bounded decoding of canonical wire props, including negative zero.

use std::collections::BTreeMap;

use serde_json::{Number, Value};
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
        /// Plain-data validation detail.
        message: String,
    },
}

/// Decode wire props, enforcing canonical number and object spellings.
pub fn decode(props: &ComponentWireProps) -> Result<Props, WireError> {
    let mut visited = 0;
    let props: Props = props
        .iter()
        .map(|(key, value)| {
            let path = limits::pointer("", key);
            decode_value(value, &path, 0, &mut visited).map(|value| (key.clone(), value))
        })
        .collect::<Result<_, _>>()?;
    let value: Value = match serde_json::to_value(&props) {
        Ok(value) => value,
        Err(error) => {
            return Err(WireError::Data {
                path: String::new(),
                message: error.to_string(),
            });
        }
    };
    if let Err((path, message)) = limits::check(&value, true) {
        return Err(WireError::Data {
            path,
            message: message.into(),
        });
    }
    Ok(props)
}

fn decode_value(
    value: &ComponentWireValue,
    path: &str,
    depth: usize,
    visited: &mut usize,
) -> Result<DataValue, WireError> {
    *visited += 1;
    if depth > 64 || *visited > 10_000 {
        return Err(WireError::Data {
            path: path.into(),
            message: "plain data exceeds the depth or visit limit".into(),
        });
    }
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
