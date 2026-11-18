//! Changes membership and historical metadata for one pinned base commit.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::snapshot_records::EntryRecord;

/// One accepted current path and historical counterpart.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MovedEntrySnapshot {
    /// Current path.
    pub path: String,
    /// Original base path.
    pub previous_path: String,
}

/// A removed record selected before public projection.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemovedEntrySnapshot {
    /// Complete historical record without routes.
    pub entry: EntryRecord,
    /// Resolved base folder titles, from top to bottom.
    pub folder_titles: Vec<String>,
    /// Base parent title exactly on variants.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_title: Option<String>,
    /// Unique lowercase SHA-256 identity of this removed record and base.
    pub snapshot_id: String,
}

/// Catalogue-wide Changes membership paired with review v8.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogueChangeSnapshotV4 {
    /// Exactly 4.
    #[ts(type = "4")]
    pub schema_version: u32,
    /// Configured or command-line base ref.
    pub base_ref: String,
    /// Pinned merge base, equal to review v8.
    pub base_commit: String,
    /// Sorted unique current and selected removed paths.
    pub changed_entries: Vec<String>,
    /// Accepted moves sorted by current path.
    pub moved_entries: Vec<MovedEntrySnapshot>,
    /// Selected historical records in parent and variant order.
    pub removed_entries: Vec<RemovedEntrySnapshot>,
}

/// Small descriptor for a removed page or document's historical bytes.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemovedPagePreview {
    /// Exactly 3.
    #[ts(type = "3")]
    pub schema_version: u32,
    /// Configured base ref.
    pub base_ref: String,
    /// Pinned merge base.
    pub base_commit: String,
    /// Selected historical entry.
    pub path: String,
}
