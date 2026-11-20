//! Completion requests, resolved in the released order before the ready transaction.

use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::{Publication, PublicationFailure};

use crate::catalogue_content::ContentCheck;
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
    /// Content, authorization and deadline rejections close the upload.
    /// Internal or unavailable failures leave it validating for retries before its deadline.
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
        let result = self
            .content(&attempt)
            .and_then(|index| self.finish(&authorization, &attempt, &metadata, &index));
        if let Err(error) = &result
            && matches!(
                error,
                Error::InvalidBundle { .. }
                    | Error::Expired
                    | Error::Unauthorized
                    | Error::Forbidden
                    | Error::PlanRequired
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
}
