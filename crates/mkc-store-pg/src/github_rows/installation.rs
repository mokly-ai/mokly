//! Private Diesel row mapping for github_installations.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_installation::github_installations;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::github_installation::Installation;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_installations)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    github_id: i64,
    app_id: i64,
    organization_id: Option<Uuid>,
    account_id: i64,
    account_name: String,
    account_kind: String,
    manage_url: String,
    active: bool,
    connected: bool,
    updated_at: DateTime<Utc>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<Installation> {
        Ok(Installation {
            id: self.id.into(),
            github_id: self.github_id,
            app_id: self.app_id,
            organization_id: self.organization_id.map(Into::into),
            account_id: self.account_id,
            account_name: self.account_name,
            account_kind: self
                .account_kind
                .parse()
                .context("decode github_installations account_kind")?,
            manage_url: self.manage_url,
            active: self.active,
            connected: self.connected,
            updated_at: self.updated_at,
        })
    }

    pub(crate) fn record(value: &Installation) -> Self {
        Self {
            id: value.id.0,
            github_id: value.github_id,
            app_id: value.app_id,
            organization_id: value.organization_id.map(|id| id.0),
            account_id: value.account_id,
            account_name: value.account_name.clone(),
            account_kind: value.account_kind.as_str().to_owned(),
            manage_url: value.manage_url.clone(),
            active: value.active,
            connected: value.connected,
            updated_at: value.updated_at,
        }
    }
}
