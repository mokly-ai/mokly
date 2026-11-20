//! Private Diesel row mapping for github_oauth_flows.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_identity::github_oauth_flows;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_identity::OAuthFlow;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_oauth_flows)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(state_hash))]
pub(crate) struct Row {
    state_hash: String,
    verifier_hash: String,
    purpose: String,
    user_id: Option<Uuid>,
    session_hash: Option<String>,
    organization_id: Option<Uuid>,
    installation_id: Option<i64>,
    return_to: String,
    expires_at: DateTime<Utc>,
    used_at: Option<DateTime<Utc>>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<OAuthFlow> {
        Ok(OAuthFlow {
            state_hash: self.state_hash,
            verifier_hash: self.verifier_hash,
            purpose: self
                .purpose
                .parse()
                .context("decode github_oauth_flows purpose")?,
            user_id: self.user_id.map(Into::into),
            session_hash: self.session_hash,
            organization_id: self.organization_id.map(Into::into),
            installation_id: self.installation_id,
            return_to: self.return_to,
            expires_at: self.expires_at,
            used_at: self.used_at,
        })
    }

    pub(crate) fn record(value: &OAuthFlow) -> Self {
        Self {
            state_hash: value.state_hash.clone(),
            verifier_hash: value.verifier_hash.clone(),
            purpose: value.purpose.as_str().to_owned(),
            user_id: value.user_id.map(|id| id.0),
            session_hash: value.session_hash.clone(),
            organization_id: value.organization_id.map(|id| id.0),
            installation_id: value.installation_id,
            return_to: value.return_to.clone(),
            expires_at: value.expires_at,
            used_at: value.used_at,
        }
    }
}
