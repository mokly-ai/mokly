//! Retain only ancestor dependency directories that the current render actually reads.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;

/// Observed dependency reads used when selecting a historical installation.
#[cfg_attr(test, unimock::unimock(api = DependencyUsageMock))]
pub trait DependencyUsage: Send + Sync {
    /// Record a resolved module or stylesheet in its side's logical namespace.
    fn record(&self, aliases: &BTreeMap<String, String>, path: &str);
    /// Repository-relative node_modules directories used by the current side.
    fn directories(&self) -> Vec<String>;
}

#[derive(Default)]
pub(crate) struct UsedDependencies(Mutex<BTreeSet<String>>);
impl DependencyUsage for UsedDependencies {
    fn record(&self, aliases: &BTreeMap<String, String>, path: &str) {
        let prefix = if let Some(rest) = path.strip_prefix("node_modules/.mokly-roots/") {
            let Some((index, _)) = rest.split_once('/') else {
                return;
            };
            format!("node_modules/.mokly-roots/{index}")
        } else if path.starts_with("node_modules/") {
            "node_modules".into()
        } else {
            return;
        };
        if let Some((authored, _)) = aliases
            .iter()
            .filter(|(_, logical)| **logical == prefix)
            .max_by_key(|(authored, _)| authored.len())
        {
            self.0
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert(authored.clone());
        }
    }

    fn directories(&self) -> Vec<String> {
        self.0
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .cloned()
            .collect()
    }
}

#[cfg(test)]
#[path = "_tests_/dependency_usage_tests.rs"]
mod dependency_usage_tests;
