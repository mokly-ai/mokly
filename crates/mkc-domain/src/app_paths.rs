//! Canonical public paths owned by the Mokly application.

use crate::ids::{MemberId, OrganizationId, PublicationId};
use crate::slug::{ProjectSlug, WorkspaceSlug};

/// Account sign-in path.
pub const SIGN_IN: &str = "/sign-in";

/// Account sign-up path.
pub const SIGN_UP: &str = "/sign-up";

/// Signed-in resolver and rejected-return destination.
pub const DASHBOARD: &str = "/dashboard";

/// Email magic-link landing path.
pub const EMAIL_CALLBACK: &str = "/auth/email/callback";

/// Preview sign-in landing path.
pub const PREVIEW_CALLBACK: &str = "/auth/preview/callback";

/// GitHub user-authorization landing path.
pub const GITHUB_CALLBACK: &str = "/auth/github/callback";

/// GitHub App installation landing path.
pub const GITHUB_INSTALL: &str = "/auth/github/install";

/// Canonical application path for workspace-level actions.
pub fn workspace(workspace: &WorkspaceSlug) -> String {
    format!("/{workspace}/-")
}

/// Invitation acceptance path for a pending member of one workspace.
pub fn invitation_acceptance(workspace: OrganizationId, member: MemberId) -> String {
    format!("/workspaces/{workspace}/invitations/{member}/accept")
}

/// Canonical application path for a workspace's billing settings.
pub fn workspace_billing(workspace: &WorkspaceSlug) -> String {
    format!("{}/settings/billing", self::workspace(workspace))
}

/// Canonical application path for a project.
pub fn project(workspace: &WorkspaceSlug, project: &ProjectSlug) -> String {
    format!("/{workspace}/{project}")
}

/// Canonical application path for one project publication.
pub fn publication(
    workspace: &WorkspaceSlug,
    project: &ProjectSlug,
    publication: PublicationId,
) -> String {
    format!(
        "{}/publications/{publication}",
        self::project(workspace, project)
    )
}

/// Canonical application path for one repository pull request.
pub fn pull_request(workspace: &WorkspaceSlug, project: &ProjectSlug, number: i64) -> String {
    format!(
        "{}/pull-requests/{number}",
        self::project(workspace, project)
    )
}

/// Join a validated application origin to one canonical application path.
pub fn on_origin(app_origin: &str, path: &str) -> String {
    format!("{app_origin}{path}")
}

#[cfg(test)]
#[path = "_tests_/app_paths_tests.rs"]
mod app_paths_tests;
