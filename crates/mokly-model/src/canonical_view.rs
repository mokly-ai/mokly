//! Readable views of canonical JSON for snapshot tests.
//!
//! Canonical bytes are a function of their JSON value, so a view of a checked canonical
//! value pins every byte while it shows one field per line.

use serde_json::Value;

use crate::canonical;

/// Return `text` with two-space indentation when it is canonical JSON, or `None` otherwise.
/// The view keeps the canonical key order and number spelling.
pub fn pretty(text: &str) -> Option<String> {
    let value: Value = serde_json::from_str(text).ok()?;
    if canonical::to_string(&value).ok()? != text {
        return None;
    }
    let mut view = serde_json::to_string_pretty(&value).ok()?;
    view.push('\n');
    Some(view)
}

#[cfg(test)]
#[path = "_tests_/canonical_view_tests.rs"]
mod canonical_view_tests;
