//! Product responses, separate from provider IDs and credentials.

use std::fmt;

use mkc_domain::ids::{InstallationId, OrganizationId, RepositoryId};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Connection {
    #[schema(format = "uri")]
    pub(crate) authorize_url: String,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) state: String,
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) code_verifier: String,
}

impl fmt::Debug for Connection {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("GitHubConnection([redacted])")
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Installation {
    #[schema(inline, format = Uuid)]
    pub(crate) id: InstallationId,
    #[schema(inline, format = Uuid)]
    pub(crate) workspace_id: OrganizationId,
    #[schema(inline)]
    pub(crate) account_kind: AccountKind,
    #[schema(inline)]
    pub(crate) state: InstallationState,
    pub(crate) account: String,
    #[schema(format = "uri")]
    pub(crate) manage_url: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Repository {
    #[schema(inline, format = Uuid)]
    pub(crate) id: RepositoryId,
    #[schema(inline, format = Uuid)]
    pub(crate) installation_id: InstallationId,
    pub(crate) full_name: String,
    pub(crate) default_branch: String,
    pub(crate) private: bool,
}

/// GitHub account category, independent of the product workspace.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum AccountKind {
    User,
    Organization,
}

/// A locally connected installation's current provider availability.
#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum InstallationState {
    Connected,
    Suspended,
}
