//! Immutable content storage with bounded, restartable orphan enumeration.

use bytes::Bytes;
use chrono::{DateTime, Utc};
use mkc_domain::blob::{BlobHash, BlobKey};

use crate::deadline::OperationDeadline;
use crate::error::{Error, IntegrityError, Result};
use crate::stream::{BlobStream, ByteRange};

/// Inclusive upload-v1 regular-file ceiling.
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;

/// Exact object identity and authoritative backend creation time.
#[derive(Clone, Debug)]
pub struct StoredObject {
    /// Fenced content identity.
    pub key: BlobKey,
    /// Time at which these bytes became durable.
    pub created_at: DateTime<Utc>,
}

/// A bounded backend listing; callers carry the opaque continuation forward.
#[derive(Clone, Debug)]
pub struct ObjectPage {
    /// Recognized immutable objects on this page.
    pub items: Vec<StoredObject>,
    /// Backend continuation, absent after the final page.
    pub next_cursor: Option<String>,
}

/// Shared storage behavior for verified full objects and exact bounded ranges.
#[unimock::unimock(api = FileStoreMock)]
#[async_trait::async_trait]
pub trait FileStore: Send + Sync {
    /// Create immutable bytes, accepting an identical repeated write.
    fn put(&self, key: &BlobKey, bytes: Bytes, deadline: OperationDeadline) -> Result<()>;
    /// Read verified bytes; missing objects remain distinct from failures.
    fn get(&self, key: &BlobKey) -> Result<Option<Vec<u8>>>;
    /// Open a bounded stream, optionally selecting a validated inclusive range.
    async fn open(&self, key: &BlobKey, range: Option<ByteRange>) -> Result<Option<BlobStream>>;
    /// Idempotently delete this incarnation only.
    fn delete(&self, key: &BlobKey) -> Result<()>;
    /// List at most 1000 objects with a backend-owned continuation token.
    fn list(&self, cursor: Option<&str>, limit: u32) -> Result<ObjectPage>;
}

/// Verify bounded content without changing the caller's bytes.
pub fn verify(key: &BlobKey, bytes: &[u8]) -> Result<()> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(Error::internal(IntegrityError::TooLarge));
    }
    if BlobHash::digest(bytes) != key.hash {
        return Err(Error::internal(IntegrityError::DigestMismatch));
    }
    Ok(())
}
