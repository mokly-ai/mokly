//! Immutable compiled recipes restore live generations without reading changed sources.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::Bundle;
use crate::results::Module;

/// Private compiled code retained only while its generation is live.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompiledGeneration {
    /// Dependency lookup provenance retained across restored worker generations.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub unmapped_dependency_directories: Option<Vec<String>>,
    /// Compilation identity before evaluation settings.
    pub identity: String,
    /// Compiled CommonJS program.
    pub code: String,
    /// Private authoring import namespace embedded in the program.
    pub runtime_key: String,
    /// Physical selected dependency roots.
    pub dependency_roots: Vec<String>,
    /// Files which require class maps at evaluation.
    pub css_modules: Vec<String>,
    /// Captured entry text used by definition diagnostics.
    pub sources: BTreeMap<String, String>,
    /// Resolved external peers, under the original resolution policy.
    pub peers: BTreeMap<String, Option<String>>,
    /// Physical digest-only compilation and peer inputs, including absent preview candidates.
    pub inputs: BTreeMap<String, Option<String>>,
    /// Logical extra inputs for the Rust reuse check.
    pub metadata_inputs: BTreeMap<String, Option<String>>,
    /// Physical consumed-module directories and their file membership.
    pub input_directories: BTreeMap<String, Vec<String>>,
    /// Logical directory membership for the core reuse stamp.
    pub metadata_directories: BTreeMap<String, Vec<String>>,
}

/// Install captured code in a fresh worker without invoking esbuild.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RestoreGeneration {
    /// Original evaluated-lifetime id.
    pub generation: String,
    /// Original side and resolution settings.
    pub params: Bundle,
    /// Module graph, stored once outside the compiled program.
    pub modules: Vec<Module>,
    /// Immutable compilation.
    pub compiled: CompiledGeneration,
}
