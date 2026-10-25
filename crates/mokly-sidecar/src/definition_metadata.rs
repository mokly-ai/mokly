//! Typed declarative entry metadata used by describe records.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// An authored path or an imported definition resolved by its opaque handle.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(untagged)]
pub enum EntryReference {
    /// Authored logical path.
    Path(String),
    /// Imported definition identity, distinct from an authored string.
    Definition {
        /// Generation-local module and export handle.
        handle: String,
    },
}

/// Common entry metadata before path derivation and registry validation.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct EntryMetadata {
    /// Complete declared path override.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub path: Option<String>,
    /// Authored final path segment.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub slug: Option<String>,
    /// Display title.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
    /// Description.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
    /// Design rationale.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rationale: Option<String>,
    /// Ordered related document paths.
    #[serde(default)]
    pub related_docs: Vec<String>,
    /// Ordered authored tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// Previous path for move pairing.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub moved_from: Option<String>,
}

/// One ordered use-case step.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UseCaseStep {
    /// Screen path or imported definition.
    pub screen_path: EntryReference,
    /// Optional step title.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub title: Option<String>,
    /// Optional step description.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub description: Option<String>,
}
