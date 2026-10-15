//! Core-resolved catalogue bindings and explicit render inputs.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Resolved identity of a parent entry or a rendered variant.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct EntryBinding {
    /// Complete catalogue path.
    pub path: String,
    /// Effective display title.
    pub title: String,
}

/// Complete handle table installed after definition discovery.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "BindingsParams")]
pub struct Bindings {
    /// Loaded generation.
    pub generation: String,
    /// Definition handle to resolved parent entry.
    pub entries: BTreeMap<String, EntryBinding>,
}

/// A slot value belongs either to the core or to the loaded generation.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum SlotInput {
    /// HTML content that the core will graft at the returned placeholder.
    Placeholder {
        /// Opaque core placeholder token.
        token: String,
    },
    /// React content saved during describe.
    Saved {
        /// Opaque generation-local saved value.
        handle: String,
    },
}

/// Release a consumer PostCSS context independently of bundles.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(rename = "DisposeContextParams")]
pub struct DisposeContext {
    /// Core-chosen stylesheet generation id.
    pub context: String,
}
