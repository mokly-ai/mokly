//! Immutable compiled recipes restore live generations without reading changed sources.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::Bundle;
use crate::results::Module;

/// One physical filesystem observation used only to validate compilation reuse.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PhysicalInput {
    /// The candidate does not exist.
    Absent,
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

/// Bounded physical observations kept apart from render-key and watch metadata.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, TS)]
pub struct ReuseEvidence {
    /// False when a limit, failed read, or unsupported resolution leaves a gap.
    pub complete: bool,
    /// Physical paths and the observations that both reuse checks must reread.
    pub inputs: BTreeMap<String, PhysicalInput>,
}

/// Private compiled code retained for live generations and bounded release reuse.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CompiledGeneration {
    /// The Mokly, esbuild, Node, package-root, and installed program identity.
    pub toolchain: String,
    /// Cache-only physical inputs, never exported as render or watch inputs.
    pub reuse_evidence: ReuseEvidence,
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
#[serde(rename_all = "camelCase")]
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

impl CompiledGeneration {
    /// Compare the fields used to share compilation inputs between generations.
    pub(super) fn same_recipe(&self, other: &Self) -> bool {
        self.identity == other.identity
            && self.toolchain == other.toolchain
            && self.reuse_evidence == other.reuse_evidence
            && self.inputs == other.inputs
            && self.input_directories == other.input_directories
            && self.unmapped_dependency_directories == other.unmapped_dependency_directories
    }
}
