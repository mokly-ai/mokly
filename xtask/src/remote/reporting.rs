//! Stable warning lines with one copy of each module prefix.

use std::collections::BTreeSet;
use std::fmt::Display;

/// Format an embedded error while reserving the reporter's executor prefix.
pub(crate) fn warning(context: &str, error: &dyn Display) -> String {
    let message = if context.is_empty() {
        format!("warning: {error}")
    } else {
        format!("warning: {context}: {error}")
    };
    let mut prefixes = BTreeSet::from(["[xtask/executor]"]);
    message
        .split_whitespace()
        .filter(|word| {
            !word.starts_with("[xtask/") || !word.ends_with(']') || prefixes.insert(word)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
#[path = "_tests_/reporting_tests.rs"]
mod reporting_tests;
