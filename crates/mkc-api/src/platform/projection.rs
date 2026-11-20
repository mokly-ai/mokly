//! Pure store-to-resource projections; secrets never cross this boundary.

use mkc_domain::values::Role;
use mkc_store_interface::github_installation::Installation;
use mkc_store_interface::integration::Integration;
use mkc_store_interface::member::Member;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::project::Project;
use mkc_store_interface::token::Token;
use mkc_store_interface::user::User;

use crate::views::account::UserView;
use crate::views::projects::{ProjectSlugLookupView, ProjectView};
use crate::views::tokens::TokenView;
use crate::views::workspaces;
use crate::views::workspaces::{MemberStatus, MemberView, WorkspaceSlugLookupView, WorkspaceView};

pub(super) fn user(user: User, integration: Option<Integration>) -> UserView {
    UserView {
        id: user.id,
        email: user.email,
        name: user.name,
        github_connected: integration.is_some(),
    }
}

pub(super) fn workspace(
    workspace: Organization,
    role: Role,
    installations: Vec<Installation>,
) -> WorkspaceView {
    let connected: Vec<_> = installations
        .into_iter()
        .filter(|value| value.organization_id == Some(workspace.id) && value.connected)
        .collect();
    let state = if connected.iter().any(|value| value.active) {
        workspaces::InstallationState::Connected
    } else if !connected.is_empty() {
        workspaces::InstallationState::Suspended
    } else {
        workspaces::InstallationState::Absent
    };
    WorkspaceView {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role,
        plan: workspace.plan,
        github_installation_state: state,
        version: workspace.version,
    }
}

pub(super) fn member(member: Member, name: String) -> MemberView {
    MemberView {
        id: member.id,
        name,
        email: member.email,
        role: member.role,
        status: if member.user_id.is_some() {
            MemberStatus::Active
        } else {
            MemberStatus::Invited
        },
        version: member.version,
    }
}

pub(super) fn project(
    project: Project,
    workspace: &Organization,
    role: Option<Role>,
    builds_available: bool,
) -> ProjectView {
    let publishing_allowed = workspace.plan.allows_publication(project.visibility);
    ProjectView {
        id: project.id,
        workspace_id: project.organization_id,
        name: project.name,
        slug: project.slug,
        workspace_slug: workspace.slug.clone(),
        repository: project.repository,
        config_path: project.config_path,
        visibility: project.visibility,
        require_approval: project.require_approval,
        can_admin: role.is_some_and(Role::can_admin),
        publishing_allowed,
        automatic_builds: project.automatic_builds,
        builds_available,
        can_request_builds: builds_available
            && publishing_allowed
            && role.is_some_and(|role| role >= Role::Member),
        version: project.version,
    }
}

pub(super) fn workspace_slug_lookup(workspace: WorkspaceView) -> WorkspaceSlugLookupView {
    WorkspaceSlugLookupView {
        canonical_slug: workspace.slug.clone(),
        workspace,
    }
}

pub(super) fn project_slug_lookup(project: ProjectView) -> ProjectSlugLookupView {
    ProjectSlugLookupView {
        canonical_slug: project.slug.clone(),
        canonical_workspace_slug: project.workspace_slug.clone(),
        project,
    }
}

pub(super) fn token(token: Token) -> TokenView {
    TokenView {
        id: token.id,
        name: token.name,
        prefix: token.prefix,
        created_at: token.created_at,
        last_used_at: token.last_used_at,
        revoked: token.revoked_at.is_some(),
    }
}
