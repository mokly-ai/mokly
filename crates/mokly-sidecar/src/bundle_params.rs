//! Inputs compiled into one unevaluated bundle.

use std::sync::Arc;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::{ModuleResolution, disabled};

/// Inputs compiled into one unevaluated bundle.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "BundleParams")]
pub struct Bundle {
    /// Opt-in project Vite compilation; omission preserves esbuild settings bytes.
    #[serde(default, skip_serializing_if = "disabled")]
    #[ts(optional, as = "Option<bool>")]
    pub vite: bool,
    /// Extra setup inputs for an enabled Vite adapter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub vite_inputs: Option<Arc<ViteSetupInputs>>,
    /// Core input digest that isolates resolved bindings and CSS Modules lifetimes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub evaluation: Option<String>,
    /// Entry module files.
    pub entry_files: Vec<String>,
    /// Optional consumer renderer module as a repository-relative path without `.` or `..` segments.
    pub renderer: Option<String>,
    /// Storybook files.
    pub stories_files: Vec<String>,
    /// Consumer resolution policy.
    pub module_resolution: ModuleResolution,
    /// Source checkout or extracted base root.
    pub source_root: String,
    /// Configuration directory relative to the side source root.
    pub configuration_directory: String,
    /// Physical repository roots whose local packages map into this side.
    pub repository_roots: Vec<String>,
}

/// Setup inputs needed by both JavaScript and stylesheet compilation.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ViteSetupInputs {
    /// Repository files named by rebuild rules, in path order.
    pub rebuild_files: Vec<String>,
    /// Working dotenv candidates available to a historical setup.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub base_env: Option<ViteBaseEnv>,
}

/// Source selection for dotenv reads against an immutable base extraction.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ViteBaseEnv {
    /// Root containing the untracked working copies.
    pub working_root: String,
    /// Repository-relative dotenv paths tracked by the working Git index.
    pub indexed: Vec<String>,
}
