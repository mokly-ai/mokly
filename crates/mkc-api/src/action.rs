//! Fully typed platform commands, independent of HTTP and JSON.

use mkc_domain::ids::{GrantId, MemberId, OrganizationId, ProjectId, TokenId};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};

use crate::input;

#[derive(Clone, Debug)]
pub(crate) enum Action {
    Account(input::Name),
    Workspaces,
    SuggestWorkspaceSlug(input::SuggestWorkspaceSlug),
    CreateWorkspace(input::CreateWorkspace),
    Workspace(OrganizationId),
    WorkspaceBySlug(WorkspaceSlug),
    RenameWorkspace(OrganizationId, input::Rename),
    DeleteWorkspace(OrganizationId, input::Delete),
    Members(OrganizationId),
    Invite(OrganizationId, input::Invite),
    UpdateMember(OrganizationId, MemberId, input::RoleUpdate),
    RemoveMember(OrganizationId, MemberId, input::Version),
    Accept(OrganizationId, MemberId),
    Projects(OrganizationId),
    SuggestProjectSlug(OrganizationId, input::SuggestProjectSlug),
    CreateProject(OrganizationId, input::CreateProject),
    Project(ProjectId),
    ProjectBySlug(WorkspaceSlug, ProjectSlug),
    UpdateProject(ProjectId, input::UpdateProject),
    DeleteProject(ProjectId, input::Delete),
    Grants(ProjectId),
    CreateGrant(ProjectId, input::CreateGrant),
    UpdateGrant(ProjectId, GrantId, input::RoleUpdate),
    RemoveGrant(ProjectId, GrantId, input::Version),
    Tokens(ProjectId),
    CreateToken(ProjectId, input::Name),
    RevokeToken(ProjectId, TokenId),
}
