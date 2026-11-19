//! Typed platform command construction at the JSON boundary.

use std::collections::{BTreeMap, HashMap};

use mkc_domain::ids::{ProjectId, PublicationId};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::action::Action;
use crate::builds::input::Action as BuildAction;
use crate::input::{
    MagicLink, PreviewCredential, SuggestProjectSlug, SuggestWorkspaceSlug, VerifyLink,
};
use crate::operation::Operation;
use crate::platform::error::{Error, Result};
use crate::viewer::input::{self, Read};

#[derive(Debug)]
pub(crate) enum Endpoint {
    GetHealth,
    GitHub,
    Billing,
    DesktopGrant,
    CatalogueGrant(ProjectId, PublicationId),
    SendMagicLink(MagicLink),
    VerifyMagicLink(VerifyLink),
    VerifyPreviewSignIn(PreviewCredential),
    GetSession,
    SignOut,
    RotateSession,
    Platform(Action),
    Viewer(input::Action),
    Builds(BuildAction),
}

pub(crate) fn body<T: DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    match serde_json::from_slice(bytes) {
        Ok(value) => Ok(value),
        Err(_) => Err(Error::InvalidInput),
    }
}

pub(crate) fn action(
    operation: Operation,
    params: &HashMap<String, String>,
    bytes: &[u8],
    query: &str,
) -> Result<Endpoint> {
    if operation.github() {
        return Ok(Endpoint::GitHub);
    }
    if operation.billing() {
        return Ok(Endpoint::Billing);
    }
    if operation.desktop_grant() {
        return Ok(Endpoint::DesktopGrant);
    }
    match operation {
        Operation::GetHealth => return Ok(Endpoint::GetHealth),
        Operation::SendMagicLink => return Ok(Endpoint::SendMagicLink(body(bytes)?)),
        Operation::VerifyMagicLink => return Ok(Endpoint::VerifyMagicLink(body(bytes)?)),
        Operation::VerifyPreviewSignIn => {
            return Ok(Endpoint::VerifyPreviewSignIn(body(bytes)?));
        }
        Operation::GetSession => return Ok(Endpoint::GetSession),
        Operation::SignOut => return Ok(Endpoint::SignOut),
        Operation::RotateSession => return Ok(Endpoint::RotateSession),
        _ => (),
    }
    let id = |key: &str| -> Result<Uuid> {
        match params.get(key).and_then(|value| value.parse().ok()) {
            Some(id) => Ok(id),
            None => Err(Error::InvalidInput),
        }
    };
    let workspace_slug = || {
        params
            .get("workspaceSlug")
            .and_then(|value| value.parse().ok())
            .ok_or(Error::InvalidInput)
    };
    let project_slug = || {
        params
            .get("projectSlug")
            .and_then(|value| value.parse().ok())
            .ok_or(Error::InvalidInput)
    };
    if operation == Operation::IssueCatalogueGrant {
        let input: BTreeMap<String, ()> = body(bytes)?;
        if !input.is_empty() {
            return Err(Error::InvalidInput);
        }
        return Ok(Endpoint::CatalogueGrant(
            id("projectId")?.into(),
            id("publicationId")?.into(),
        ));
    }
    let build_action = match operation {
        Operation::ListHistory => Some(BuildAction::History(id("projectId")?.into())),
        Operation::GetBuild => Some(BuildAction::Build(
            id("projectId")?.into(),
            id("buildId")?.into(),
        )),
        Operation::ListBuildLog => Some(BuildAction::Log(
            id("projectId")?.into(),
            id("buildId")?.into(),
        )),
        Operation::RequestBuild => {
            Some(BuildAction::Request(id("projectId")?.into(), body(bytes)?))
        }
        Operation::CancelBuild => {
            if !bytes.is_empty() {
                return Err(Error::InvalidInput);
            }
            Some(BuildAction::Cancel(
                id("projectId")?.into(),
                id("buildId")?.into(),
            ))
        }
        _ => None,
    };
    if let Some(action) = build_action {
        return Ok(Endpoint::Builds(action));
    }
    let read = match operation {
        Operation::ListBranches => Some(Read::Branches),
        Operation::ListPullRequests => Some(Read::PullRequests),
        Operation::ListPublications => Some(Read::History),
        Operation::GetPublication => Some(Read::Publication(id("publicationId")?.into())),
        Operation::ListScreens => Some(Read::Screens(id("publicationId")?.into())),
        Operation::GetShareLink => Some(Read::Share(id("publicationId")?.into())),
        _ => None,
    };
    if let Some(read) = read {
        return Ok(Endpoint::Viewer(input::Action {
            project: id("projectId")?.into(),
            read,
        }));
    }
    Ok(Endpoint::Platform(match operation {
        Operation::UpdateAccount => Action::Account(body(bytes)?),
        Operation::ListWorkspaces => Action::Workspaces,
        Operation::SuggestWorkspaceSlug => {
            let mut values = query_values(query)?;
            let name = values.remove("name").ok_or(Error::InvalidInput)?;
            if !values.is_empty() {
                return Err(Error::InvalidInput);
            }
            Action::SuggestWorkspaceSlug(SuggestWorkspaceSlug { name })
        }
        Operation::CreateWorkspace => Action::CreateWorkspace(body(bytes)?),
        Operation::GetWorkspace => Action::Workspace(id("workspaceId")?.into()),
        Operation::GetWorkspaceBySlug => Action::WorkspaceBySlug(workspace_slug()?),
        Operation::UpdateWorkspace => {
            Action::RenameWorkspace(id("workspaceId")?.into(), body(bytes)?)
        }
        Operation::DeleteWorkspace => {
            Action::DeleteWorkspace(id("workspaceId")?.into(), body(bytes)?)
        }
        Operation::ListMembers => Action::Members(id("workspaceId")?.into()),
        Operation::InviteMember => Action::Invite(id("workspaceId")?.into(), body(bytes)?),
        Operation::UpdateMember => Action::UpdateMember(
            id("workspaceId")?.into(),
            id("memberId")?.into(),
            body(bytes)?,
        ),
        Operation::RemoveMember => Action::RemoveMember(
            id("workspaceId")?.into(),
            id("memberId")?.into(),
            body(bytes)?,
        ),
        Operation::AcceptInvitation => {
            Action::Accept(id("workspaceId")?.into(), id("memberId")?.into())
        }
        Operation::ListProjects => Action::Projects(id("workspaceId")?.into()),
        Operation::SuggestProjectSlug => {
            let mut values = query_values(query)?;
            let repository = values.remove("repository").ok_or(Error::InvalidInput)?;
            let config_path = values.remove("configPath").ok_or(Error::InvalidInput)?;
            if !values.is_empty() {
                return Err(Error::InvalidInput);
            }
            Action::SuggestProjectSlug(
                id("workspaceId")?.into(),
                SuggestProjectSlug {
                    repository,
                    config_path,
                },
            )
        }
        Operation::CreateProject => Action::CreateProject(id("workspaceId")?.into(), body(bytes)?),
        Operation::GetProject => Action::Project(id("projectId")?.into()),
        Operation::GetProjectBySlug => Action::ProjectBySlug(workspace_slug()?, project_slug()?),
        Operation::UpdateProject => Action::UpdateProject(id("projectId")?.into(), body(bytes)?),
        Operation::DeleteProject => Action::DeleteProject(id("projectId")?.into(), body(bytes)?),
        Operation::ListProjectGrants => Action::Grants(id("projectId")?.into()),
        Operation::CreateProjectGrant => Action::CreateGrant(id("projectId")?.into(), body(bytes)?),
        Operation::UpdateProjectGrant => {
            Action::UpdateGrant(id("projectId")?.into(), id("grantId")?.into(), body(bytes)?)
        }
        Operation::RemoveProjectGrant => {
            Action::RemoveGrant(id("projectId")?.into(), id("grantId")?.into(), body(bytes)?)
        }
        Operation::ListTokens => Action::Tokens(id("projectId")?.into()),
        Operation::CreateToken => Action::CreateToken(id("projectId")?.into(), body(bytes)?),
        Operation::RevokeToken => {
            Action::RevokeToken(id("projectId")?.into(), id("tokenId")?.into())
        }
        _ => return Err(Error::OperationUnavailable),
    }))
}

fn query_values(query: &str) -> Result<BTreeMap<String, String>> {
    let mut values = BTreeMap::new();
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        if values
            .insert(key.into_owned(), value.into_owned())
            .is_some()
        {
            return Err(Error::InvalidInput);
        }
    }
    Ok(values)
}

#[cfg(test)]
#[path = "_tests_/endpoints_tests.rs"]
mod tests;
