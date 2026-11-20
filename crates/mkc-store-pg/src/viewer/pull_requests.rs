//! Provider pull request observations with scoped ready-publication selection.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Nullable, Text, Timestamptz};
use mkc_domain::ids::ProjectId;
use mkc_domain::pull_request::PullRequestRepositories;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::viewer::{PullRequestKey, ViewerPullRequest};
use uuid::Uuid;

use crate::queries::PgQueries;

use super::{newest_build, newest_publication};

#[derive(QueryableByName)]
struct Row {
    #[diesel(sql_type = BigInt)]
    number: i64,
    #[diesel(sql_type = Text)]
    title: String,
    #[diesel(sql_type = Nullable<Text>)]
    author: Option<String>,
    #[diesel(sql_type = Bool)]
    open: bool,
    #[diesel(sql_type = Bool)]
    merged: bool,
    #[diesel(sql_type = Text)]
    branch: String,
    #[diesel(sql_type = Timestamptz)]
    updated_at: DateTime<Utc>,
    #[diesel(sql_type = Text)]
    repository: String,
    #[diesel(sql_type = BigInt)]
    bound_repository_id: i64,
    #[diesel(sql_type = Nullable<BigInt>)]
    head_repository_id: Option<i64>,
    #[diesel(sql_type = Nullable<BigInt>)]
    base_repository_id: Option<i64>,
    #[diesel(sql_type = Nullable<diesel::sql_types::Uuid>)]
    latest_publication_id: Option<Uuid>,
    #[diesel(embed)]
    newest: newest_publication::Row,
    #[diesel(embed)]
    newest_build: newest_build::Row,
}

impl PgQueries<'_> {
    pub(super) fn pull_requests(
        &mut self,
        project: ProjectId,
        after: Option<&PullRequestKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPullRequest>> {
        let rows: Vec<Row> = diesel::sql_query(include_str!("pull_requests.sql"))
            .bind::<diesel::sql_types::Uuid, _>(project.0)
            .bind::<Nullable<Bool>, _>(after.map(|key| key.open))
            .bind::<Nullable<Timestamptz>, _>(after.map(|key| key.updated_at))
            .bind::<Nullable<BigInt>, _>(after.map(|key| key.number))
            .bind::<BigInt, _>(limit.clamp(1, 101))
            .load(self.connection)
            .context("read viewer pull requests")?;
        rows.into_iter()
            .map(|row| {
                Ok(ViewerPullRequest {
                    key: PullRequestKey {
                        open: row.open,
                        updated_at: row.updated_at,
                        number: row.number,
                    },
                    title: row.title,
                    author: row.author,
                    branch: row.branch,
                    merged: row.merged,
                    repository: row.repository,
                    repositories: PullRequestRepositories {
                        bound: row.bound_repository_id,
                        head: row.head_repository_id,
                        base: row.base_repository_id,
                    },
                    latest_publication_id: row.latest_publication_id.map(Into::into),
                    newest_publication: row.newest.dto()?,
                    newest_build: row.newest_build.dto()?,
                })
            })
            .collect()
    }
}
