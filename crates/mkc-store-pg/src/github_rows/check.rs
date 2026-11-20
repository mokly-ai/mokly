//! Private Diesel row mapping for github_check_runs.

use diesel::prelude::*;
use mkc_db::schema::github_refs::github_check_runs;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_check::CheckRun;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_check_runs)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    project_id: Uuid,
    repository_id: Uuid,
    github_id: i64,
    head_sha: String,
    external_id: String,
    rerequested: bool,
}

impl Row {
    pub(crate) fn dto(self) -> Result<CheckRun> {
        Ok(CheckRun {
            id: self.id,
            project_id: self.project_id.into(),
            repository_id: self.repository_id.into(),
            github_id: self.github_id,
            head_sha: self.head_sha,
            external_id: self.external_id,
            rerequested: self.rerequested,
        })
    }

    pub(crate) fn record(value: &CheckRun) -> Self {
        Self {
            id: value.id,
            project_id: value.project_id.0,
            repository_id: value.repository_id.0,
            github_id: value.github_id,
            head_sha: value.head_sha.clone(),
            external_id: value.external_id.clone(),
            rerequested: value.rerequested,
        }
    }
}
