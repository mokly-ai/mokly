//! Public catalogue identity, metadata, and independent comparison states.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Origin-scoped catalogue identity.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueIdentity {
    /// Lowercase SHA-256 of the configuration identity preimage.
    pub id: String,
    /// Catalogue title, Mokly.
    pub title: String,
}

/// Changes preparation state.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ChangesStatus {
    /// Preparing inputs.
    Preparing,
    /// Comparison queued or running.
    Pending,
    /// Evidence ready.
    Ready,
    /// Evidence unavailable.
    Unavailable,
    /// Comparison disabled.
    Disabled,
}
/// A completed change classification.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    /// Newly added entry.
    Added,
    /// Material or metadata change.
    Changed,
    /// Historical removed entry.
    Removed,
    /// No material change.
    Unmodified,
}

/// Entry-level membership in Changes.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "status", rename_all = "lowercase", deny_unknown_fields)]
pub enum CatalogueChanges {
    /// Preparing state.
    Preparing,
    /// Pending state.
    Pending,
    /// Unavailable state.
    Unavailable,
    /// Disabled state.
    Disabled,
    /// Evidence is ready.
    Ready {
        /// Completed classification.
        kind: ChangeKind,
        /// Whether Changes includes the entry.
        included: bool,
    },
}

/// Per-view comparison eligibility.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(tag = "status", rename_all = "lowercase", deny_unknown_fields)]
pub enum ComparisonSelection {
    /// Preparing state.
    Preparing,
    /// Pending state.
    Pending,
    /// Unavailable state.
    Unavailable,
    /// Disabled state.
    Disabled,
    /// Evidence is ready.
    Ready {
        /// Completed classification.
        kind: ChangeKind,
        /// Whether a comparison can be selected.
        eligible: bool,
    },
}

/// Authored display metadata with no source-serving permission.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueDetails {
    /// Description text.
    pub description: String,
    /// Optional rationale.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub rationale: Option<String>,
    /// Validated document references or display labels.
    pub related_docs: Vec<String>,
    /// Repository-relative source metadata.
    pub source_path: String,
}

/// Public fields shared by all record kinds.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueEntry {
    /// Complete entry path.
    pub path: String,
    /// Content id of this entry's detail.
    pub detail_id: String,
    /// Paired previous path, when Changes proves a move.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub previous_path: Option<String>,
    /// Display title.
    pub title: String,
    /// Authored unique tags.
    pub tags: Vec<String>,
    /// Authored display details.
    pub details: CatalogueDetails,
    /// Entry-level Changes state.
    pub changes: CatalogueChanges,
}
