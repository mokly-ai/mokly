//! The request to transform one stylesheet through the side's Vite setup.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::methods::Bundle;

/// One stylesheet to transform through the side's Vite setup.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "TransformViteCssParams")]
pub struct TransformViteCss {
    /// Side source and installation settings, without JavaScript entries.
    pub setup: Bundle,
    /// Logical source name used for attribution.
    pub stylesheet: String,
    /// Selected physical source file.
    pub file: String,
}
