//! Source-side Storybook configuration discovery over the sidecar protocol.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::ModuleResolution;

/// Read one Storybook folder before source discovery.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReadStorybookParams {
    /// Working source root or the base extraction, used as the worker's directory.
    pub source_root: String,
    /// Directory of the Mokly configuration, relative to the source root.
    pub configuration_directory: String,
    /// Storybook folder relative to the source root.
    pub folder: String,
    /// Physical roots that the selected side maps into its source tree.
    pub repository_roots: Vec<String>,
    /// This side's selected package lookup settings and dependency tier.
    pub module_resolution: ModuleResolution,
}

/// A stories entry normalized by the installed Storybook loader.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct StorybookEntry {
    /// Directory relative to the source root.
    pub directory: String,
    /// Storybook glob relative to the directory.
    pub files: String,
}

/// The selected main file, its stories entries, and the inputs that it used.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReadStorybookResult {
    /// Selected main file relative to the source root.
    pub main: String,
    /// Entries in authored order.
    pub entries: Vec<StorybookEntry>,
    /// Digests keyed by repository-relative source path.
    pub inputs: BTreeMap<String, String>,
    /// Installation directories used by the loader, relative to the dependency root.
    pub dependency_directories: Vec<String>,
}
