//! Workspaces response schemas.

use mkc_domain::ids::{MemberId, OrganizationId};
use mkc_domain::slug::WorkspaceSlug;
use mkc_domain::values::{Plan, Role};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Workspace)]
pub(crate) struct WorkspaceView {
    #[schema(inline, format = Uuid)]
    pub(crate) id: OrganizationId,
    pub(crate) name: String,
    pub(crate) slug: WorkspaceSlug,
    #[schema(inline)]
    pub(crate) role: Role,
    pub(crate) plan: Plan,
    #[schema(inline)]
    pub(crate) github_installation_state: InstallationState,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceSlugLookupView {
    #[serde(flatten)]
    pub(crate) workspace: WorkspaceView,
    pub(crate) canonical_slug: WorkspaceSlug,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = WorkspaceSlugSuggestion)]
pub(crate) struct WorkspaceSlugSuggestionView {
    pub(crate) slug: WorkspaceSlug,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Member)]
pub(crate) struct MemberView {
    #[schema(inline, format = Uuid)]
    pub(crate) id: MemberId,
    pub(crate) name: String,
    #[schema(format = "email")]
    pub(crate) email: String,
    #[schema(inline)]
    pub(crate) role: Role,
    #[schema(inline)]
    pub(crate) status: MemberStatus,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum MemberStatus {
    Active,
    Invited,
}

/// Bound installation availability for workspace members; disconnected or missing
/// bindings are absent. This does not authorize provider actions.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub(crate) enum InstallationState {
    Connected,
    Suspended,
    Absent,
}
