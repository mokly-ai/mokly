//! Bundle wire replies distinguish full data from an installed restore reference.

use serde::Serialize;
use ts_rs::TS;

use crate::results::Bundle;

/// A bundle result before the client expands a restored compilation reference.
#[derive(Clone, Debug, Serialize, TS)]
#[serde(untagged)]
#[ts(untagged)]
pub enum BundleReply {
    /// Complete compilation data for a fresh or sidecar-compiled lifetime.
    Full(Box<Bundle>),
    /// A successful unchanged reuse of an actual installed restore.
    Restored(RestoredBundle),
}

/// New evaluated lifetime and the exact installed restore that supplied its code.
#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RestoredBundle {
    /// New evaluated lifetime, which can equal the restore id.
    pub generation: String,
    /// Installed restore whose unchanged compilation passed the reuse proof.
    pub restored_generation: String,
}
