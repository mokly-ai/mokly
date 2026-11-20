//! Atomically turn verified provider rerequests into fresh publication check events.

use std::array;
use std::sync::Arc;

use mkc_auth::runtime::Runtime;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::error;
use mkc_store_interface::github_check::CheckRun;
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::{Callback, Queries, Store};
use uuid::Uuid;

use crate::error::{ErrorResultExt, Result};

/// Bounded query-only rerequest consumption for one check owner.
#[unimock::unimock(api = CheckRerequestsMock)]
pub trait CheckRerequests: Send + Sync {
    /// Consume at most one hundred publication marks, with no provider request.
    fn run_batch(&self) -> Result<usize>;
}

/// Publication rerequests use the original immutable result, with a new retry budget.
pub struct PublicationCheckRerequests {
    /// Claims parents before marked rows and writes their events in one transaction.
    pub store: Arc<dyn Store>,
    /// Event IDs and due time are generated before retryable query work.
    pub runtime: Arc<dyn Runtime>,
}

impl CheckRerequests for PublicationCheckRerequests {
    fn run_batch(&self) -> Result<usize> {
        let now = self.runtime.now();
        let ids: [Uuid; 100] = array::from_fn(|_| self.runtime.id());
        let mut queued = 0;
        self.store
            .transaction(&mut Callback(&mut |queries| {
                queued = 0;
                let checks = queries.rerequested_github_checks("mokly-publication:", 100)?;
                for (check, id) in checks.iter().zip(ids) {
                    if let Some(publication_id) = matching_publication(queries, check)? {
                        queries.insert_publication_event(&PublicationEvent {
                            id,
                            publication_id,
                            kind: EventKind::Rerequest,
                            created_at: now,
                        })?;
                        queued += 1;
                    }
                    queries.clear_github_check_rerequest(check.id)?;
                }
                Ok(())
            }))
            .context("consume publication check rerequests")?;
        Ok(queued)
    }
}

/// Reject stale or corrupt identities without letting a mark update another check.
fn matching_publication(
    queries: &mut dyn Queries,
    check: &CheckRun,
) -> error::Result<Option<PublicationId>> {
    let Some(id) = check
        .external_id
        .strip_prefix("mokly-publication:")
        .and_then(|id| id.parse::<Uuid>().ok())
    else {
        return Ok(None);
    };
    let Some(publication) = queries.publication(PublicationId(id))? else {
        return Ok(None);
    };
    if publication.project_id != check.project_id
        || publication
            .metadata
            .as_ref()
            .is_none_or(|metadata| metadata.head_sha != check.head_sha)
    {
        return Ok(None);
    }
    let Some(repository) = queries.github_project_repository(check.project_id)? else {
        return Ok(None);
    };
    if repository.id != check.repository_id {
        return Ok(None);
    }
    Ok(Some(publication.id))
}
