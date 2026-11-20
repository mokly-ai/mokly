//! Blob PUTs: resolve the attempt's reservation, verify the body, store and mark it.

use bytes::Bytes;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::PublicationId;
use mkc_store_interface::publication::PublicationState;

use crate::blob_writer::{BlobWriteReport, PendingBlob};
use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{BlobTarget, PublicationIngest, UploadAuthorization};
use crate::upload_authorization::UploadPolicy;

pub(crate) trait BlobUpload {
    fn target(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
        hash: Option<&BlobHash>,
    ) -> Result<BlobTarget>;
    fn store(&self, target: &BlobTarget, bytes: Bytes) -> Result<()>;
}

impl BlobUpload for PublicationIngest {
    /// An unknown or foreign attempt is not found; a closed or late one has expired.
    fn target(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
        hash: Option<&BlobHash>,
    ) -> Result<BlobTarget> {
        let now = self.runtime.now();
        let mut target = None;
        self.transactions.run(true, &mut |queries| {
            target = None;
            let authorized = if authorization.build_id.is_some() {
                Some(self.check(queries, authorization, None, now)?)
            } else {
                None
            };
            let attempt = queries
                .publication(upload)
                .context("read upload attempt")?
                .filter(|attempt| attempt.project_id == authorization.project)
                .ok_or(Error::NotFound)?;
            if let Some(authorized) = authorized {
                authorized.scope(&attempt)?;
            }
            if attempt.state != PublicationState::Validating || attempt.deadline <= now {
                return Err(Error::Expired);
            }
            let hash = hash.ok_or(Error::UnknownBlob)?;
            let blob = queries
                .publication_blob(upload, hash)
                .context("read reserved upload blob")?
                .ok_or(Error::UnknownBlob)?;
            if blob.deleting {
                return Err(Error::Unavailable);
            }
            target = Some(BlobTarget {
                project: attempt.project_id,
                size: u64::try_from(blob.size).context("size reserved upload blob")?,
                durable: blob.stored_at.is_some(),
                deadline: attempt.deadline,
                key: blob.key,
            });
            Ok(())
        })?;
        target.ok_or(Error::NotFound)
    }

    /// Nothing is stored unless the server-computed digest and length match.
    fn store(&self, target: &BlobTarget, bytes: Bytes) -> Result<()> {
        if bytes.len() as u64 != target.size || BlobHash::digest(&bytes) != target.key.hash {
            return Err(Error::BlobMismatch);
        }
        let mut report = BlobWriteReport::default();
        let written = self.writer.write(
            target.deadline,
            &[PendingBlob {
                project_id: target.project,
                key: &target.key,
                bytes,
            }],
            &mut report,
        );
        tracing::info!(
            hash = %target.key.hash,
            written = report.written,
            bytes = report.bytes,
            write_duration_ms = report.duration_ms,
            "publication blob stored"
        );
        written
    }
}
