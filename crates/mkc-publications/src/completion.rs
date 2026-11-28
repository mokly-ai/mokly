//! Completion requests, resolved in the released order before the ready transaction.

use mkc_domain::ids::PublicationId;
use mkc_mokly_contract::index::INDEX_PATH;
use mkc_store_interface::publication::{Publication, PublicationFailure};

use crate::completion_outcome::{self, Outcome, StoredIndex, ingested};
use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{Ingested, PublicationIngest, UploadAuthorization};
use crate::lifecycle::Lifecycle;
use crate::reservation::Completion;
use crate::upload_authorization::UploadPolicy;

pub(crate) trait CompleteUpload {
    fn complete_upload(
        &self,
        authorization: UploadAuthorization,
        upload: PublicationId,
    ) -> Result<Ingested>;
}

impl CompleteUpload for PublicationIngest {
    /// An authorization or deadline outcome found after the fast check closes
    /// the upload; an internal or unavailable failure leaves it validating so
    /// the CLI's retry can complete it before the deadline.
    fn complete_upload(
        &self,
        authorization: UploadAuthorization,
        upload: PublicationId,
    ) -> Result<Ingested> {
        let (attempt, outcome) = self.resolve(&authorization, upload)?;
        if authorization.build_id.is_some() && !matches!(outcome, Outcome::Publish) {
            let metadata = attempt.metadata.clone().ok_or(Error::Expired)?;
            return self.finish(&authorization, &attempt, &metadata, &StoredIndex::Missing);
        }
        let metadata = match outcome {
            Outcome::Published(publication) => {
                return Ok(ingested(&authorization, publication, false));
            }
            Outcome::Replaced(ready) => return Ok(ingested(&authorization, ready, true)),
            Outcome::Supersede(ready) => {
                self.fail(upload, PublicationFailure::Superseded)?;
                return Ok(ingested(&authorization, ready, true));
            }
            Outcome::Publish => attempt.metadata.clone().ok_or(Error::Expired)?,
        };
        let mut pending = Vec::new();
        self.transactions.run(true, &mut |queries| {
            pending = queries
                .pending_publication_blobs(attempt.id)
                .context("read blobs still to send")?;
            Ok(())
        })?;
        if !pending.is_empty() {
            return Err(Error::Incomplete);
        }
        let result = {
            let index = self.index(&attempt)?;
            self.finish(&authorization, &attempt, &metadata, &index)
        };
        if let Err(error) = &result
            && matches!(
                error,
                Error::Expired | Error::Unauthorized | Error::Forbidden | Error::PlanRequired
            )
            && let Err(cleanup) = self.fail(attempt.id, error.failure())
        {
            tracing::error!(publication = %attempt.id, ?cleanup, "upload cleanup failed; retention will recover the attempt");
        }
        result
    }
}

trait CompletionSteps {
    fn resolve(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
    ) -> Result<(Publication, Outcome)>;
    fn index(&self, attempt: &Publication) -> Result<StoredIndex>;
}

impl CompletionSteps for PublicationIngest {
    /// Read the upload in this project and decide from its own row.
    fn resolve(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
    ) -> Result<(Publication, Outcome)> {
        let now = self.runtime.now();
        let mut resolution = None;
        self.transactions.run(true, &mut |queries| {
            resolution = None;
            let authorized = if authorization.build_id.is_some() {
                Some(self.check(queries, authorization, Some(upload), now)?)
            } else {
                None
            };
            let attempt = queries
                .publication(upload)
                .context("read completing upload")?
                .filter(|attempt| attempt.project_id == authorization.project)
                .ok_or(Error::NotFound)?;
            if let Some(authorized) = authorized {
                authorized.scope(&attempt)?;
            }
            let outcome = completion_outcome::resolve(queries, &attempt, now)?;
            resolution = Some((attempt, outcome));
            Ok(())
        })?;
        resolution.ok_or(Error::NotFound)
    }

    /// Reload the stored index of every attempt that might publish.
    ///
    /// A missing reference or object is reported, not raised: another request
    /// may have closed the upload and released its references meanwhile.
    fn index(&self, attempt: &Publication) -> Result<StoredIndex> {
        let mut file = None;
        self.transactions.run(true, &mut |queries| {
            file = queries
                .publication_file(attempt.id, INDEX_PATH)
                .context("read stored catalogue index reference")?;
            Ok(())
        })?;
        let Some(file) = file else {
            return Ok(StoredIndex::Missing);
        };
        let Some(index) = self
            .files
            .load(&file.key)
            .context("read stored catalogue index")?
        else {
            return Ok(StoredIndex::Missing);
        };
        Ok(StoredIndex::Loaded(Box::new(index)))
    }
}
