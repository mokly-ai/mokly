//! Bounded JSON traversal and exact JSON Pointer construction.

use serde_json::Value;
use thiserror::Error;

/// Maximum nesting depth for schemas and props.
pub const MAX_DEPTH: usize = 64;
/// Maximum visited values for schemas and props.
pub const MAX_NODES: usize = 10_000;

/// Plain-data rule violated by a value. The messages name the limits above.
#[derive(Clone, Debug, Eq, PartialEq, Error)]
pub enum DataViolation {
    /// Nested data exceeds the profile's depth.
    #[error("exceeds {MAX_DEPTH} nesting levels")]
    Depth,
    /// Data exceeds the profile's traversal budget.
    #[error("exceeds {MAX_NODES} visited nodes")]
    Nodes,
    /// An object declares a forbidden property name.
    #[error("reserved property name")]
    ReservedKey,
}

/// Append an escaped JSON Pointer segment.
pub fn pointer(parent: &str, key: &str) -> String {
    format!("{parent}/{}", key.replace('~', "~0").replace('/', "~1"))
}

/// Find the first invalid data key or exceeded traversal limit.
/// Enable reserved-key checks for props; schema keyword placement is separate.
pub fn check(
    value: &Value,
    reserved_keys: bool,
) -> std::result::Result<(), (String, DataViolation)> {
    walk(value, &mut String::new(), 0, &mut 0, reserved_keys)
}

fn walk(
    value: &Value,
    path: &mut String,
    depth: usize,
    visited: &mut usize,
    reserved_keys: bool,
) -> std::result::Result<(), (String, DataViolation)> {
    if depth > MAX_DEPTH {
        return Err((path.clone(), DataViolation::Depth));
    }
    if *visited == MAX_NODES {
        return Err((path.clone(), DataViolation::Nodes));
    }
    *visited += 1;
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                let length = path.len();
                path.push('/');
                path.push_str(&key.replace('~', "~0").replace('/', "~1"));
                if reserved_keys
                    && matches!(key.as_str(), "__proto__" | "constructor" | "prototype")
                {
                    return Err((path.clone(), DataViolation::ReservedKey));
                }
                walk(value, path, depth + 1, visited, reserved_keys)?;
                path.truncate(length);
            }
        }
        Value::Array(values) => {
            for (index, value) in values.iter().enumerate() {
                let length = path.len();
                path.push('/');
                path.push_str(&index.to_string());
                walk(value, path, depth + 1, visited, reserved_keys)?;
                path.truncate(length);
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
#[path = "_tests_/limits_tests.rs"]
mod limits_tests;
