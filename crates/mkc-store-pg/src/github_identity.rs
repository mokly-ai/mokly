//! Stable GitHub identity and hashed OAuth state queries.

use diesel::prelude::*;
use mkc_db::schema::github_identity::{github_oauth_flows, github_user_identities};
use mkc_domain::ids::UserId;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_identity::{GitHubIdentities, GitHubIdentity, OAuthFlow};

use crate::github_rows::{identity, oauth};
use crate::queries::PgQueries;

impl GitHubIdentities for PgQueries<'_> {
    fn github_identity(&mut self, github_user: i64) -> Result<Option<GitHubIdentity>> {
        github_user_identities::table
            .find(github_user)
            .select(identity::Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub identity")?
            .map(identity::Row::dto)
            .transpose()
    }

    fn user_github_identity(&mut self, user: UserId) -> Result<Option<GitHubIdentity>> {
        github_user_identities::table
            .filter(github_user_identities::user_id.eq(user.0))
            .select(identity::Row::as_select())
            .first(self.connection)
            .optional()
            .context("find user's GitHub identity")?
            .map(identity::Row::dto)
            .transpose()
    }

    fn save_github_identity(&mut self, value: &GitHubIdentity) -> Result<()> {
        let row = identity::Row::record(value);
        diesel::insert_into(github_user_identities::table)
            .values(&row)
            .on_conflict(github_user_identities::github_user_id)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub identity")?;
        Ok(())
    }

    fn delete_github_identity(&mut self, user: UserId) -> Result<()> {
        diesel::delete(
            github_user_identities::table.filter(github_user_identities::user_id.eq(user.0)),
        )
        .execute(self.connection)
        .context("delete GitHub identity")?;
        Ok(())
    }

    fn github_oauth_flow(&mut self, hash: &str) -> Result<Option<OAuthFlow>> {
        github_oauth_flows::table
            .find(hash)
            .select(oauth::Row::as_select())
            .first(self.connection)
            .optional()
            .context("read GitHub OAuth flow")?
            .map(oauth::Row::dto)
            .transpose()
    }

    fn save_github_oauth_flow(&mut self, value: &OAuthFlow) -> Result<()> {
        let row = oauth::Row::record(value);
        diesel::insert_into(github_oauth_flows::table)
            .values(&row)
            .on_conflict(github_oauth_flows::state_hash)
            .do_update()
            .set(&row)
            .execute(self.connection)
            .context("save GitHub OAuth flow")?;
        Ok(())
    }
}
