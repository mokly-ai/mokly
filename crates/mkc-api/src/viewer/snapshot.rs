//! Authorization and typed query results inside one database transaction.
//!
//! Project access is checked first, so a denied read performs no viewer
//! query. Each list asks for one row past its limit; that lookahead row
//! decides whether the page returns a cursor.

use mkc_domain::slug::WorkspaceSlug;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::blob::PublicationFile;
use mkc_store_interface::project::Project;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::store::Queries;
use mkc_store_interface::viewer::{ViewerBranch, ViewerPublication, ViewerPullRequest};

use crate::platform::error::{Error, ErrorResultExt, Result};
use crate::platform::project_access::ProjectAccess;

use super::cursor::Key;
use super::input::{Action, Query, Read};
use super::share_validation::ShareValidation;

pub(super) struct Retained {
    pub(super) context: ViewerPublication,
    pub(super) comparison: Option<PublicationFile>,
}

pub(super) enum Rows {
    Branches(Vec<ViewerBranch>),
    PullRequests(Vec<ViewerPullRequest>),
    History(Vec<ViewerPublication>),
    Publication(Box<Retained>),
}

pub(super) struct Snapshot {
    pub(super) project: Project,
    pub(super) workspace_slug: WorkspaceSlug,
    pub(super) rows: Rows,
}

pub(super) trait ReadSnapshot {
    fn read(&self, queries: &mut dyn Queries) -> Result<Snapshot>;
}

pub(super) struct SnapshotReader<'a> {
    pub(super) access: &'a dyn ProjectAccess,
    pub(super) action: Action,
    pub(super) query: &'a Query,
}

impl ReadSnapshot for SnapshotReader<'_> {
    fn read(&self, queries: &mut dyn Queries) -> Result<Snapshot> {
        let (project, role) = self.access.read(queries, self.action.project)?;
        let workspace_slug = queries
            .organization(project.organization_id)
            .context("read viewer workspace slug")?
            .ok_or(Error::NotFound)?
            .slug;
        let limit = self.query.limit as i64 + 1;
        let rows = match self.action.read {
            Read::BuildHistory => return Err(Error::InvalidInput),
            Read::Branches => {
                let after = match &self.query.after {
                    Some(Key::Branch(key)) => Some(key),
                    _ => None,
                };
                let mut rows = queries
                    .viewer_branches(project.id, after, limit)
                    .context("viewer branches query")?;
                if role.is_none() {
                    for row in &mut rows {
                        row.newest_build = None;
                    }
                }
                Rows::Branches(rows)
            }
            Read::PullRequests => {
                let after = match &self.query.after {
                    Some(Key::PullRequest(key)) => Some(key),
                    _ => None,
                };
                let mut rows = queries
                    .viewer_pull_requests(project.id, after, limit)
                    .context("viewer pull requests query")?;
                if role.is_none() {
                    for row in &mut rows {
                        row.newest_build = None;
                    }
                }
                Rows::PullRequests(rows)
            }
            Read::History => {
                let after = match &self.query.after {
                    Some(Key::Publication(key)) => Some(key),
                    _ => None,
                };
                let rows = queries
                    .viewer_publications(project.id, &self.query.filter, after, limit)
                    .context("viewer history query")?;
                Rows::History(rows)
            }
            Read::Publication(id) | Read::Screens(id) | Read::Share(id) => {
                let publication = queries
                    .viewer_publication(project.id, id)
                    .context("viewer publication query")?
                    .ok_or(Error::NotFound)?;
                if !matches!(self.action.read, Read::Publication(_))
                    && publication.publication.state != PublicationState::Ready
                {
                    return Err(Error::NotFound);
                }
                let retained = if matches!(self.action.read, Read::Screens(_)) {
                    let reader: &dyn ComparisonIndex = &StoredComparison;
                    reader.read(queries, publication)?
                } else {
                    if matches!(self.action.read, Read::Share(_)) {
                        let validator: &dyn ShareValidation = &self.query.selection;
                        validator.validate(queries, &publication.publication)?;
                    }
                    Retained {
                        context: publication,
                        comparison: None,
                    }
                };
                Rows::Publication(Box::new(retained))
            }
        };
        Ok(Snapshot {
            project,
            workspace_slug,
            rows,
        })
    }
}

trait ComparisonIndex {
    fn read(&self, queries: &mut dyn Queries, publication: ViewerPublication) -> Result<Retained>;
}

struct StoredComparison;

impl ComparisonIndex for StoredComparison {
    fn read(&self, queries: &mut dyn Queries, publication: ViewerPublication) -> Result<Retained> {
        let row = &publication.publication;
        let comparison = if row.state == PublicationState::Ready && row.expired_at.is_none() {
            match row.metadata.as_ref().and_then(|m| m.base_sha.as_ref()) {
                Some(_) => Some(
                    queries
                        .publication_file(row.id, INDEX_PATH)
                        .context("read accepted catalogue index reference")?
                        .ok_or_else(|| Error::internal(MissingComparison))?,
                ),
                None => None,
            }
        } else {
            None
        };
        Ok(Retained {
            context: publication,
            comparison,
        })
    }
}

#[derive(Debug, thiserror::Error)]
#[error("[mkc-api/viewer] retained comparison is missing")]
struct MissingComparison;
