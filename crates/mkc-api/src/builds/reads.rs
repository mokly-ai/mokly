//! Member visibility and database pagination precede all build projections.

use mkc_domain::ids::{BuildId, ProjectId, UserId};
use mkc_domain::values::Role;
use mkc_store_interface::build_history::HistoryEntry;
use mkc_store_interface::store::Queries;

use crate::error::{ApiError, ApiErrorResultExt, Result};
use crate::payload::{Page, Payload, Reply};
use crate::platform::project_access::{ProjectAccess, ProjectReader};
use crate::viewer::cursor::{self, Key};
use crate::viewer::input::{Action, Query, Read};
use crate::viewer::projection::publication;

use super::history;
use super::input::LogQuery;
use super::projection;
use super::service::BuildsService;

pub(crate) fn member_role(
    queries: &mut dyn Queries,
    actor: Option<UserId>,
    project: ProjectId,
) -> Result<Role> {
    let access: &dyn ProjectAccess = &ProjectReader { actor };
    let (_, role) = access.read(queries, project)?;
    role.ok_or(ApiError::NotFound)
}

pub(crate) fn write_role(
    queries: &mut dyn Queries,
    actor: Option<UserId>,
    project: ProjectId,
) -> Result<Role> {
    let access: &dyn ProjectAccess = &ProjectReader { actor };
    access
        .read(queries, project)?
        .1
        .ok_or(ApiError::PermissionDenied)
}

pub(crate) fn authorize(role: Role) -> Result<()> {
    if role < Role::Member {
        return Err(ApiError::PermissionDenied);
    }
    Ok(())
}

impl BuildsService {
    pub(super) fn history(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        query: &str,
    ) -> Result<Reply> {
        let query = Query::parse(
            Action {
                project,
                read: Read::BuildHistory,
            },
            query,
        )?;
        let mut rows = Vec::new();
        let mut role = None;
        self.transact(true, &mut |queries| {
            let access: &dyn ProjectAccess = &ProjectReader { actor };
            role = access.read(queries, project)?.1;
            let after = match &query.after {
                Some(Key::History(key)) => Some(key),
                _ => None,
            };
            rows = queries
                .build_history(
                    project,
                    &query.filter,
                    after,
                    query.limit as i64 + 1,
                    role.is_some(),
                )
                .context("read combined publication and build history")?;
            Ok(())
        })?;
        let page = cursor::page(rows, query.limit, query.scope()?, |row| {
            Key::History(row.key())
        })?;
        let items = page
            .items
            .into_iter()
            .map(|row| match row {
                HistoryEntry::Publication(row) => {
                    history::HistoryEntry::publication(publication(&row, &self.locations))
                }
                HistoryEntry::Build(row) => {
                    history::HistoryEntry::build(projection::build(row, role))
                }
            })
            .collect();
        Ok(Reply::ok(Payload::History(Page {
            items,
            next_cursor: page.next_cursor,
        })))
    }

    pub(super) fn build(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        build: BuildId,
    ) -> Result<Reply> {
        let mut result = None;
        self.transact(true, &mut |queries| {
            let role = member_role(queries, actor, project)?;
            let row = queries
                .viewer_build(project, build)
                .context("read project build")?
                .ok_or(ApiError::NotFound)?;
            result = Some(projection::build(row, Some(role)));
            Ok(())
        })?;
        Ok(Reply::ok(Payload::Build(result.ok_or(ApiError::NotFound)?)))
    }

    pub(super) fn log(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        build: BuildId,
        query: &str,
    ) -> Result<Reply> {
        let query = LogQuery::parse(query)?;
        let mut result = None;
        self.transact(true, &mut |queries| {
            member_role(queries, actor, project)?;
            let window = queries
                .build_log(project, build, query.after, query.limit)
                .context("read build log window")?
                .ok_or(ApiError::NotFound)?;
            result = Some(projection::log(window));
            Ok(())
        })?;
        Ok(Reply::ok(Payload::BuildLog(
            result.ok_or(ApiError::NotFound)?,
        )))
    }

    pub(super) fn cancel(
        &self,
        actor: Option<UserId>,
        project: ProjectId,
        build: BuildId,
    ) -> Result<Reply> {
        let at = self.runtime.now();
        let mut result = None;
        self.transact(false, &mut |queries| {
            let role = write_role(queries, actor, project)?;
            authorize(role)?;
            queries
                .cancel_build(project, build, at)
                .context("cancel project build")?
                .ok_or(ApiError::NotFound)?;
            let row = queries
                .viewer_build(project, build)
                .context("read cancelled build context")?
                .ok_or(ApiError::NotFound)?;
            result = Some(projection::build(row, Some(role)));
            Ok(())
        })?;
        Ok(Reply::ok(Payload::Build(result.ok_or(ApiError::NotFound)?)))
    }
}
