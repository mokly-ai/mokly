//! Private Diesel row mapping for github_user_identities.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_identity::github_user_identities;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_identity::GitHubIdentity;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_user_identities)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(github_user_id))]
pub(crate) struct Row {
    github_user_id: i64,
    user_id: Uuid,
    login: String,
    created_at: DateTime<Utc>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<GitHubIdentity> {
        Ok(GitHubIdentity {
            github_user_id: self.github_user_id,
            user_id: self.user_id.into(),
            login: self.login,
            created_at: self.created_at,
        })
    }

    pub(crate) fn record(value: &GitHubIdentity) -> Self {
        Self {
            github_user_id: value.github_user_id,
            user_id: value.user_id.0,
            login: value.login.clone(),
            created_at: value.created_at,
        }
    }
}
