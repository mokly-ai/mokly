//! Viewer orchestration with IO outside policy transactions and revocation rechecks.

use std::sync::Arc;

use mkc_domain::ids::{PublicationId, UserId};
use mkc_publications::locations::Locations;
use mkc_publications::stored_index::LoadedIndex;
use mkc_store_interface::publication::PublicationState;
use mkc_store_interface::store::Store;
use mkc_store_interface::viewer::PublicationKey;

use crate::payload::{Page, Payload, Reply};
use crate::platform::error::{Error, ErrorResultExt, Result};
use crate::platform::project_access::{ProjectAccess, ProjectReader};

use super::artifacts::Artifacts;
use super::cursor::{self, Key};
use super::input::{Action, Query, Read};
use super::projection;
use super::snapshot::{ReadSnapshot, Retained, Rows, SnapshotReader};

#[unimock::unimock(api = [ViewerMock])]
pub(crate) trait Viewer: Send + Sync {
    fn execute(&self, actor: Option<UserId>, action: Action, query: Query) -> Result<Reply>;
}

pub(crate) struct ViewerService {
    pub(crate) store: Arc<dyn Store>,
    pub(crate) artifacts: Arc<dyn Artifacts>,
    pub(crate) locations: Locations,
}

impl Viewer for ViewerService {
    fn execute(&self, actor: Option<UserId>, action: Action, query: Query) -> Result<Reply> {
        let access: &dyn ProjectAccess = &ProjectReader { actor };
        let reader: &dyn ReadSnapshot = &SnapshotReader {
            access,
            action,
            query: &query,
        };
        let mut snapshot = None;
        self.read(&mut |queries| {
            snapshot = Some(reader.read(queries)?);
            Ok(())
        })?;
        let snapshot = snapshot.ok_or(Error::NotFound)?;
        let mut checked = Vec::new();
        let payload: Result<Payload> = (|| {
            Ok(match snapshot.rows {
                Rows::Branches(rows) => {
                    let page = cursor::page(rows, query.limit, query.scope()?, |r| {
                        Key::Branch(r.key.clone())
                    })?;
                    Payload::Branches(Page {
                        items: page.items.into_iter().map(projection::branch).collect(),
                        next_cursor: page.next_cursor,
                    })
                }
                Rows::PullRequests(rows) => {
                    let page = cursor::page(rows, query.limit, query.scope()?, |r| {
                        Key::PullRequest(r.key.clone())
                    })?;
                    Payload::PullRequests(Page {
                        items: page
                            .items
                            .into_iter()
                            .map(projection::pull_request)
                            .collect(),
                        next_cursor: page.next_cursor,
                    })
                }
                Rows::History(rows) => {
                    let page = cursor::page(rows, query.limit, query.scope()?, |r| {
                        Key::Publication(PublicationKey {
                            created_at: r.publication.created_at,
                            id: r.publication.id,
                        })
                    })?;
                    let items = page
                        .items
                        .iter()
                        .map(|row| projection::publication(row, &self.locations))
                        .collect();
                    Payload::Publications(Page {
                        items,
                        next_cursor: page.next_cursor,
                    })
                }
                Rows::Publication(row) => match action.read {
                    Read::Publication(_) => {
                        Payload::Publication(projection::publication(&row.context, &self.locations))
                    }
                    Read::Screens(_) => {
                        let index = self
                            .index(&row, &mut checked)?
                            .ok_or(Error::OperationUnavailable)?;
                        let mut screens = projection::screens(index.index());
                        if let Some(Key::Screen(after)) = &query.after {
                            screens.retain(|screen| &screen.path > after);
                        }
                        Payload::Screens(cursor::page(
                            screens,
                            query.limit,
                            query.scope()?,
                            |screen| Key::Screen(screen.path.clone()),
                        )?)
                    }
                    Read::Share(_) => Payload::ShareLink(projection::share(
                        &row.context.publication,
                        &snapshot.workspace_slug,
                        &snapshot.project.slug,
                        snapshot.project.visibility,
                        &query.selection,
                        &self.locations,
                    )?),
                    _ => return Err(Error::InvalidInput),
                },
            })
        })();
        if !checked.is_empty() {
            self.read(&mut |queries| {
                let (project, _) = access.read(queries, action.project)?;
                if project.visibility != snapshot.project.visibility {
                    return Err(Error::NotFound);
                }
                for id in &checked {
                    let publication = queries
                        .viewer_publication(project.id, *id)
                        .context("recheck viewer retention")?
                        .ok_or(Error::NotFound)?;
                    if publication.publication.state != PublicationState::Ready {
                        return Err(Error::NotFound);
                    }
                }
                Ok(())
            })?;
        }
        Ok(Reply::ok(payload?))
    }
}

impl ViewerService {
    fn index(
        &self,
        row: &Retained,
        checked: &mut Vec<PublicationId>,
    ) -> Result<Option<LoadedIndex>> {
        match &row.comparison {
            Some(file) => {
                checked.push(row.context.publication.id);
                let index = self.artifacts.index(file)?;
                Ok(Some(index))
            }
            None => Ok(None),
        }
    }
}
