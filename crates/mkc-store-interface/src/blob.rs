//! Content references and garbage-collection query boundaries.

use chrono::{DateTime, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};
use mkc_domain::ids::{ProjectId, PublicationId};

use crate::error::Result;

/// Content row shared across one project's publication paths.
#[derive(Clone, Debug)]
pub struct Blob {
    /// Project that owns this stored copy.
    pub project_id: ProjectId,
    /// Fenced immutable storage identity.
    pub key: BlobKey,
    /// Exact byte length.
    pub size: i64,
    /// Original indexed MIME; serving uses each path's MIME.
    pub content_type: String,
    /// Number of publication-file references, maintained by SQL triggers.
    pub ref_count: i64,
    /// Collector tombstone; new references are forbidden.
    pub deleting: bool,
    /// Start of the current unreferenced interval.
    pub unreferenced_at: Option<DateTime<Utc>>,
    /// First database time this incarnation was confirmed durable.
    pub stored_at: Option<DateTime<Utc>>,
}

/// Path-to-content index; every row contributes one reference.
#[derive(Clone, Debug)]
pub struct PublicationFile {
    /// Owning publication/attempt.
    pub publication_id: PublicationId,
    /// Owning project, constrained to match the publication and blob row.
    pub project_id: ProjectId,
    /// Validated archive-relative path.
    pub path: String,
    /// Referenced content and its current incarnation.
    pub key: BlobKey,
    /// MIME derived from this path, not from a different deduplicated file.
    pub content_type: String,
    /// Exact regular-file byte count.
    pub size: i64,
}

/// Queries for immutable content reservation and collection.
#[unimock::unimock(api = BlobsMock)]
pub trait Blobs {
    /// Lookup one project's content hash; absence allows a new incarnation.
    fn blob(&mut self, project: ProjectId, hash: &BlobHash) -> Result<Option<Blob>>;
    /// Lookup the globally exact storage incarnation used by maintenance.
    fn blob_by_key(&mut self, key: &BlobKey) -> Result<Option<Blob>>;
    /// Insert a new zero-reference content row.
    fn insert_blob(&mut self, blob: &Blob) -> Result<()>;
    /// Attach a path, atomically increasing its live blob reference count.
    fn insert_publication_file(&mut self, file: &PublicationFile) -> Result<()>;
    /// Read exact file metadata without listing the entire catalogue.
    fn publication_file(
        &mut self,
        publication: PublicationId,
        path: &str,
    ) -> Result<Option<PublicationFile>>;
    /// Read the bounded complete accepted path inventory.
    fn publication_files(&mut self, publication: PublicationId) -> Result<Vec<PublicationFile>>;
    /// Mark the exact non-deleting incarnation durable, retaining its first timestamp.
    fn mark_blob_stored(&mut self, key: &BlobKey) -> Result<bool>;
    /// Read distinct non-durable hashes referenced by one publication in hash order.
    fn pending_publication_blobs(&mut self, publication: PublicationId) -> Result<Vec<BlobHash>>;
    /// The project-owned content row one publication references with this hash, if any.
    fn publication_blob(
        &mut self,
        publication: PublicationId,
        hash: &BlobHash,
    ) -> Result<Option<Blob>>;
    /// Release references; cascading parent deletes use the same SQL triggers.
    ///
    /// Refuses with an internal error while the publication is ready: a
    /// published catalogue keeps its file list until it expires.
    fn delete_publication_files(&mut self, publication: PublicationId) -> Result<()>;
    /// Zero-reference expired-grace candidates and retryable tombstones.
    fn garbage_blobs(&mut self, before: DateTime<Utc>, limit: i64) -> Result<Vec<Blob>>;
    /// Tombstone the same incarnation only if still unreferenced.
    fn mark_blob_deleting(&mut self, key: &BlobKey) -> Result<bool>;
    /// Remove the same zero-reference tombstone after external deletion.
    fn delete_blob_record(&mut self, key: &BlobKey) -> Result<bool>;
}
