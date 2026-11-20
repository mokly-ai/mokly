//! Private Diesel row mapping for github_repositories.

use diesel::prelude::*;
use mkc_db::schema::github_installation::github_repositories;
use mkc_store_interface::error::Result;
use mkc_store_interface::github_repository::Repository;
use uuid::Uuid;

#[derive(Queryable, QueryableByName, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = github_repositories)]
#[diesel(treat_none_as_null = true)]
#[diesel(primary_key(id))]
pub(crate) struct Row {
    id: Uuid,
    installation_id: Uuid,
    github_id: i64,
    full_name: String,
    default_branch: String,
    private: bool,
    active: bool,
}

impl Row {
    pub(crate) fn dto(self) -> Result<Repository> {
        Ok(Repository {
            id: self.id.into(),
            installation_id: self.installation_id.into(),
            github_id: self.github_id,
            full_name: self.full_name,
            default_branch: self.default_branch,
            private: self.private,
            active: self.active,
        })
    }

    pub(crate) fn record(value: &Repository) -> Self {
        Self {
            id: value.id.0,
            installation_id: value.installation_id.0,
            github_id: value.github_id,
            full_name: value.full_name.clone(),
            default_branch: value.default_branch.clone(),
            private: value.private,
            active: value.active,
        }
    }
}
