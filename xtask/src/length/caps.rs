//! The reviewed protocol cap table, `xtask/protocol-document-caps.json`.

use std::collections::BTreeMap;

use serde_json::Value;

use super::error::{Error, Result};
use super::policy::PROTOCOL_LIMIT;

/// The repository path of the cap table.
pub(crate) const CAP_TABLE: &str = "xtask/protocol-document-caps.json";
/// The largest integer that a JavaScript number holds exactly.
const MAX_SAFE_INTEGER: u64 = (1 << 53) - 1;

/// Exact reviewed caps by Markdown path relative to `docs/protocol/`.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct ProtocolCaps(BTreeMap<String, u64>);

impl ProtocolCaps {
    /// The cap of a document.
    pub(crate) fn get(&self, name: &str) -> Option<u64> {
        self.0.get(name).copied()
    }

    /// The capped documents in byte order.
    pub(crate) fn names(&self) -> impl Iterator<Item = &str> {
        self.0.keys().map(String::as_str)
    }

    /// The number of caps.
    pub(crate) fn len(&self) -> usize {
        self.0.len()
    }

    /// Record a validated cap.
    pub(crate) fn insert(&mut self, name: String, cap: u64) {
        self.0.insert(name, cap);
    }
}

/// Read and validate the cap table. The keys come from the text in source
/// order, because a JSON object keeps only the last of repeated names.
pub(crate) fn parse_cap_table(source: &[u8], label: &str) -> Result<ProtocolCaps> {
    let text = String::from_utf8_lossy(source);
    let table: Value = match serde_json::from_str(&text) {
        Ok(table) => table,
        Err(source) => {
            return Err(Error::CapTableJson {
                label: label.to_owned(),
                source,
            });
        }
    };
    let Some(members) = table.as_object() else {
        return Err(Error::CapTableShape {
            label: label.to_owned(),
        });
    };
    let mut caps = ProtocolCaps::default();
    let mut previous: Option<String> = None;
    for name in top_level_keys(&text) {
        let label = label.to_owned();
        if !is_protocol_document_name(&name) {
            return Err(Error::CapTableKey { label, name });
        }
        if caps.get(&name).is_some() {
            return Err(Error::CapTableRepeat { label, name });
        }
        if let Some(previous) = previous.take()
            && name.encode_utf16().lt(previous.encode_utf16())
        {
            return Err(Error::CapTableOrder {
                label,
                name,
                previous,
            });
        }
        let cap = members
            .get(&name)
            .and_then(safe_integer)
            .filter(|cap| *cap > PROTOCOL_LIMIT);
        let Some(cap) = cap else {
            return Err(Error::CapTableValue { label, name });
        };
        caps.insert(name.clone(), cap);
        previous = Some(name);
    }
    Ok(caps)
}

/// A non-negative JSON number that is a JavaScript safe integer.
pub(crate) fn safe_integer(value: &Value) -> Option<u64> {
    if let Some(integer) = value.as_u64() {
        return (integer <= MAX_SAFE_INTEGER).then_some(integer);
    }
    let number = value.as_f64()?;
    let integral = number.fract() == 0.0 && number >= 0.0 && number <= MAX_SAFE_INTEGER as f64;
    integral.then_some(number as u64)
}

/// Whether a key names a Markdown document by a clean path below
/// `docs/protocol`: no empty, `.`, or `..` segment.
fn is_protocol_document_name(name: &str) -> bool {
    name.ends_with(".md")
        && name
            .split('/')
            .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
}

/// The member names of a valid top-level JSON object in source order: each
/// string at depth one that a colon follows.
fn top_level_keys(text: &str) -> Vec<String> {
    let bytes = text.as_bytes();
    let mut keys = Vec::new();
    let mut depth = 0;
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'{' | b'[' => depth += 1,
            b'}' | b']' => depth -= 1,
            b'"' => {
                let end = closing_quote(bytes, index);
                let after = text[end + 1..].trim_start_matches([' ', '\t', '\n', '\r']);
                if depth == 1
                    && after.starts_with(':')
                    && let Ok(key) = serde_json::from_str::<String>(&text[index..=end])
                {
                    keys.push(key);
                }
                index = end;
            }
            _ => {}
        }
        index += 1;
    }
    keys
}

/// The index of the quote that closes the valid JSON string at `start`.
fn closing_quote(bytes: &[u8], start: usize) -> usize {
    let mut index = start + 1;
    while index < bytes.len() && bytes[index] != b'"' {
        index += if bytes[index] == b'\\' { 2 } else { 1 };
    }
    index.min(bytes.len().saturating_sub(1))
}

#[cfg(test)]
#[path = "_tests_/caps_tests.rs"]
mod caps_tests;
