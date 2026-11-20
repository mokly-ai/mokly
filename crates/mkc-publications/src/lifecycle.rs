//! Terminal failure cleanup and private ingest metadata classification.

use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::PublicationFailure;
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::Queries;

use crate::error::{ErrorResultExt, Result};
use crate::ingest::PublicationIngest;

pub(crate) trait Lifecycle {
    fn fail(&self, publication: PublicationId, failure: PublicationFailure) -> Result<()>;
}

impl Lifecycle for PublicationIngest {
    fn fail(&self, publication: PublicationId, failure: PublicationFailure) -> Result<()> {
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: publication,
            kind: EventKind::Failed,
            created_at: self.runtime.now(),
        };
        self.transactions.run(false, &mut |queries| {
            close_unfinished(queries, publication, failure, &event)?;
            Ok(())
        })
    }
}

/// Close an unfinished upload, release its file list and record `event`.
///
/// Only the transaction whose conditional update closed the upload releases its
/// files, so a ready, expired or already closed publication keeps them. Returns
/// whether this call closed the upload.
pub(crate) fn close_unfinished(
    queries: &mut dyn Queries,
    publication: PublicationId,
    failure: PublicationFailure,
    event: &PublicationEvent,
) -> Result<bool> {
    if !queries
        .fail_publication(publication, failure)
        .context("close unfinished upload")?
    {
        return Ok(false);
    }
    queries
        .delete_publication_files(publication)
        .context("release closed upload references")?;
    queries
        .insert_publication_event(event)
        .context("record closed upload")?;
    Ok(true)
}

/// Private control files are retained for ingest but never delivered as assets.
pub fn private_path(path: &str) -> bool {
    matches!(path, "mokly-upload.json" | ".mokly-export-artifact")
}
