//! Blob reference reservation and ready-winner discovery.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_mokly_contract::bundle::PlanBundle;
use mkc_mokly_contract::error::Rejection;
use mkc_mokly_contract::inventory::MARKER_PATH;
use mkc_store_interface::blob::{Blob, PublicationFile};
use mkc_store_interface::publication::{Publication, PublicationFailure};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};
use mkc_store_interface::store::Queries;
use mokly_content_types::delivered_content_type;

use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{PublicationIngest, UploadAuthorization};
use crate::upload_authorization::{UploadCommit, UploadPolicy};

use super::{Prepared, Reservation};

impl Reservation for PublicationIngest {
    fn reserve(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        bundle: &PlanBundle,
    ) -> Result<Prepared> {
        let candidates = self.candidates(attempt, bundle)?;
        let now = self.runtime.now();
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: attempt.id,
            kind: EventKind::Validating,
            created_at: now,
        };
        let failed = PublicationEvent {
            id: self.runtime.id(),
            kind: EventKind::Failed,
            ..event.clone()
        };
        let distinct_hashes = candidates
            .iter()
            .map(|candidate| &candidate.key.hash)
            .collect::<HashSet<_>>()
            .len();
        let mut prepared = Prepared {
            files: Vec::new(),
            pending: Vec::new(),
            existing: None,
            file_count: candidates.len(),
            distinct_hashes,
        };
        self.transactions.run(false, &mut |queries| {
            prepared.files.clear();
            prepared.pending.clear();
            prepared.existing = None;
            prepared.file_count = candidates.len();
            prepared.distinct_hashes = distinct_hashes;
            let mut authorized = self.check(queries, authorization, None, now)?;
            authorized.scope(attempt)?;
            let metadata = authorized.metadata(bundle.manifest())?;
            if !queries
                .validate_publication(attempt.id, &metadata)
                .context("enter publication validation")?
            {
                return Err(Error::Expired);
            }
            let existing = queries
                .publication_by_identity(
                    authorized.project.id,
                    &metadata.head_sha,
                    &metadata.config_path,
                )
                .context("find validated replay winner")?;
            if let Some(publication) = existing {
                prepared.existing = Some(publication.clone());
                queries
                    .fail_publication(attempt.id, PublicationFailure::Superseded)
                    .context("record replay attempt")?;
                queries
                    .insert_publication_event(&failed)
                    .context("record replay outcome")?;
                authorized.touch_token(queries, now)?;
                return Ok(());
            }
            reserve_candidates(queries, &candidates, now, &mut prepared)?;
            queries
                .insert_publication_event(&event)
                .context("record validated index reservation")?;
            Ok(())
        })?;
        Ok(prepared)
    }
}

/// Read or insert the project's blob row for each hash, then attach every
/// path for that hash. A row another in-flight upload created is reused and
/// stays pending until its marker is set; a declared size that differs from
/// the row is an invalid bundle; a row the collector is deleting makes the
/// plan unavailable.
fn reserve_candidates(
    queries: &mut dyn Queries,
    candidates: &[PublicationFile],
    now: DateTime<Utc>,
    prepared: &mut Prepared,
) -> Result<()> {
    let mut start = 0;
    while start < candidates.len() {
        let candidate = &candidates[start];
        let end = start
            + candidates[start..].partition_point(|value| value.key.hash == candidate.key.hash);
        let blob = match queries
            .blob(candidate.project_id, &candidate.key.hash)
            .context("read project blob reservation")?
        {
            Some(blob) => blob,
            None => {
                let blob = Blob {
                    project_id: candidate.project_id,
                    key: candidate.key.clone(),
                    size: candidate.size,
                    content_type: candidate.content_type.clone(),
                    ref_count: 0,
                    deleting: false,
                    unreferenced_at: Some(now),
                    stored_at: None,
                };
                queries
                    .insert_blob(&blob)
                    .context("reserve new blob before external write")?;
                blob
            }
        };
        if blob.deleting {
            return Err(Error::Unavailable);
        }
        if candidates[start..end].iter().any(|c| c.size != blob.size) {
            return Err(Error::InvalidBundle {
                reason: Rejection::ArtifactDigest,
            });
        }
        let pending = blob.stored_at.is_none();
        for (offset, candidate) in candidates[start..end].iter().enumerate() {
            let file = PublicationFile {
                key: blob.key.clone(),
                ..candidate.clone()
            };
            queries
                .insert_publication_file(&file)
                .context("attach reserved publication path")?;
            if pending && offset == 0 {
                prepared.pending.push(file.clone());
            }
            prepared.files.push(file);
        }
        start = end;
    }
    Ok(())
}

trait Candidates {
    fn candidates(
        &self,
        attempt: &Publication,
        bundle: &PlanBundle,
    ) -> Result<Vec<PublicationFile>>;
}

impl Candidates for PublicationIngest {
    /// Every declared file plus the private marker, in canonical hash-then-path
    /// order. Reservation reads or inserts one blob row per hash and attaches
    /// every path for that hash before it advances, so inserts and locks share
    /// the canonical order: a new hash's insert can wait on a concurrent inserter.
    fn candidates(
        &self,
        attempt: &Publication,
        bundle: &PlanBundle,
    ) -> Result<Vec<PublicationFile>> {
        let marker = bundle
            .artifacts()
            .into_iter()
            .find(|artifact| artifact.path == MARKER_PATH)
            .ok_or(Error::NotFound)?;
        let mut declared = Vec::with_capacity(bundle.inventory().files.len() + 1);
        declared.push((
            marker.path,
            BlobHash::digest(&marker.bytes),
            marker.bytes.len() as i64,
        ));
        for file in &bundle.inventory().files {
            let hash: BlobHash = file.sha256.parse().context("decode declared blob hash")?;
            let size = i64::try_from(file.size).context("size declared blob")?;
            declared.push((file.path.clone(), hash, size));
        }
        let mut candidates: Vec<_> = declared
            .into_iter()
            .map(|(path, hash, size)| PublicationFile {
                publication_id: attempt.id,
                project_id: attempt.project_id,
                key: BlobKey {
                    hash,
                    incarnation: self.runtime.id(),
                },
                content_type: delivered_content_type(&path),
                path,
                size,
            })
            .collect();
        candidates.sort_by(|left, right| {
            left.key
                .hash
                .cmp(&right.key.hash)
                .then_with(|| left.path.cmp(&right.path))
        });
        Ok(candidates)
    }
}
