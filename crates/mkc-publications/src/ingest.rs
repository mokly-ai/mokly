//! Authenticated delta upload: plan, blob and completion requests over one attempt.

use std::io::Read;
use std::sync::Arc;

use bytes::Bytes;
use chrono::{DateTime, Utc};
use mkc_auth::runtime::Runtime;
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{BuildId, ProjectId, PublicationId};
use mkc_domain::slug::{ProjectSlug, WorkspaceSlug};
use mkc_mokly_contract::bundle::UploadValidator;
use mkc_store_interface::build_state::UploadOutcome;
use mkc_store_interface::publication::Publication;

use crate::blob_upload::BlobUpload;
use crate::blob_writer::BlobWriter;
use crate::build_upload::BuildAuthorization;
use crate::completion::CompleteUpload;
use crate::error::Result;
use crate::policy::AccessPolicy;
use crate::preflight::Preflight;
use crate::stored_index::StoredIndexReader;
use crate::transaction::Transactions;
use crate::upload_authorization::{Credential, UploadPolicy};

/// Server-created lifetime of one upload attempt.
pub const ATTEMPT_MINUTES: i64 = 60;

/// Bearer authorization result. Raw credentials are never retained.
#[derive(Clone)]
pub struct UploadAuthorization {
    pub(crate) project: ProjectId,
    pub(crate) credential: Credential,
    pub(crate) build_id: Option<BuildId>,
    pub(crate) organization_slug: WorkspaceSlug,
    pub(crate) project_slug: ProjectSlug,
}

#[cfg(feature = "test-support")]
impl UploadAuthorization {
    /// Fabricate an authorization for HTTP adapter tests; only the `test-support`
    /// feature, enabled by dev-dependencies, compiles this constructor.
    pub fn for_tests(
        project: ProjectId,
        organization_slug: WorkspaceSlug,
        project_slug: ProjectSlug,
    ) -> Self {
        Self {
            project,
            credential: Credential::Project(String::new()),
            build_id: None,
            organization_slug,
            project_slug,
        }
    }

    /// The project this authorization admits.
    pub fn project(&self) -> ProjectId {
        self.project
    }
}

/// A ready publication, newly committed or found by its idempotency key.
#[derive(Clone, Debug)]
pub struct Ingested {
    /// Immutable stored publication.
    pub publication: Publication,
    /// Current organization slug observed while authorizing this upload.
    pub organization_slug: WorkspaceSlug,
    /// Current project slug observed while authorizing this upload.
    pub project_slug: ProjectSlug,
    /// Whether another upload already committed this identity.
    pub replay: bool,
}

/// The plan answer: the attempt and the hashes this project still needs.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Plan {
    /// Attempt id, also the publication id when it becomes ready.
    pub upload: PublicationId,
    /// Project owning the attempt.
    pub project: ProjectId,
    /// Server-created attempt deadline.
    pub expires_at: DateTime<Utc>,
    /// Distinct declared hashes not yet stored durably by this project, ascending.
    pub missing: Vec<BlobHash>,
}

/// One reserved blob a PUT may store, read before the body is accepted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BlobTarget {
    /// Project owning the reserved row.
    pub project: ProjectId,
    /// Exact reserved storage incarnation.
    pub key: BlobKey,
    /// Declared byte length.
    pub size: u64,
    /// Whether the project already stored this hash durably.
    pub durable: bool,
    /// Attempt deadline bounding the storage write.
    pub deadline: DateTime<Utc>,
}

/// Upload state machine consumed by the HTTP boundary.
#[unimock::unimock(api = IngestMock)]
pub trait Ingest: Send + Sync {
    /// Authenticate without reading or decompressing request bytes.
    fn authorize(&self, project: ProjectId, bearer: &str) -> Result<UploadAuthorization>;
    /// Authenticate completion, including the consumed grant's own ready retry.
    fn authorize_completion(
        &self,
        project: ProjectId,
        bearer: &str,
        upload: PublicationId,
    ) -> Result<UploadAuthorization>;
    /// Persist a build request's answered outcome; raw credentials are never stored.
    fn record_upload_outcome(
        &self,
        project: ProjectId,
        bearer: &str,
        outcome: UploadOutcome,
    ) -> Result<()>;
    /// Validate the plan archive, store its artifacts and reserve every declared file.
    fn preflight(&self, authorization: UploadAuthorization, body: &mut dyn Read) -> Result<Plan>;
    /// Resolve the reservation for one blob PUT before its body is read.
    ///
    /// `hash` is `None` when the path segment is not a digest; after the attempt
    /// checks such a request is an unreserved blob.
    fn blob_target(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
        hash: Option<&BlobHash>,
    ) -> Result<BlobTarget>;
    /// Verify buffered bytes against the reservation, store them and mark them durable.
    fn store_blob(&self, target: &BlobTarget, bytes: Bytes) -> Result<()>;
    /// Resolve completion in the released order and publish when every blob is durable.
    fn complete(
        &self,
        authorization: UploadAuthorization,
        upload: PublicationId,
    ) -> Result<Ingested>;
}

/// Composition-root service; consumers use `dyn Ingest`.
pub struct PublicationIngest {
    /// Query transaction executor.
    pub transactions: Arc<dyn Transactions>,
    /// Clock and entropy generated before retryable work.
    pub runtime: Arc<dyn Runtime>,
    /// Shared project authorization policy.
    pub policy: Arc<dyn AccessPolicy>,
    /// Published artifact contract validator.
    pub validator: Arc<dyn UploadValidator>,
    /// Pending-blob persistence boundary.
    pub writer: Arc<dyn BlobWriter>,
    /// Bounded reads of accepted index files at completion.
    pub files: Arc<dyn StoredIndexReader>,
}

impl Ingest for PublicationIngest {
    fn authorize(&self, project: ProjectId, bearer: &str) -> Result<UploadAuthorization> {
        self.authenticate(project, bearer, None)
    }

    fn authorize_completion(
        &self,
        project: ProjectId,
        bearer: &str,
        upload: PublicationId,
    ) -> Result<UploadAuthorization> {
        self.authenticate(project, bearer, Some(upload))
    }

    fn record_upload_outcome(
        &self,
        project: ProjectId,
        bearer: &str,
        outcome: UploadOutcome,
    ) -> Result<()> {
        self.record_outcome(project, bearer, outcome)
    }

    fn preflight(&self, authorization: UploadAuthorization, body: &mut dyn Read) -> Result<Plan> {
        self.plan(authorization, body)
    }

    fn blob_target(
        &self,
        authorization: &UploadAuthorization,
        upload: PublicationId,
        hash: Option<&BlobHash>,
    ) -> Result<BlobTarget> {
        self.target(authorization, upload, hash)
    }

    fn store_blob(&self, target: &BlobTarget, bytes: Bytes) -> Result<()> {
        self.store(target, bytes)
    }

    fn complete(
        &self,
        authorization: UploadAuthorization,
        upload: PublicationId,
    ) -> Result<Ingested> {
        self.complete_upload(authorization, upload)
    }
}
