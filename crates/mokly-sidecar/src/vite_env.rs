//! Logical dotenv inputs and the physical paths that supplied their bytes.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// One dotenv candidate observed by a Vite setup.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord, TS)]
#[serde(rename_all = "camelCase")]
pub struct ViteEnvInput {
    /// Stable logical name of the candidate, including when read through a link.
    pub name: String,
    /// Selected physical read path, if the lookup can read from disk.
    pub file: Option<String>,
    /// SHA-256 of the consumed file, or absence.
    pub digest: Option<String>,
    /// Whether a historical setup selected the working tree.
    pub working: bool,
    /// Whether this candidate is in Vite's configured env directory.
    pub render: bool,
}
