//! Immutable compiled recipes restore live generations without reading changed sources.

use std::collections::BTreeMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::{Bundle, BundleCapture};
use crate::results::Module;

/// One physical filesystem observation used only to validate compilation reuse.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PhysicalInput {
    /// The candidate does not exist.
    Absent,
    /// A canonical regular-file path, without a dependency on its content.
    FilePath,
    /// A regular file's SHA-256 content digest.
    File {
        /// The regular file's SHA-256 content digest.
        digest: String,
    },
    /// Every entry of a searched directory, including directories and links.
    Directory {
        /// Complete entries ordered by their UTF-8 names.
        entries: Vec<PhysicalEntry>,
    },
    /// The canonical target of a lexical link in a candidate path.
    Link {
        /// The canonical filesystem target of the lexical link.
        target: String,
    },
}

/// The filesystem kind of one directory entry.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub enum PhysicalEntryKind {
    /// A regular file.
    File,
    /// A directory.
    Directory,
    /// A symbolic link or directory junction.
    Link,
    /// An entry which cannot supply a module.
    Other,
}

/// A directory member and the real target of a link, when present.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct PhysicalEntry {
    /// The member's exact filesystem name.
    pub name: String,
    /// Its filesystem kind without following links.
    pub kind: PhysicalEntryKind,
    /// The canonical target for a link, absent for other kinds.
    pub target: Option<String>,
}

/// A deliberate omission of capture, admitted only by the matching live request.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub enum UncapturedEvidence {
    /// Serve edit compilation kept live checks and private package-folder file observations.
    ServeEdit,
}

/// Bounded physical observations kept apart from render-key and watch metadata.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct ReuseEvidence {
    /// False when a limit, failed read, or unsupported resolution leaves a gap.
    pub complete: bool,
    /// Capture witnesses proved a stable view on supported local volumes.
    pub durable: bool,
    /// Explicit live-only capture omission, never a durable recipe.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub uncaptured: Option<UncapturedEvidence>,
    /// Physical paths and the observations that both reuse checks must reread.
    pub inputs: BTreeMap<String, PhysicalInput>,
}

impl ReuseEvidence {
    /// Physical inputs cover the compilation without an explicit capture omission.
    pub fn captured(&self) -> bool {
        self.complete && self.uncaptured.is_none()
    }

    /// A Serve edit omission admits only cache-file observations alongside its live checks.
    pub fn serve_edit(&self) -> bool {
        self.uncaptured == Some(UncapturedEvidence::ServeEdit)
            && !self.complete
            && !self.durable
            && self.inputs.values().all(|input| {
                matches!(
                    input,
                    PhysicalInput::File { .. } | PhysicalInput::Absent | PhysicalInput::Link { .. }
                )
            })
    }

    /// Full requests require captured inputs; Serve edits also admit their marker.
    pub fn reusable(&self, capture: BundleCapture) -> bool {
        self.captured() || capture == BundleCapture::ServeEdit && self.serve_edit()
    }
}

/// Private compiled code retained for live generations and bounded release reuse.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CompiledGeneration {
    /// Recorded Vite fetches, replayed without a server or source reads.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub vite: Option<ViteRecipe>,
    /// The Mokly, esbuild, Node, package-root, and installed program identity.
    pub toolchain: String,
    /// Stable compilation metadata absent from per-document render keys.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub metadata_identity: Option<String>,
    /// Cache-only physical inputs, never exported as render or watch inputs.
    pub reuse_evidence: Arc<ReuseEvidence>,
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

/// A Vite generation's entry and immutable fetch transport.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct ViteRecipe {
    /// Installed Vite version for replay diagnostics.
    pub version: String,
    /// Digest of all setup inputs shared by the side's render keys.
    #[serde(
        rename = "setupDigest",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub setup_digest: Option<String>,
    /// Virtual entry URL used by the module runner.
    pub entry: String,
    /// Each fetch indexed by the requested URL and importer.
    pub modules: Vec<ViteModuleFetch>,
}

/// One response to Vite's module-runner fetch protocol.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct ViteModuleFetch {
    /// Requested module URL, before resolution.
    pub url: String,
    /// Resolved importing module id, absent for the entry.
    pub importer: Option<String>,
    /// Transformed code or an external dependency.
    pub result: ViteFetchResult,
}

/// Uncached Vite fetch responses retained by the recipe.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(untagged)]
pub enum ViteFetchResult {
    /// A transformed ESM module.
    Transformed {
        /// Code for Vite's module evaluator.
        code: String,
        /// Physical source file, absent for a virtual module.
        file: Option<String>,
        /// Resolved module id, including a query variant.
        id: String,
        /// Module URL in Vite's graph.
        url: String,
        /// Whether the runner must discard a previous evaluated value.
        invalidate: bool,
    },
    /// An external module loaded by the evaluator.
    External {
        /// Physical file URL, Node builtin, or reserved Mokly key.
        externalize: String,
        /// Evaluation and export interop rule.
        r#type: ViteExternalType,
    },
}

/// The external evaluation kinds that Vite reports.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "lowercase")]
pub enum ViteExternalType {
    /// Native ESM dependency.
    Module,
    /// CommonJS dependency.
    Commonjs,
    /// Node builtin.
    Builtin,
    /// URL handled by the runtime.
    Network,
}

/// Install captured code in a fresh worker without invoking esbuild.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RestoreGeneration {
    /// Original evaluated-lifetime id.
    pub generation: String,
    /// Original side and resolution settings.
    pub params: Bundle,
    /// Module graph, stored once outside the compiled program.
    pub modules: Arc<Vec<Module>>,
    /// Immutable compilation.
    pub compiled: Arc<CompiledGeneration>,
}

impl CompiledGeneration {
    /// Compare the fields used to share compilation inputs between generations.
    pub(super) fn same_recipe(&self, other: &Self) -> bool {
        self.identity == other.identity
            && self.toolchain == other.toolchain
            && self.metadata_identity == other.metadata_identity
            && self.reuse_evidence.complete == other.reuse_evidence.complete
            && self.reuse_evidence.uncaptured == other.reuse_evidence.uncaptured
            && self.reuse_evidence.inputs == other.reuse_evidence.inputs
            && self.inputs == other.inputs
            && self.input_directories == other.input_directories
            && self.unmapped_dependency_directories == other.unmapped_dependency_directories
    }
}

#[cfg(test)]
#[path = "_tests_/vite_compiled_tests.rs"]
mod vite_compiled_tests;

#[cfg(test)]
#[path = "_tests_/compiled_evidence_tests.rs"]
mod compiled_evidence_tests;
