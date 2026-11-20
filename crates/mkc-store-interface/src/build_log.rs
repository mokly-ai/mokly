//! Bounded log storage with permanent sequence identities and attempt fencing.

use chrono::{DateTime, Utc};
use mkc_domain::ids::{BuildId, ProjectId};
use uuid::Uuid;

use crate::build_state::{BuildStep, BuildStream};
use crate::error::Result;

/// Retained bytes for one attempt, step and output stream.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildLogChunk {
    /// Permanent per-build cursor, never reused across attempts.
    pub sequence: i64,
    /// Attempt that produced the bytes.
    pub attempt: i32,
    /// Step that produced the output, if known.
    pub step: Option<BuildStep>,
    /// Byte source.
    pub stream: BuildStream,
    /// Redacted bytes, from one through 65,536 bytes.
    pub bytes: Vec<u8>,
    /// Server append time.
    pub created_at: DateTime<Utc>,
}

/// One append, rejected when its operation no longer matches the last attempt.
#[derive(Clone, Debug)]
pub struct NewBuildLogChunk {
    /// Last attempt's permanent operation identity.
    pub attempt_operation_id: Uuid,
    /// Step, if known.
    pub step: Option<BuildStep>,
    /// Byte source.
    pub stream: BuildStream,
    /// Already-redacted, nonempty bytes, at most 65,536.
    pub bytes: Vec<u8>,
    /// Captured append time.
    pub created_at: DateTime<Utc>,
}

/// Retained log window; byte normalization belongs to the API.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BuildLogWindow {
    /// Ordered chunks after the requested cursor.
    pub chunks: Vec<BuildLogChunk>,
    /// Last returned sequence, or the supplied cursor if empty.
    pub next_after: i64,
    /// Terminal, flushed output with nothing after next_after.
    pub complete: bool,
    /// Last retained head sequence before elision.
    pub head_sequence: i64,
    /// Bytes removed from the latest attempt's rolling tail.
    pub elided_bytes: i64,
}

/// Query-only log append and reads.
#[unimock::unimock(api = BuildLogsMock)]
pub trait BuildLogs {
    /// Append under the one-MiB cap; split at the first-256-KiB head boundary.
    /// Serializes on the build row and allocates from its atomic counter.
    /// Returns false for an absent or replaced attempt, including late writers.
    fn append_build_log(&mut self, build: BuildId, chunk: &NewBuildLogChunk) -> Result<bool>;
    /// Read up to 100 chunks or 256 KiB after a cursor, with at least one if any exist.
    fn build_log(
        &mut self,
        project: ProjectId,
        build: BuildId,
        after: i64,
        limit: i64,
    ) -> Result<Option<BuildLogWindow>>;
}
