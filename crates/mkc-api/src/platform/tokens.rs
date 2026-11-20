//! Publishing credential creation and metadata-only reads.

use mkc_auth::runtime::hash;
use mkc_domain::validation;
use mkc_store_interface::store::Queries;
use mkc_store_interface::token::Token;

use crate::action::Action;
use crate::payload::{Payload, Reply};
use crate::views::tokens::TokenCreated;

use super::error::{Error, ErrorResultExt, Result};
use super::execution::Execution;
use super::projection;

impl Execution<'_> {
    pub(super) fn tokens(&self, queries: &mut dyn Queries) -> Result<Reply> {
        match self.action {
            Action::Tokens(id) => {
                self.project_admin(queries, *id)?;
                let tokens = queries
                    .tokens(*id)
                    .context("tokens query")?
                    .into_iter()
                    .map(projection::token)
                    .collect();
                Ok(Reply::ok(Payload::Tokens(
                    self.page.page(tokens, |t| t.id.0),
                )))
            }
            Action::CreateToken(id, input) => {
                self.project_admin(queries, *id)?;
                let name = validation::name(&input.name).ok_or(Error::InvalidInput)?;
                let secret = self.token_secret.as_ref().ok_or(Error::InvalidInput)?;
                let prefix = secret.get(..12).ok_or(Error::InvalidInput)?.to_owned();
                let token = Token {
                    id: self.id.into(),
                    project_id: *id,
                    name,
                    prefix,
                    token_hash: hash(secret),
                    created_at: self.now,
                    last_used_at: None,
                    revoked_at: None,
                };
                queries.insert_token(&token).context("insert token query")?;
                Ok(Reply::created(Payload::Token(TokenCreated {
                    token: projection::token(token),
                    secret: secret.clone(),
                })))
            }
            Action::RevokeToken(project, id) => {
                self.project_admin(queries, *project)?;
                let mut token = queries
                    .token(*id)
                    .context("token query")?
                    .filter(|t| t.project_id == *project)
                    .ok_or(Error::NotFound)?;
                if token.revoked_at.is_none() {
                    token.revoked_at = Some(self.now);
                    queries.save_token(&token).context("save token query")?;
                }
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
            | Action::Grants(..)
            | Action::CreateGrant(..)
            | Action::UpdateGrant(..)
            | Action::RemoveGrant(..) => Err(Error::OperationUnavailable),
        }
    }
}
