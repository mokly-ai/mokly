//! Private Diesel row mapping for github_pull_requests.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use mkc_db::schema::github_refs::github_pull_requests;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_refs::PullRequest;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_pull_requests)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(repository_id, number))]
pub(crate) struct Row {
    repository_id: Uuid,
    number: i64,
    title: String,
    open: bool,
    merged: bool,
    head_ref: String,
    head_sha: String,
    base_ref: String,
    base_sha: String,
    updated_at: DateTime<Utc>,
    author: Option<String>,
    head_repository_id: Option<i64>,
    base_repository_id: Option<i64>,
}

impl Row {
    pub(crate) fn dto(self) -> Result<PullRequest> {
        Ok(PullRequest {
            repository_id: self.repository_id.into(),
            number: self.number,
            title: self.title,
            author: self.author,
            open: self.open,
            merged: self.merged,
            head_ref: self.head_ref,
            head_sha: self.head_sha,
            base_ref: self.base_ref,
            base_sha: self.base_sha,
            head_repository_id: self.head_repository_id,
            base_repository_id: self.base_repository_id,
            updated_at: self.updated_at,
        })
    }

    pub(crate) fn record(value: &PullRequest) -> Self {
        Self {
            repository_id: value.repository_id.0,
            number: value.number,
            title: value.title.clone(),
            author: value.author.clone(),
            open: value.open,
            merged: value.merged,
            head_ref: value.head_ref.clone(),
            head_sha: value.head_sha.clone(),
            base_ref: value.base_ref.clone(),
            base_sha: value.base_sha.clone(),
            head_repository_id: value.head_repository_id,
            base_repository_id: value.base_repository_id,
            updated_at: value.updated_at,
        }
    }
}
