//! Authenticated fragment placements and collected style ownership.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// API-generated placement, captured before consumer HTML is interpreted.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MarkerDraft {
    /// Fragment-local marker id.
    pub id: String,
    /// Nearest physical enclosing generated marker.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub parent_id: Option<String>,
    /// Authenticated operation and logical payload.
    pub payload: MarkerPayload,
}

/// A consumer comment cannot create any of these operations.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum MarkerPayload {
    /// Adapter output before the consumer renderer adds wrappers.
    Output,
    /// Registered logical component input.
    Instance {
        /// Logical instance key.
        key: String,
    },
    /// Supplied logical slot.
    Slot {
        /// Logical slot key.
        key: String,
    },
    /// Active ignore boundary.
    Ignore {
        /// Optional material digest.
        #[serde(rename = "materialKey", skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        material_key: Option<String>,
    },
    /// Link control that the core adapts.
    Link {
        /// Complete or relative logical destination.
        to: String,
    },
}

/// One collected rule list, with construction-proved component owners.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(deny_unknown_fields)]
pub struct CollectedStyle {
    /// Rendered CSS text.
    pub css: String,
    /// Component parent paths, or empty for selector-based attribution.
    pub owners: Vec<String>,
}
