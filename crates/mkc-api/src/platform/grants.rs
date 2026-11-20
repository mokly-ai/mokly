//! Direct and inherited project access administration.

use mkc_domain::values::Role;
use mkc_store_interface::grant::Grant;
use mkc_store_interface::store::Queries;

use crate::action::Action;
use crate::payload::{Page, Payload, Reply};
use crate::views::grants::{GrantView, GrantViewFields};

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::policy;

impl Execution<'_> {
    fn grant_view(&self, queries: &mut dyn Queries, grant: Grant) -> Result<GrantView> {
        let user = queries
            .user(grant.user_id)
            .context("user query")?
            .ok_or(Error::NotFound)?;
        Ok(GrantView(GrantViewFields {
            id: Some(grant.id),
            user_id: user.id,
            name: user.name,
            role: grant.role,
            inherited: false,
            version: Some(grant.version),
        }))
    }

    pub(super) fn grants(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::Grants(id) => {
                let project = self.project_admin(queries, *id)?;
                let mut grants = Vec::new();
                for member in queries
                    .members(project.organization_id)
                    .context("members query")?
                {
                    if let Some(user_id) = member.user_id {
                        let user = queries
                            .user(user_id)
                            .context("user query")?
                            .ok_or(Error::NotFound)?;
                        grants.push((
                            member.id.0,
                            GrantView(GrantViewFields {
                                id: None,
                                user_id,
                                name: user.name,
                                role: member.role.project_role(),
                                inherited: true,
                                version: None,
                            }),
                        ));
                    }
                }
                for grant in queries.grants(*id).context("grants query")? {
                    grants.push((grant.id.0, self.grant_view(queries, grant)?));
                }
                let page = self.page.page(grants, |row| row.0);
                Ok(Reply::ok(Payload::Grants(Page {
                    items: page.items.into_iter().map(|row| row.1).collect(),
                    next_cursor: page.next_cursor,
                })))
            }
            Action::CreateGrant(id, input) => {
                self.project_admin(queries, *id)?;
                if input.role == Role::Owner {
                    return Err(Error::InvalidInput);
                }
                queries
                    .user(input.user_id)
                    .context("user query")?
                    .ok_or(Error::NotFound)?;
                if queries
                    .grants(*id)
                    .context("grants query")?
                    .iter()
                    .any(|g| g.user_id == input.user_id)
                {
                    return Err(Error::AlreadyMember);
                }
                let grant = Grant {
                    id: self.id.into(),
                    project_id: *id,
                    user_id: input.user_id,
                    role: input.role,
                    version: 1,
                };
                queries.insert_grant(&grant).context("insert grant query")?;
                Ok(Reply::created(Payload::Grant(
                    self.grant_view(queries, grant)?,
                )))
            }
            Action::UpdateGrant(project, id, input) => {
                self.project_admin(queries, *project)?;
                if input.role == Role::Owner {
                    return Err(Error::InvalidInput);
                }
                let mut grant = queries
                    .grant(*id)
                    .context("grant query")?
                    .filter(|g| g.project_id == *project)
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, grant.version)?;
                grant.role = input.role;
                grant.version += 1;
                queries.save_grant(&grant).context("save grant query")?;
                Ok(Reply::ok(Payload::Grant(self.grant_view(queries, grant)?)))
            }
            Action::RemoveGrant(project, id, input) => {
                self.project_admin(queries, *project)?;
                let grant = queries
                    .grant(*id)
                    .context("grant query")?
                    .filter(|g| g.project_id == *project)
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, grant.version)?;
                queries.delete_grant(*id).context("delete grant query")?;
                Ok(Reply::empty())
            }
            Action::Account(..)
            | Action::Workspaces
            | Action::SuggestWorkspaceSlug(..)
            | Action::CreateWorkspace(..)
            | Action::Workspace(..)
            | Action::WorkspaceBySlug(..)
            | Action::RenameWorkspace(..)
            | Action::DeleteWorkspace(..)
            | Action::Members(..)
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
            | Action::Tokens(..)
            | Action::CreateToken(..)
            | Action::RevokeToken(..) => Err(Error::OperationUnavailable),
        }
    }
}
