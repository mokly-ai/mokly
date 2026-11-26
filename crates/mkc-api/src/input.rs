//! Strict JSON request models; unknown fields are rejected.

use std::fmt::{self, Debug, Formatter};
use std::result::Result;

use mkc_domain::ids::UserId;
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_domain::values::{Role, Visibility};
use serde::{Deserialize, Deserializer};
use utoipa::ToSchema;

use crate::contract::scalars::project_role;
pub(crate) use crate::project_input::CreateProject;

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = UpdateAccount)]
pub(crate) struct Name {
    #[schema(min_length = 1, max_length = 80)]
    pub(crate) name: String,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateWorkspace {
    #[schema(min_length = 1, max_length = 80)]
    pub(crate) name: String,
    pub(crate) slug: WorkspaceSlug,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = VersionCommand)]
pub(crate) struct Version {
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = UpdateWorkspace)]
pub(crate) struct Rename {
    #[schema(min_length = 1, max_length = 80)]
    pub(crate) name: String,
    pub(crate) slug: WorkspaceSlug,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = DeleteProject)]
pub(crate) struct Delete {
    pub(crate) confirmation_name: String,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = InviteMember)]
pub(crate) struct Invite {
    #[schema(format = "email")]
    pub(crate) email: String,
    #[schema(schema_with = project_role)]
    pub(crate) role: Role,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = UpdateMember)]
pub(crate) struct RoleUpdate {
    #[schema(inline)]
    pub(crate) role: Role,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct UpdateProject {
    /// Optional; absent preserves the stored setting. Enabling requires builds to be available.
    #[schema(nullable = false)]
    #[serde(default, deserialize_with = "present_boolean")]
    pub(crate) automatic_builds: Option<bool>,
    pub(crate) name: String,
    pub(crate) slug: ProjectSlug,
    #[schema(inline)]
    pub(crate) visibility: Visibility,
    pub(crate) require_approval: bool,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug)]
pub(crate) struct SuggestWorkspaceSlug {
    pub(crate) name: String,
}

#[derive(Clone, Debug)]
pub(crate) struct SuggestProjectSlug {
    pub(crate) repository: String,
    pub(crate) config_path: String,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateGrant {
    #[schema(inline, format = Uuid)]
    pub(crate) user_id: UserId,
    #[schema(schema_with = project_role)]
    pub(crate) role: Role,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = MagicLinkRequest)]
pub(crate) struct MagicLink {
    #[schema(format = "email")]
    pub(crate) email: String,
    #[schema(nullable = false)]
    pub(crate) return_to: Option<String>,
}

#[derive(Clone, Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = VerifyMagicLink)]
pub(crate) struct VerifyLink {
    #[schema(pattern = "^[a-f0-9]{64}$")]
    pub(crate) token: String,
}

#[derive(Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = PreviewSignIn)]
pub(crate) struct PreviewCredential {
    /// Preview password, from 1 to 1024 UTF-8 bytes.
    #[schema(format = Password, min_length = 1, max_length = 1024)]
    pub(crate) password: String,
    #[schema(nullable = false)]
    pub(crate) return_to: Option<String>,
}

impl Debug for PreviewCredential {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("PreviewCredential")
            .finish_non_exhaustive()
    }
}

fn present_boolean<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<bool>, D::Error> {
    Ok(Some(bool::deserialize(deserializer)?))
}
