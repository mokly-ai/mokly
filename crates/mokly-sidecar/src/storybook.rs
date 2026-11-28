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

/// The outcome of loading a Storybook main file for discovery.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum ReadStorybookReply {
    /// A loaded main file and its normalized entries.
    Loaded(ReadStorybookResult),
    /// The selected main file could not supply valid stories.
    Failed {
        /// The main file path and the reason it failed.
        #[serde(rename = "mainError")]
        main_error: String,
    },
}

/// The selected main file, its stories entries, and the inputs that it used.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ReadStorybookResult {
    /// Selected main file relative to the source root.
    pub main: String,
    /// Entries in authored order.
    pub entries: Vec<StorybookEntry>,
    /// Source digests by repository-relative path, with null for absent candidates.
    pub inputs: BTreeMap<String, Option<String>>,
    /// Installation directories used by the loader, relative to the dependency root.
    pub dependency_directories: Vec<String>,
}

/// The preview choice made before compiling the stories of one folder.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct PreviewSelection {
    /// First regular preview file in Storybook order, if present.
    pub selected: Option<PreviewModule>,
    /// Candidate paths observed without a regular file.
    pub absent: Vec<String>,
}

/// The written path and the resolved module compiled from it.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct PreviewModule {
    /// Repository-relative name selected by the probe.
    pub path: String,
    /// Resolved filename relative to the source root, or absolute when outside it.
    pub file: String,
}
