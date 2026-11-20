//! Projects response schemas.

use mkc_domain::ids::{OrganizationId, ProjectId};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_domain::values::Visibility;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = Project)]
pub(crate) struct ProjectView {
    #[schema(inline, format = Uuid)]
    pub(crate) id: ProjectId,
    #[schema(inline, format = Uuid)]
    pub(crate) workspace_id: OrganizationId,
    pub(crate) name: String,
    pub(crate) slug: ProjectSlug,
    pub(crate) workspace_slug: WorkspaceSlug,
    pub(crate) repository: String,
    pub(crate) config_path: String,
    #[schema(inline)]
    pub(crate) visibility: Visibility,
    pub(crate) require_approval: bool,
    pub(crate) can_admin: bool,
    /// Whether this project's visibility and the owning workspace's current plan
    /// permit publications. Public projects always allow publishing. This project-scoped
    /// capability does not grant access to workspace or billing data.
    pub(crate) publishing_allowed: bool,
    pub(crate) automatic_builds: bool,
    /// Builds are configured and the active repository has an active connected installation bound to this workspace.
    pub(crate) builds_available: bool,
    /// Builds are available, publishing is allowed, and the caller is an effective project admin or member.
    pub(crate) can_request_builds: bool,
    #[schema(minimum = 1)]
    pub(crate) version: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectSlugLookupView {
    #[serde(flatten)]
    pub(crate) project: ProjectView,
    pub(crate) canonical_slug: ProjectSlug,
    pub(crate) canonical_workspace_slug: WorkspaceSlug,
}

#[derive(Clone, Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[schema(as = ProjectSlugSuggestion)]
pub(crate) struct ProjectSlugSuggestionView {
    pub(crate) slug: ProjectSlug,
}
