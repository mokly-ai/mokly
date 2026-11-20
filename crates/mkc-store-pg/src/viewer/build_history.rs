//! A typed history union and contextual build lookup, each in one SQL statement.

use diesel::prelude::*;
use diesel::sql_types::{BigInt, Bool, Nullable, Text, Timestamptz, Uuid as SqlUuid};
use mkc_domain::ids::{BuildId, ProjectId};
use mkc_store_interface::build_history::{BuildReads, HistoryEntry, HistoryKey, ViewerBuild};
use mkc_store_interface::error::{Error, ErrorResultExt, Result};
use mkc_store_interface::viewer::{HistoryFilter, ViewerPublication};

use crate::build::row::Row;
use crate::publication_row::{InvalidRecord, PublicationRow};
use crate::queries::PgQueries;

use super::build_context::Context;
use super::history_build_row::HistoryBuildRow;

#[derive(QueryableByName)]
struct HistoryRow {
    #[diesel(embed)]
    publication: Option<PublicationRow>,
    #[diesel(embed)]
    build: Option<HistoryBuildRow>,
    #[diesel(embed)]
    context: Context,
}

impl HistoryRow {
    fn dto(self) -> Result<HistoryEntry> {
        let pull_request = self.context.dto()?;
        match (self.publication, self.build) {
            (Some(publication), None) => Ok(HistoryEntry::Publication(ViewerPublication {
                publication: publication.dto()?,
                pull_request,
            })),
            (None, Some(build)) => Ok(HistoryEntry::Build(ViewerBuild {
                build: build.dto()?,
                pull_request,
            })),
            _ => Err(Error::internal(InvalidRecord)),
        }
    }
}

#[derive(QueryableByName)]
struct BuildRow {
    #[diesel(embed)]
    build: Row,
    #[diesel(embed)]
    context: Context,
}

impl BuildReads for PgQueries<'_> {
    fn build_history(
        &mut self,
        project: ProjectId,
        filter: &HistoryFilter,
        after: Option<&HistoryKey>,
        limit: i64,
        include_builds: bool,
    ) -> Result<Vec<HistoryEntry>> {
        diesel::sql_query(include_str!("build_history.sql"))
            .bind::<SqlUuid, _>(project.0)
            .bind::<Nullable<Text>, _>(filter.branch.as_deref())
            .bind::<Nullable<BigInt>, _>(filter.pull_request)
            .bind::<Nullable<Timestamptz>, _>(after.map(|key| key.created_at))
            .bind::<Nullable<SqlUuid>, _>(after.map(|key| key.id))
            .bind::<BigInt, _>(limit.clamp(1, 101))
            .bind::<Bool, _>(include_builds)
            .load::<HistoryRow>(self.connection)
            .context("read publication and build history union")?
            .into_iter()
            .map(HistoryRow::dto)
            .collect()
    }

    fn viewer_build(&mut self, project: ProjectId, build: BuildId) -> Result<Option<ViewerBuild>> {
        let row = diesel::sql_query("SELECT b.*, pr.number AS origin_number, pr.title AS origin_title,
            pr.author AS origin_author, CASE WHEN pr.number IS NOT NULL THEN r.full_name END AS origin_repository
            FROM builds b JOIN github_repositories r ON r.id = b.repository_id
            LEFT JOIN github_pull_requests pr ON pr.repository_id = r.id AND pr.number = b.pull_request
            WHERE b.id = $2 AND b.project_id = $1")
            .bind::<SqlUuid, _>(project.0).bind::<SqlUuid, _>(build.0)
            .get_result::<BuildRow>(self.connection).optional().context("read build with stored pull request context")?;
        row.map(|row| {
            Ok(ViewerBuild {
                build: row.build.dto()?,
                pull_request: row.context.dto()?,
            })
        })
        .transpose()
    }
}
