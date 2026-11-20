//! Stable GitHub identity matching without email-based account reassignment.

use chrono::{DateTime, Utc};
use mkc_auth::service::Identity;
use mkc_domain::ids::UserId;
use mkc_github_interface::repositories::Account;
use mkc_store_interface::github_identity::GitHubIdentity;
use mkc_store_interface::integration::IntegrationSubject;
use mkc_store_interface::store::Queries;
use mkc_store_interface::user::User;

use crate::error::{ApiError, ApiErrorResultExt, Result};

use super::service::GitHubService;

pub(super) struct VerifiedUser<'a> {
    pub(super) github: &'a Account,
    pub(super) email: &'a str,
    pub(super) actor: Option<&'a Identity>,
    pub(super) new_id: UserId,
    pub(super) now: DateTime<Utc>,
}

pub(super) trait VerifiedIdentityCommand {
    fn resolve(&self, queries: &mut dyn Queries) -> Result<User>;
}

impl VerifiedIdentityCommand for VerifiedUser<'_> {
    fn resolve(&self, queries: &mut dyn Queries) -> Result<User> {
        let linked = queries
            .github_identity(self.github.id)
            .context("read stable GitHub identity")?;
        let user = match (self.actor, &linked) {
            (Some(actor), Some(link)) if actor.user.id != link.user_id => {
                return Err(ApiError::GITHUB_IDENTITY_CONFLICT);
            }
            (Some(actor), _) => queries
                .user(actor.user.id)
                .context("read connecting GitHub user")?
                .ok_or(ApiError::Unauthenticated)?,
            (None, Some(link)) => queries
                .user(link.user_id)
                .context("read returning GitHub user")?
                .ok_or(ApiError::Unauthenticated)?,
            (None, None) => match queries
                .find_user(self.email)
                .context("match verified GitHub email")?
            {
                Some(user) => user,
                None => {
                    let user = User {
                        id: self.new_id,
                        email: self.email.to_owned(),
                        name: self.email.to_owned(),
                        created_at: self.now,
                    };
                    queries
                        .insert_user(&user)
                        .context("create verified GitHub user")?;
                    user
                }
            },
        };
        if queries
            .user_github_identity(user.id)
            .context("check user's existing GitHub identity")?
            .is_some_and(|identity| identity.github_user_id != self.github.id)
        {
            return Err(ApiError::GITHUB_IDENTITY_CONFLICT);
        }
        queries
            .save_github_identity(&GitHubIdentity {
                github_user_id: self.github.id,
                user_id: user.id,
                login: self.github.login.clone(),
                created_at: linked.map_or(self.now, |identity| identity.created_at),
            })
            .context("persist verified GitHub identity")?;
        queries
            .save_integration(
                IntegrationSubject::User(user.id),
                &self.github.login,
                self.now,
            )
            .context("persist user GitHub connection")?;
        Ok(user)
    }
}

impl GitHubService {
    pub(super) fn disconnect_identity(&self, actor: UserId) -> Result<()> {
        self.transact(false, &mut |queries| {
            queries
                .delete_github_identity(actor)
                .context("remove GitHub identity")?;
            queries
                .delete_integration(IntegrationSubject::User(actor))
                .context("remove user GitHub connection")?;
            Ok(())
        })
    }
}
