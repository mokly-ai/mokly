//! Membership administration and verified-email invitation acceptance.

use chrono::Duration;
use mkc_email_interface::mail::{Content, Lifetime, Message};
use mkc_domain::app_paths;
use mkc_domain::ids::OrganizationId;
use mkc_domain::validation;
use mkc_domain::values::Role;
use mkc_store_interface::member::Member;
use mkc_store_interface::store::Queries;

use crate::action::Action;
use crate::payload::{Effect, Payload, Reply};
use crate::views::workspaces::MemberView;

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::{policy, projection};

const INVITATION_LIFETIME_DAYS: u32 = 7;

impl Execution<'_> {
    pub(super) fn member_view(
        &self,
        queries: &mut dyn Queries,
        member: Member,
    ) -> Result<MemberView> {
        let name = match member.user_id {
            Some(user) => {
                queries
                    .user(user)
                    .context("user query")?
                    .ok_or(Error::NotFound)?
                    .name
            }
            None => member.email.clone(),
        };
        Ok(projection::member(member, name))
    }

    fn protect_owner(
        &self,
        queries: &mut dyn Queries,
        workspace_id: OrganizationId,
        actor_role: Role,
        member: &Member,
        next_role: Option<Role>,
    ) -> Result<()> {
        if actor_role != Role::Owner
            && (member.role == Role::Owner || next_role == Some(Role::Owner))
        {
            return Err(Error::Forbidden);
        }
        if member.user_id.is_none() && next_role == Some(Role::Owner) {
            return Err(Error::InvalidInput);
        }
        if member.role == Role::Owner
            && next_role != Some(Role::Owner)
            && queries
                .members(workspace_id)
                .context("members query")?
                .iter()
                .filter(|m| m.role == Role::Owner && m.user_id.is_some())
                .count()
                <= 1
        {
            return Err(Error::LastOwner);
        }
        Ok(())
    }

    pub(super) fn members(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::Members(workspace_id) => {
                self.workspace_admin(queries, *workspace_id)?;
                let mut views = Vec::new();
                for member in queries.members(*workspace_id).context("members query")? {
                    views.push(self.member_view(queries, member)?);
                }
                Ok(Reply::ok(Payload::Members(
                    self.page.page(views, |m| m.id.0),
                )))
            }
            Action::Invite(workspace_id, input) => {
                self.workspace_admin(queries, *workspace_id)?;
                if input.role == Role::Owner {
                    return Err(Error::InvalidInput);
                }
                let email = validation::email(&input.email).ok_or(Error::InvalidInput)?;
                if let Some(old) = queries
                    .members(*workspace_id)
                    .context("members query")?
                    .into_iter()
                    .find(|m| m.email == email)
                {
                    if old.expires_at.is_none_or(|expires| expires > self.now) {
                        return Err(Error::AlreadyMember);
                    }
                    queries
                        .delete_member(old.id)
                        .context("delete member query")?;
                }
                let member = Member {
                    id: self.id.into(),
                    organization_id: *workspace_id,
                    user_id: None,
                    email,
                    role: input.role,
                    version: 1,
                    expires_at: Some(
                        self.now + Duration::days(i64::from(INVITATION_LIFETIME_DAYS)),
                    ),
                };
                queries
                    .insert_member(&member)
                    .context("insert member query")?;
                let workspace = queries
                    .organization(*workspace_id)
                    .context("read invitation workspace")?
                    .ok_or(Error::NotFound)?;
                let inviter = queries
                    .user(self.actor()?)
                    .context("read invitation sender")?
                    .ok_or(Error::Unauthenticated)?;
                let effect = Effect::Mail(Message {
                    recipient: member.email.clone(),
                    content: Content::Invitation {
                        link: app_paths::on_origin(
                            self.app_origin,
                            &app_paths::invitation_acceptance(*workspace_id, member.id),
                        ),
                        organization: workspace.name,
                        invited_by: inviter.name,
                        valid_for: Lifetime::Days(INVITATION_LIFETIME_DAYS),
                    },
                });
                Ok(
                    Reply::created(Payload::Member(self.member_view(queries, member)?))
                        .with_effect(effect),
                )
            }
            Action::UpdateMember(workspace_id, id, input) => {
                let role = self.workspace_admin(queries, *workspace_id)?;
                let mut member = queries
                    .member(*id)
                    .context("member query")?
                    .filter(|m| m.organization_id == *workspace_id)
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, member.version)?;
                self.protect_owner(queries, *workspace_id, role, &member, Some(input.role))?;
                member.role = input.role;
                member.version += 1;
                queries.save_member(&member).context("save member query")?;
                Ok(Reply::ok(Payload::Member(
                    self.member_view(queries, member)?,
                )))
            }
            Action::RemoveMember(workspace_id, id, input) => {
                let role = self.workspace_admin(queries, *workspace_id)?;
                let member = queries
                    .member(*id)
                    .context("member query")?
                    .filter(|m| m.organization_id == *workspace_id)
                    .ok_or(Error::NotFound)?;
                policy::version(input.version, member.version)?;
                self.protect_owner(queries, *workspace_id, role, &member, None)?;
                queries.delete_member(*id).context("delete member query")?;
                Ok(Reply::empty())
            }
            Action::Accept(workspace_id, id) => {
                let actor = self.actor()?;
                let user = queries
                    .user(actor)
                    .context("user query")?
                    .ok_or(Error::Unauthenticated)?;
                let mut member = queries
                    .member(*id)
                    .context("member query")?
                    .filter(|m| m.organization_id == *workspace_id && m.email == user.email)
                    .ok_or(Error::NotFound)?;
                if member.user_id == Some(actor) {
                    return Ok(Reply::ok(Payload::Member(
                        self.member_view(queries, member)?,
                    )));
                }
                if member.expires_at.is_none_or(|expires| self.now >= expires) {
                    return Err(Error::InvitationExpired);
                }
                member.user_id = Some(actor);
                member.expires_at = None;
                member.version += 1;
                queries.save_member(&member).context("save member query")?;
                Ok(Reply::ok(Payload::Member(
                    self.member_view(queries, member)?,
                )))
            }
            Action::Account(..)
            | Action::Workspaces
            | Action::SuggestWorkspaceSlug(..)
            | Action::CreateWorkspace(..)
            | Action::Workspace(..)
            | Action::WorkspaceBySlug(..)
            | Action::RenameWorkspace(..)
            | Action::DeleteWorkspace(..)
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
