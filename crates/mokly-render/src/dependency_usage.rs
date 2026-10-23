//! Retain only ancestor dependency directories that the current render actually reads.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;

use mokly_compare::ancestor_roots::dependency_directory;

/// Observed dependency reads used when selecting a historical installation.
#[cfg_attr(test, unimock::unimock(api = DependencyUsageMock))]
pub trait DependencyUsage: Send + Sync {
    /// Record a resolved module or stylesheet in its side's logical namespace.
    fn record(&self, aliases: &BTreeMap<String, String>, path: &str);
    /// Record lookup outside configured roots; retain supported repository directories.
    fn unmapped(&self, directory: &str);
    /// Used directories outside the supported base lookup.
    fn unmapped_directories(&self) -> Vec<String>;
    /// Repository-relative node_modules directories used by the current side.
    fn directories(&self) -> Vec<String>;
}

#[derive(Default)]
pub(crate) struct UsedDependencies {
    mapped: Mutex<BTreeSet<String>>,
    unmapped: Mutex<BTreeSet<String>>,
}
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
            let parts: Vec<_> = path.split('/').collect();
            if let Some(index) = parts.iter().position(|part| *part == "node_modules") {
                self.unmapped(&parts[..=index].join("/"));
            }
            return;
        };
        if let Some((authored, _)) = aliases
            .iter()
            .filter(|(_, logical)| **logical == prefix)
            .max_by_key(|(authored, _)| authored.len())
        {
            self.mapped
                .lock()
                .unwrap_or_else(|error| error.into_inner())
                .insert(authored.clone());
        }
    }

    fn unmapped(&self, directory: &str) {
        let directories = if dependency_directory(directory).as_deref() == Some(directory) {
            &self.mapped
        } else {
            &self.unmapped
        };
        directories
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(directory.into());
    }
    fn unmapped_directories(&self) -> Vec<String> {
        self.unmapped
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .iter()
            .cloned()
            .collect()
    }
    fn directories(&self) -> Vec<String> {
        self.mapped
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
