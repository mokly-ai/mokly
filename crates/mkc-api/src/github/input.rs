//! Strict GitHub route input shapes.

use mkc_domain::ids::OrganizationId;
use serde::{Deserialize, Deserializer};
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Start {
    #[schema(nullable = false)]
    pub(crate) return_to: Option<String>,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Install {
    #[schema(inline, format = Uuid)]
    pub(crate) workspace_id: OrganizationId,
    /// Candidate provider installation from a GitHub return without a live flow.
    #[schema(nullable = false, minimum = 1, format = Int64)]
    #[serde(default, deserialize_with = "candidate_installation")]
    pub(crate) installation_id: Option<i64>,
    #[schema(nullable = false)]
    pub(crate) return_to: Option<String>,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Callback {
    #[schema(min_length = 1, max_length = 1024)]
    pub(crate) code: String,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) state: String,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) code_verifier: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct InstallationCallback {
    #[schema(minimum = 1, format = Int64)]
    pub(crate) installation_id: i64,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) state: String,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) code_verifier: String,
}

pub(crate) struct IncomingDelivery {
    pub(crate) id: String,
    pub(crate) event: String,
    pub(crate) signature: String,
    pub(crate) body: Vec<u8>,
}

fn candidate_installation<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<i64>, D::Error> {
    Ok(Some(i64::deserialize(deserializer)?))
}
