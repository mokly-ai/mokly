//! Confinement checks for npm lockfile local references.

use serde_json::Value;

use crate::error::{Error, Result};
use crate::local_specifications;

pub(crate) fn validate(bytes: &[u8], path: &str) -> Result<()> {
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| Error::InvalidInput { path: path.into() })?;
    let parent = path
        .rsplit_once('/')
        .map(|(parent, _)| parent)
        .unwrap_or("");
    visit(&value, parent)
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
