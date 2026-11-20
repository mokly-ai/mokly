//! Viewer history and immutable publication lookup with parent scoping.

use diesel::prelude::*;
use diesel::sql_types::{self, BigInt, Nullable, Text, Timestamptz};
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_store_interface::error::{ErrorResultExt, Result};
use mkc_store_interface::viewer::{
    BranchKey, HistoryFilter, PublicationKey, PullRequestKey, ViewerBranch, ViewerPublication,
    ViewerPullRequest, ViewerReads,
};

use crate::queries::PgQueries;

use super::publication_context::Row;

impl ViewerReads for PgQueries<'_> {
    fn viewer_branches(
        &mut self,
        project: ProjectId,
        after: Option<&BranchKey>,
        limit: i64,
    ) -> Result<Vec<ViewerBranch>> {
        self.branches(project, after, limit)
    }

    fn viewer_pull_requests(
        &mut self,
        project: ProjectId,
        after: Option<&PullRequestKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPullRequest>> {
        self.pull_requests(project, after, limit)
    }

    fn viewer_publications(
        &mut self,
        project: ProjectId,
        filter: &HistoryFilter,
        after: Option<&PublicationKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPublication>> {
        self.publications_with_context(project, None, filter, after, limit)
    }

    fn viewer_publication(
        &mut self,
        project: ProjectId,
        publication: PublicationId,
    ) -> Result<Option<ViewerPublication>> {
        Ok(self
            .publications_with_context(
                project,
                Some(publication),
                &HistoryFilter::default(),
                None,
                1,
            )?
            .pop())
    }
}

impl PgQueries<'_> {
    /// An exact ID excludes expired rows; a history read retains them.
    fn publications_with_context(
        &mut self,
        project: ProjectId,
        publication: Option<PublicationId>,
        filter: &HistoryFilter,
        after: Option<&PublicationKey>,
        limit: i64,
    ) -> Result<Vec<ViewerPublication>> {
        diesel::sql_query(include_str!("publication.sql"))
            .bind::<sql_types::Uuid, _>(project.0)
            .bind::<Nullable<sql_types::Uuid>, _>(publication.map(|id| id.0))
            .bind::<Nullable<Text>, _>(filter.branch.as_deref())
            .bind::<Nullable<BigInt>, _>(filter.pull_request)
            .bind::<Nullable<Timestamptz>, _>(after.map(|key| key.created_at))
            .bind::<Nullable<sql_types::Uuid>, _>(after.map(|key| key.id.0))
            .bind::<BigInt, _>(limit.clamp(1, 101))
            .load::<Row>(self.connection)
            .context("read viewer publications with pull request context")?
            .into_iter()
            .map(Row::dto)
            .collect()
    }
}
