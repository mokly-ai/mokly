//! Private Diesel row mapping for github_branches.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_refs::github_branches;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_refs::Branch;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_branches)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(repository_id, name))]
pub(crate) struct Row {
    repository_id: Uuid,
    name: String,
    head_sha: Option<String>,
    updated_at: DateTime<Utc>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<Branch> {
        Ok(Branch {
            repository_id: self.repository_id.into(),
            name: self.name,
            head_sha: self.head_sha,
            updated_at: self.updated_at,
        })
    }

    pub(crate) fn record(value: &Branch) -> Self {
        Self {
            repository_id: value.repository_id.0,
            name: value.name.clone(),
            head_sha: value.head_sha.clone(),
            updated_at: value.updated_at,
        }
    }
}
