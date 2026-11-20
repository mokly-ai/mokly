//! Plan requests: admit an attempt, validate its artifacts and reserve every declared file.

use std::collections::{BTreeMap, BTreeSet};
use std::io::Read;

use bytes::Bytes;
use chrono::Duration;
use mkc_domain::blob::BlobHash;
use mkc_domain::ids::PublicationId;
use mkc_mokly_contract::bundle::PlanBundle;
use mkc_mokly_contract::error;
use mkc_store_interface::publication::{Publication, PublicationState};
use mkc_store_interface::publication_event::{EventKind, PublicationEvent};

use crate::blob_writer::{BlobWriteReport, PendingBlob};
use crate::envelope::RejectedIdentity;
use crate::error::{Error, ErrorResultExt, Result};
use crate::ingest::{ATTEMPT_MINUTES, Plan, PublicationIngest, UploadAuthorization};
use crate::lifecycle::Lifecycle;
use crate::reservation::Reservation;
use crate::upload_authorization::UploadPolicy;

pub(crate) trait Preflight {
    fn plan(&self, authorization: UploadAuthorization, body: &mut dyn Read) -> Result<Plan>;
}

/// Structured plan measurements emitted once for every plan request.
#[derive(Default)]
struct PlanTrace {
    files: usize,
    distinct_hashes: usize,
    missing: usize,
    report: BlobWriteReport,
}

impl Preflight for PublicationIngest {
    fn plan(&self, authorization: UploadAuthorization, body: &mut dyn Read) -> Result<Plan> {
        let attempt = self.admit(&authorization)?;
        let mut trace = PlanTrace::default();
        let result = self.reserve_and_store(&authorization, &attempt, body, &mut trace);
        if let Err(error) = &result
            && let Err(cleanup) = self.fail(attempt.id, error.failure())
        {
            tracing::error!(publication = %attempt.id, ?cleanup, "upload cleanup failed; retention will recover the attempt");
        }
        trace_plan(attempt.id, &trace);
        result
    }
}

trait PlanSteps {
    fn admit(&self, authorization: &UploadAuthorization) -> Result<Publication>;
    fn reserve_and_store(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        body: &mut dyn Read,
        trace: &mut PlanTrace,
    ) -> Result<Plan>;
    fn bundle(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        body: &mut dyn Read,
    ) -> Result<PlanBundle>;
}

impl PlanSteps for PublicationIngest {
    fn admit(&self, authorization: &UploadAuthorization) -> Result<Publication> {
        let now = self.runtime.now();
        let mut attempt = Publication {
            id: self.runtime.id().into(),
            project_id: authorization.project,
            metadata: None,
            state: PublicationState::Uploading,
            failure: None,
            changes: None,
            created_at: now,
            deadline: now + Duration::minutes(ATTEMPT_MINUTES),
            expired_at: None,
            build_id: authorization.build_id,
            build_failure_event_id: authorization.build_id.map(|_| self.runtime.id()),
        };
        let event = PublicationEvent {
            id: self.runtime.id(),
            publication_id: attempt.id,
            kind: EventKind::Uploading,
            created_at: now,
        };
        self.transactions.run(false, &mut |queries| {
            let authorized = self.check(queries, authorization, None, now)?;
            if let Some((grant, _)) = authorized.build {
                attempt.deadline = attempt.deadline.min(grant.expires_at);
            }
            queries
                .insert_publication(&attempt)
                .context("create authenticated upload attempt")?;
            queries
                .insert_publication_event(&event)
                .context("record upload admission")?;
            Ok(())
        })?;
        Ok(attempt)
    }

    fn reserve_and_store(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        body: &mut dyn Read,
        trace: &mut PlanTrace,
    ) -> Result<Plan> {
        let bundle = self.bundle(authorization, attempt, body)?;
        let prepared = self.reserve(authorization, attempt, &bundle);
        if matches!(&prepared, Err(Error::InvalidBundle { .. })) {
            self.retain_identity(authorization, attempt, bundle.manifest())?;
        }
        let prepared = prepared?;
        trace.files = prepared.file_count;
        trace.distinct_hashes = prepared.distinct_hashes;
        let mut plan = Plan {
            upload: attempt.id,
            project: attempt.project_id,
            expires_at: attempt.deadline,
            missing: Vec::new(),
        };
        if prepared.existing.is_some() {
            return Ok(plan);
        }
        let artifacts: BTreeMap<BlobHash, Bytes> = bundle
            .artifacts()
            .into_iter()
            .map(|artifact| (BlobHash::digest(&artifact.bytes), artifact.bytes))
            .collect();
        let pending: Vec<PendingBlob<'_>> = prepared
            .pending
            .iter()
            .filter_map(|file| {
                artifacts.get(&file.key.hash).map(|bytes| PendingBlob {
                    project_id: file.project_id,
                    key: &file.key,
                    bytes: bytes.clone(),
                })
            })
            .collect();
        self.writer
            .write(attempt.deadline, &pending, &mut trace.report)?;
        plan.missing = prepared
            .pending
            .iter()
            .map(|file| &file.key.hash)
            .filter(|hash| !artifacts.contains_key(*hash))
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        trace.missing = plan.missing.len();
        Ok(plan)
    }

    fn bundle(
        &self,
        authorization: &UploadAuthorization,
        attempt: &Publication,
        body: &mut dyn Read,
    ) -> Result<PlanBundle> {
        let mut envelope = None;
        let validated = self.validator.validate_with_envelope(body, &mut envelope);
        if validated.is_err()
            && let Some(manifest) = &envelope
        {
            self.retain_identity(authorization, attempt, manifest)?;
        }
        match validated {
            Ok(bundle) => Ok(bundle),
            Err(error::Error::UnsupportedVersion { artifact, version }) => {
                Err(Error::UnsupportedVersion { artifact, version })
            }
            Err(error::Error::TooLarge { limit }) => Err(Error::TooLarge { limit }),
            Err(error::Error::Invalid { reason }) => Err(Error::InvalidBundle { reason }),
            Err(error::Error::Unavailable) => Err(Error::Unavailable),
            Err(error::Error::Internal(source)) => Err(Error::internal(source)),
        }
    }
}

fn trace_plan(publication_id: PublicationId, trace: &PlanTrace) {
    tracing::info!(
        publication_id = %publication_id,
        files = trace.files,
        distinct_hashes = trace.distinct_hashes,
        missing = trace.missing,
        written = trace.report.written,
        bytes = trace.report.bytes,
        write_duration_ms = trace.report.duration_ms,
        "publication upload planned"
    );
}
