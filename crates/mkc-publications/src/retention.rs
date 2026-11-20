//! Abandoned-upload recovery and failed-attempt metadata cleanup.

use std::sync::Arc;

use chrono::Duration;
use mkc_auth::runtime::Runtime;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::{PublicationFailure, PublicationState};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};

use crate::error::{ErrorResultExt, Result};
use crate::lifecycle::close_unfinished;
use crate::transaction::Transactions;

/// One bounded cleanup pass and its continuation.
#[derive(Clone, Debug, Default)]
pub struct RetentionReport {
    /// Last scanned publication; persist as a cursor until reaching the end.
    pub next: Option<PublicationId>,
    /// Abandoned attempts changed to failed.
    pub abandoned: usize,
    /// Failed-attempt metadata rows removed after thirty days.
    pub pruned: usize,
}

/// Publication retention behavior, independent of deployment scheduling.
#[unimock::unimock(api = RetentionWorkerMock)]
pub trait RetentionWorker: Send + Sync {
    /// Scan at most one hundred candidates; callers retain the continuation.
    fn run_batch(&self, after: Option<PublicationId>) -> Result<RetentionReport>;
}

/// Composition-root worker with injected query and clock seams.
pub struct PublicationRetention {
    /// Query transactions for attempt cleanup and reference accounting.
    pub transactions: Arc<dyn Transactions>,
    /// Server time and event identity source.
    pub runtime: Arc<dyn Runtime>,
}

impl RetentionWorker for PublicationRetention {
    /// Recheck each candidate in its cleanup transaction. A concurrent ready
    /// commit keeps its publication, files and history unchanged.
    fn run_batch(&self, after: Option<PublicationId>) -> Result<RetentionReport> {
        let now = self.runtime.now();
        let cutoff = now - Duration::days(30);
        let mut candidates = Vec::new();
        self.transactions.run(true, &mut |queries| {
            candidates = queries
                .publication_candidates(now, cutoff, after, 100)
                .context("list bounded retention candidates")?;
            Ok(())
        })?;
        let mut report = RetentionReport {
            next: (candidates.len() == 100)
                .then(|| candidates.last().map(|value| value.id))
                .flatten(),
            ..RetentionReport::default()
        };
        for candidate in candidates {
            let event_id = self.runtime.id();
            let mut delta = (0, 0);
            self.transactions.run(false, &mut |queries| {
                delta = (0, 0);
                let Some(value) = queries
                    .publication(candidate.id)
                    .context("recheck retention candidate")?
                else {
                    return Ok(());
                };
                let event = PublicationEvent {
                    id: event_id,
                    publication_id: value.id,
                    kind: EventKind::Failed,
                    created_at: now,
                };
                match value.state {
                    PublicationState::Uploading | PublicationState::Validating
                        if value.deadline <= now =>
                    {
                        delta.0 = usize::from(close_unfinished(
                            queries,
                            value.id,
                            PublicationFailure::Expired,
                            &event,
                        )?);
                    }
                    PublicationState::Failed if value.created_at <= cutoff => {
                        delta.1 = usize::from(
                            queries
                                .delete_failed_publication(value.id, cutoff)
                                .context("prune failed attempt")?,
                        );
                    }
                    _ => (),
                }
                Ok(())
            })?;
            report.abandoned += delta.0;
            report.pruned += delta.1;
        }
        self.transactions.run(false, &mut |queries| {
            queries
                .prune_catalogue_grants(now)
                .context("prune expired catalogue grants")?;
            Ok(())
        })?;
        Ok(report)
    }
}
