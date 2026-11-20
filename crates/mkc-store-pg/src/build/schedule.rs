//! Serialized insertion and reference supersession statements.

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_db::schema::platform::projects;
use mkc_domain::ids::BuildId;
use mkc_store_interface::build::NewBuild;
use mkc_store_interface::build_check::BuildChecks;
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::publication::PublicationFailure;
use uuid::Uuid;

use crate::queries::PgQueries;

#[derive(QueryableByName)]
struct Superseded {
    #[diesel(sql_type = SqlUuid)]
    id: Uuid,
    #[diesel(sql_type = Nullable<Timestamptz>)]
    started_at: Option<DateTime<Utc>>,
}

impl PgQueries<'_> {
    pub(super) fn schedule(&mut self, value: &NewBuild) -> Result<()> {
        projects::table
            .find(value.project_id.0)
            .select(projects::id)
            .for_update()
            .first::<Uuid>(self.connection)
            .context("lock scheduling project")?;
        diesel::sql_query(
            "INSERT INTO builds (id, project_id, repository_id, trigger, branch,
            head_sha, pull_request, base_ref, config_path, state, next_attempt_at, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10, $10)",
        )
        .bind::<SqlUuid, _>(value.id.0)
        .bind::<SqlUuid, _>(value.project_id.0)
        .bind::<SqlUuid, _>(value.repository_id.0)
        .bind::<Text, _>(value.trigger.as_str())
        .bind::<Text, _>(&value.branch)
        .bind::<Text, _>(&value.head_sha)
        .bind::<Nullable<BigInt>, _>(value.pull_request)
        .bind::<Nullable<Text>, _>(value.base_ref.as_deref())
        .bind::<Text, _>(&value.config_path)
        .bind::<Timestamptz, _>(value.created_at)
        .execute(self.connection)
        .context("insert queued cloud build")?;
        let superseded = diesel::sql_query(include_str!("supersede.sql"))
            .bind::<SqlUuid, _>(value.project_id.0)
            .bind::<SqlUuid, _>(value.id.0)
            .bind::<Text, _>(&value.head_sha)
            .bind::<Nullable<BigInt>, _>(value.pull_request)
            .bind::<Text, _>(&value.branch)
            .bind::<Text, _>(value.trigger.as_str())
            .bind::<Timestamptz, _>(value.created_at)
            .load::<Superseded>(self.connection)
            .context("supersede older reference builds and bump checks")?;
        let attempts: Vec<_> = superseded
            .into_iter()
            .filter_map(|build| build.started_at.map(|started| (BuildId(build.id), started)))
            .collect();
        self.close_build_upload_batch(&attempts, PublicationFailure::Expired, value.created_at)?;
        self.bump_build_check(value.id, value.created_at)
    }
}
