//! Confinement checks for npm lockfile local references.
//!
//! npm reads `packages` keys and link `resolved` values as folders, and v1
//! `version` values as specifications, all from the lockfile folder. Every
//! other `resolved` value is a specification. A link is any entry whose
//! `link` value is truthy in JavaScript, because npm tests it that way.
//! Bytes that do not parse as JSON fall back, after a byte-order mark is
//! removed as npm removes it.

use serde_json::{Map, Value};

use crate::error::{Error, Result};
use crate::local_specifications;
use crate::manifest;

pub(crate) fn validate(bytes: &[u8], path: &str) -> Result<()> {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    let Ok(value) = serde_json::from_slice::<Value>(bytes) else {
        return Err(Error::InvalidInput { path: path.into() });
    };
    let folder = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    if let Some(Value::Object(packages)) = value.get("packages") {
        for (key, entry) in packages {
            if !key.is_empty() {
                manifest::target(folder, key)?;
            }
            if entry.get("link").is_some_and(truthy)
                && let Some(resolved) = entry.get("resolved").and_then(Value::as_str)
            {
                manifest::target(folder, resolved)?;
            }
        }
    }
    if let Some(Value::Object(dependencies)) = value.get("dependencies") {
        versions(dependencies, folder)?;
    }
    visit(&value, folder)
}

fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(value) => value.as_f64().is_some_and(|value| value != 0.0),
        Value::String(value) => !value.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

fn versions(dependencies: &Map<String, Value>, folder: &str) -> Result<()> {
    for entry in dependencies.values() {
        if let Some(version) = entry.get("version").and_then(Value::as_str) {
            local_specifications::validate(version, folder, folder)?;
        }
        if let Some(Value::Object(nested)) = entry.get("dependencies") {
            versions(nested, folder)?;
        }
    }
    Ok(())
}

fn visit(value: &Value, parent: &str) -> Result<()> {
    match value {
        Value::Object(fields) => {
            for (key, value) in fields {
                if matches!(key.as_str(), "resolved" | "link")
                    && let Value::String(value) = value
                {
                    local_specifications::validate(value, parent, parent)?;
                }
                visit(value, parent)?;
            }
        }
        Value::Array(values) => {
            for value in values {
                visit(value, parent)?;
            }
        }
        _ => {}
    }
    Ok(())
}
