//! Typed catalogue states and the view axes shared with the cloud API.

use serde::{Deserialize, Serialize};
#[cfg(feature = "openapi")]
use utoipa::ToSchema;

/// Responsive document axis.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum Viewport {
    /// Mobile document.
    Mobile,
    /// Desktop document.
    Desktop,
}

impl Viewport {
    /// Name used in view routes.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Mobile => "mobile",
            Self::Desktop => "desktop",
        }
    }
}

/// Effective document colour scheme.
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(ToSchema))]
pub enum ColorScheme {
    /// Light rendering.
    Light,
    /// Dark rendering.
    Dark,
}

/// Availability of an index's Changes result.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChangesStatus {
    /// The producer is preparing a comparison.
    Preparing,
    /// The producer has queued a comparison.
    Pending,
    /// The comparison is complete.
    Ready,
    /// The comparison could not be produced.
    Unavailable,
    /// The producer disabled comparison.
    Disabled,
}

/// Classification of a counted index record.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    /// An added entry.
    Added,
    /// An edited entry.
    Changed,
    /// A removed entry.
    Removed,
    /// An entry with no material edit, including a pure move.
    Unmodified,
}
