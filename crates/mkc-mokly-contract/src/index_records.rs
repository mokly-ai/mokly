//! Read-only projections of validated index records for publication consumers.

use serde::Deserialize;

use crate::index_values::{ChangeKind, ColorScheme, Viewport};

/// Axes of one current screen view, in the index's order.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewAxes {
    /// Responsive document axis.
    pub viewport: Viewport,
    /// Effective colour scheme.
    pub color_scheme: ColorScheme,
}

/// A current screen or screen variant, with no historical or component views.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Screen {
    /// Authored-case current entry path.
    pub path: String,
    /// Unchanged producer title.
    pub title: String,
    /// Available current views, in index order.
    pub views: Vec<ViewAxes>,
}

/// One ready, included record in the check's canonical entry order.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CountedRecord {
    /// Current entry path, or the base path of a removed record.
    pub path: String,
    /// Unchanged producer title for check links.
    pub title: String,
    /// Bucket classification supplied by Changes.
    pub kind: ChangeKind,
    /// Producer-paired base path on a current record; absent on removed records.
    pub previous_path: Option<String>,
}

/// Changes buckets and the moved subset, each record counted once.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ChangesCount {
    /// Edited and included unmodified entries.
    pub changed: u64,
    /// Added entries.
    pub added: u64,
    /// Removed entries.
    pub removed: u64,
    /// Counted current entries with a previous path; part of the total.
    pub moved: u64,
}

impl ChangesCount {
    /// Number of counted records; moved entries are already in a bucket.
    pub fn total(self) -> u64 {
        self.changed + self.added + self.removed
    }
}
