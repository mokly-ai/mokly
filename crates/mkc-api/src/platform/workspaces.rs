//! Account and workspace lifecycle commands.

use mkc_domain::slug::is_reserved;
use mkc_domain::validation;
use mkc_domain::values::{Plan, Role};
use mkc_store_interface::error::Error as StoreError;
use mkc_store_interface::integration::IntegrationSubject;
use mkc_store_interface::member::Member;
use mkc_store_interface::organization::Organization;
use mkc_store_interface::store::Queries;

use crate::action::Action;
use crate::payload::{Payload, Reply};

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::{policy, projection};

impl Execution<'_> {
    pub(super) fn validate_deletion(&self, queries: &mut dyn Queries) -> Result<()> {
        let Action::DeleteWorkspace(id, input) = self.action else {
            return Err(Error::OperationUnavailable);
        };
        if self.workspace_admin(queries, *id)? != Role::Owner {
            return Err(Error::Forbidden);
        }
        let workspace = queries
            .organization(*id)
            .context("workspace query")?
            .ok_or(Error::NotFound)?;
        policy::version(input.version, workspace.version)?;
        if input.confirmation_name != workspace.name {
            return Err(Error::InvalidInput);
        }
        Ok(())
    }

    pub(super) fn workspaces(&self, queries: &mut dyn Queries) -> Result<Reply> {
        let actor = self.actor()?;
        match self.action {
            Action::Account(input) => {
                let mut user = queries
                    .user(actor)
                    .context("user query")?
                    .ok_or(Error::Unauthenticated)?;
                user.name = validation::name(&input.name).ok_or(Error::InvalidInput)?;
                queries.save_user(&user).context("save user query")?;
                Ok(Reply::ok(Payload::User(projection::user(
                    user,
                    queries
                        .integration(IntegrationSubject::User(actor))
                        .context("integration query")?,
                ))))
            }
            Action::Workspaces => {
                let mut workspaces = Vec::new();
                for member in queries
                    .user_memberships(actor)
                    .context("user memberships query")?
                {
                    if let Some(workspace) = queries
                        .organization(member.organization_id)
                        .context("workspace query")?
                    {
                        let installations = queries
                            .github_installations(workspace.id)
                            .context("read workspace installation bindings")?;
                        workspaces.push(projection::workspace(
                            workspace,
                            member.role,
                            installations,
                        ));
                    }
                }
                Ok(Reply::ok(Payload::Workspaces(
                    self.page.page(workspaces, |o| o.id.0),
                )))
            }
            Action::SuggestWorkspaceSlug(_) | Action::WorkspaceBySlug(_) => {
                Err(Error::OperationUnavailable)
            }
            Action::CreateWorkspace(input) => {
                let user = queries
                    .user(actor)
                    .context("user query")?
                    .ok_or(Error::Unauthenticated)?;
                let workspace = Organization {
                    id: self.id.into(),
                    name: validation::name(&input.name).ok_or(Error::InvalidInput)?,
                    slug: input.slug.clone(),
                    version: 1,
                    created_at: self.now,
                    plan: self
                        .preview_workspace
                        .map_or(Plan::Free, |preview| preview.for_creator(&user)),
                };
                if is_reserved(workspace.slug.as_str()) {
                    let suggestion = self.workspace_slug_recovery(queries, &workspace.slug)?;
                    return Err(Error::SlugReserved(suggestion.into_string()));
                }
                match queries.insert_organization(&workspace) {
                    Ok(()) => {}
                    Err(StoreError::SlugTaken) => {
                        let suggestion = self.workspace_slug_recovery(queries, &workspace.slug)?;
                        return Err(Error::SlugTaken(suggestion.into_string()));
                    }
                    Err(StoreError::Internal(source)) => {
                        return Err(Error::internal_context(source, "insert workspace query"));
                    }
                }
                queries
                    .insert_member(&Member {
                        id: self.second_id.into(),
                        organization_id: workspace.id,
                        user_id: Some(actor),
                        email: user.email,
                        role: Role::Owner,
                        version: 1,
                        expires_at: None,
                    })
                    .context("insert member query")?;
                Ok(Reply::created(Payload::Workspace(projection::workspace(
                    workspace,
                    Role::Owner,
                    Vec::new(),
                ))))
            }
            Action::Workspace(id) => {
                let role = self.workspace_role(queries, *id)?;
                let workspace = queries
                    .organization(*id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                Ok(Reply::ok(Payload::Workspace(projection::workspace(
                    workspace,
                    role,
                    queries
                        .github_installations(*id)
                        .context("read workspace installation bindings")?,
                ))))
            }
            Action::RenameWorkspace(id, input) => {
                let role = self.workspace_admin(queries, *id)?;
                let mut workspace = queries
                    .organization(*id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, workspace.version)?;
                if is_reserved(input.slug.as_str()) {
                    let suggestion = self.workspace_slug_recovery(queries, &input.slug)?;
                    return Err(Error::SlugReserved(suggestion.into_string()));
                }
                workspace.name = validation::name(&input.name).ok_or(Error::InvalidInput)?;
                workspace.slug = input.slug.clone();
                workspace.version += 1;
                match queries.save_organization(&workspace) {
                    Ok(()) => {}
                    Err(StoreError::SlugTaken) => {
                        let suggestion = self.workspace_slug_recovery(queries, &workspace.slug)?;
                        return Err(Error::SlugTaken(suggestion.into_string()));
                    }
                    Err(StoreError::Internal(source)) => {
                        return Err(Error::internal_context(source, "save workspace query"));
                    }
                }
                Ok(Reply::ok(Payload::Workspace(projection::workspace(
                    workspace,
                    role,
                    queries
                        .github_installations(*id)
                        .context("read workspace installation bindings")?,
                ))))
            }
            Action::DeleteWorkspace(id, input) => {
                self.validate_deletion(queries)?;
                let workspace = queries
                    .organization(*id)
                    .context("workspace query")?
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, workspace.version)?;
                if input.confirmation_name != workspace.name {
                    return Err(Error::InvalidInput);
                }
                if let Some(subscription) = queries
                    .billing_subscription(*id)
                    .context("recheck subscription before workspace deletion")?
                    .filter(|subscription| subscription.status.is_live())
                    && self.canceled_subscription.as_deref()
                        != Some(subscription.provider_subscription_id.as_str())
                {
                    return Err(Error::Unavailable);
                }
                for mut installation in queries
                    .github_installations(*id)
                    .context("detach deleted workspace installations")?
                {
                    installation.organization_id = None;
                    installation.connected = false;
                    installation.updated_at = self.now;
                    queries
                        .save_github_installation(&installation)
                        .context("preserve detached GitHub installation")?;
                }
                queries
                    .delete_organization(*id)
                    .context("delete workspace query")?;
                Ok(Reply::empty())
            }
            Action::Members(..)
            | Action::Invite(..)
            | Action::UpdateMember(..)
            | Action::RemoveMember(..)
            | Action::Accept(..)
            | Action::Projects(..)
            | Action::SuggestProjectSlug(..)
            | Action::CreateProject(..)
            | Action::Project(..)
            | Action::ProjectBySlug(..)
            | Action::UpdateProject(..)
            | Action::DeleteProject(..)
            | Action::Grants(..)
            | Action::CreateGrant(..)
            | Action::UpdateGrant(..)
            | Action::RemoveGrant(..)
            | Action::Tokens(..)
            | Action::CreateToken(..)
            | Action::RevokeToken(..) => Err(Error::OperationUnavailable),
        }
    }
}
