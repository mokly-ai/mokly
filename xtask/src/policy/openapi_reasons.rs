//! Pure validation of the OpenAPI reason inventory against the REST catalogue.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::error::{Error, Result};
use crate::policy::diagnostic::Violation;

pub(super) fn validate(
    document: &Value,
    catalogue: &str,
    protocols: &BTreeMap<PathBuf, String>,
) -> Result<()> {
    let mut known = BTreeSet::new();
    let mut reserved = BTreeSet::new();
    for row in catalogue.lines().filter(|row| row.starts_with("| `")) {
        let columns: Vec<_> = row.split('|').map(str::trim).collect();
        let reason = columns
            .get(1)
            .copied()
            .unwrap_or_default()
            .trim_matches('`');
        if columns.len() != 7 || !valid_name(reason) || !known.insert(reason) {
            return Err(invalid("malformed or duplicate REST reason row"));
        }
        let when_returned = columns[4];
        if when_returned.starts_with("Reserved:") || when_returned.starts_with("Deferred:") {
            reserved.insert(reason);
        }
    }
    if known.is_empty() {
        return Err(invalid("missing REST reason catalogue"));
    }
    let inventory = reasons(
        &document["components"]["schemas"]["Error"]["x-reasons"],
        &known,
    )?;
    visit(document, &known, &inventory, &reserved)?;
    for (path, prose) in protocols {
        if path != Path::new("docs/protocol/cloud/rest-api.md") {
            protocol_reasons(prose, &known)?;
        } else {
            let prose: String = prose
                .lines()
                .filter(|line| !line.starts_with('|'))
                .collect::<Vec<_>>()
                .join("\n");
            protocol_reasons(&prose, &known)?;
        }
    }
    Ok(())
}

fn reasons<'a>(value: &'a Value, known: &BTreeSet<&str>) -> Result<BTreeSet<&'a str>> {
    let list = value
        .as_array()
        .filter(|list| !list.is_empty())
        .ok_or_else(|| invalid("x-reasons must be a nonempty array"))?;
    let mut result = BTreeSet::new();
    for value in list {
        let reason = value
            .as_str()
            .ok_or_else(|| invalid("reason must be a string"))?;
        if !valid_name(reason) || !known.contains(reason) {
            return Err(invalid(reason));
        }
        if !result.insert(reason) {
            return Err(invalid("duplicate x-reasons value"));
        }
    }
    Ok(result)
}

fn visit(
    value: &Value,
    known: &BTreeSet<&str>,
    inventory: &BTreeSet<&str>,
    reserved: &BTreeSet<&str>,
) -> Result<()> {
    match value {
        Value::Object(fields) => {
            let implemented = fields
                .get("operationId")
                .and_then(Value::as_str)
                .filter(|_| fields.get("x-deferred").and_then(Value::as_bool) != Some(true));
            if implemented.is_some() && !fields.contains_key("x-reasons") {
                return Err(invalid("implemented operation requires x-reasons"));
            }
            if let Some(value) = fields.get("x-reasons") {
                for reason in reasons(value, known)? {
                    if !inventory.contains(reason) {
                        return Err(invalid(reason));
                    }
                    if let Some(operation) = implemented
                        && reserved.contains(reason)
                    {
                        return Err(Error::Violations(vec![Violation::OpenapiReservedReason {
                            operation: operation.to_owned(),
                            reason: reason.to_owned(),
                        }]));
                    }
                }
            }
            if let Some(description) = fields.get("description").and_then(Value::as_str) {
                for token in description.split('`').skip(1).step_by(2) {
                    if valid_name(token) && token.contains('-') && !inventory.contains(token) {
                        return Err(invalid(token));
                    }
                }
            }
            for value in fields.values() {
                visit(value, known, inventory, reserved)?;
            }
        }
        Value::Array(values) => {
            for value in values {
                visit(value, known, inventory, reserved)?;
            }
        }
        _ => (),
    }
    Ok(())
}

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        })
}

fn invalid(reason: &str) -> Error {
    Error::Violations(vec![Violation::OpenapiReason(reason.to_owned())])
}

/// Markdown identifies reasons with return/returns/returned or reason/reasons.
/// Normalized known names also catch accidental underscores anywhere in prose.
/// Wrapped markers stay within one paragraph and never cross a code fence.
fn protocol_reasons(prose: &str, known: &BTreeSet<&str>) -> Result<()> {
    let mut fenced = false;
    let mut previous_word = None;
    for line in prose.lines() {
        if line.trim_start().starts_with("```") {
            fenced = !fenced;
            previous_word = None;
            continue;
        }
        if fenced {
            continue;
        }
        if line.trim().is_empty() {
            previous_word = None;
            continue;
        }
        let parts: Vec<_> = line.split('`').collect();
        for index in (1..parts.len()).step_by(2) {
            let token = parts[index];
            let prefix = parts[index - 1].trim_end().to_ascii_lowercase();
            let marker = prefix
                .split_whitespace()
                .last()
                .or(previous_word)
                .unwrap_or_default()
                .trim_end_matches(':')
                .to_ascii_lowercase();
            let marked = matches!(
                marker.as_str(),
                "reason" | "reasons" | "return" | "returns" | "returned"
            );
            let normalized = token.replace('_', "-");
            let name_like = valid_name(&normalized) && (token.contains('-') || token.contains('_'));
            if ((marked && name_like) || known.contains(normalized.as_str()))
                && !known.contains(token)
            {
                return Err(invalid(token));
            }
        }
        previous_word = line.split_whitespace().last();
    }
    Ok(())
}
