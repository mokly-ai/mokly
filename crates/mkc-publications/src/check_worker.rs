//! Durable idempotent Changes-check delivery and authorized rerequests.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_domain::ids::{ProjectId, PublicationId};
use mkc_github_interface::check::CheckRuns;
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use tracing::warn;

use crate::check_delivery::Delivery;
use crate::error::{Error, ErrorResultExt, Result};
use crate::locations::Locations;
use crate::stored_index::StoredIndexReader;
use crate::transaction::Transactions;

/// Check worker behavior supplied to the sibling GitHub event/runtime wiring.
#[unimock::unimock(api = ChecksWorkerMock)]
pub trait ChecksWorker: Send + Sync {
    /// Process up to one hundred due events, optionally restricted to one project.
    fn run_batch(&self, project: Option<ProjectId>) -> Result<usize>;
    /// Enqueue an exact-identity rerequest without rebuilding or changing content.
    fn rerequest(&self, publication: PublicationId, repository: &str, head: &str) -> Result<()>;
}

/// Durable outbox worker composed with an installation-authorized check adapter.
pub struct PublicationChecks {
    /// Persistent outbox and immutable publication queries.
    pub transactions: Arc<dyn Transactions>,
    /// Bounded reads of accepted index files for check rendering.
    pub files: Arc<dyn StoredIndexReader>,
    /// Provider adapter; never a concrete GitHub dependency here.
    pub github: Arc<dyn CheckRuns>,
    /// Event IDs and acknowledgement time.
    pub runtime: Arc<dyn Runtime>,
    /// App deep-link configuration.
    pub locations: Locations,
}

impl ChecksWorker for PublicationChecks {
    fn run_batch(&self, project: Option<ProjectId>) -> Result<usize> {
        let mut events = Vec::new();
        let now = self.runtime.now();
        self.transactions.run(true, &mut |queries| {
            events = queries
                .pending_publication_events(now, 100, project)
                .context("read check outbox")?;
            Ok(())
        })?;
        let mut delivered = 0;
        for pending in events {
            let event = pending.event;
            let now = self.runtime.now();
            let mut claim = None;
            self.transactions.run(false, &mut |queries| {
                claim = queries
                    .claim_publication_event(
                        event.id,
                        pending.attempts,
                        now,
                        now + Duration::minutes(5),
                    )
                    .context("claim publication check")?;
                Ok(())
            })?;
            let Some(claim) = claim else {
                continue;
            };
            if let Err(error) = self.deliver_event(&event) {
                let now = self.runtime.now();
                let delay = Duration::seconds((60_i64 << pending.attempts.clamp(0, 6)).min(3600));
                let permanent_failures = claim.permanent_failures + i32::from(error.is_permanent());
                let dead_lettered = (permanent_failures >= 5).then_some(now);
                let mut recorded = false;
                self.transactions.run(false, &mut |queries| {
                    recorded = queries
                        .retry_publication_event(
                            event.id,
                            claim.attempts,
                            permanent_failures,
                            now + delay,
                            dead_lettered,
                        )
                        .context("persist failed check attempt")?;
                    Ok(())
                })?;
                if recorded {
                    warn!(event = %event.id, attempts = claim.attempts, permanent_failures, dead_lettered = dead_lettered.is_some(), error = ?error, "publication check delivery failed");
                }
                continue;
            }
            let now = self.runtime.now();
            let mut recorded = false;
            self.transactions.run(false, &mut |queries| {
                recorded = queries
                    .deliver_publication_event(event.id, claim.attempts, now)
                    .context("acknowledge publication check")?;
                Ok(())
            })?;
            delivered += usize::from(recorded);
        }
        Ok(delivered)
    }

    fn rerequest(&self, publication: PublicationId, repository: &str, head: &str) -> Result<()> {
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: publication,
            kind: EventKind::Rerequest,
            created_at: self.runtime.now(),
        };
        self.transactions.run(false, &mut |queries| {
            let value = queries
                .publication(publication)
                .context("read rerequest publication")?
                .ok_or(Error::NotFound)?;
            let project = queries
                .project(value.project_id)
                .context("read rerequest repository")?
                .ok_or(Error::NotFound)?;
            if !project.repository.eq_ignore_ascii_case(repository)
                || value
                    .metadata
                    .as_ref()
                    .is_none_or(|metadata| metadata.head_sha != head)
            {
                return Err(Error::Forbidden);
            }
            queries
                .insert_publication_event(&event)
                .context("enqueue immutable check rerequest")?;
            Ok(())
        })
    }
}
