//! Static deployment file contract.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The static deployment identity written beside the catalogue index.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeploymentFileV1 {
    /// Must equal one; readers gate this field before decoding the identity.
    #[ts(type = "1")]
    pub schema_version: u32,
    /// The deployment identity of the catalogue index.
    pub deployment_id: String,
}
