//! Redacted output and step progress delivered independently of stream reads.

use async_trait::async_trait;
use uuid::Uuid;

use crate::error::Result;
use crate::outcome::BuildStep;

/// Maximum bytes in one sink chunk.
pub const MAX_CHUNK_BYTES: usize = 64 * 1024;

/// Source of a redacted output chunk.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BuildStream {
    /// Process standard output.
    Stdout,
    /// Process standard error.
    Stderr,
    /// Runner command and result lines.
    System,
}

/// Nonempty, redacted bytes from one attempt and step.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BuildLogChunk {
    /// Fences storage writes against another attempt.
    pub attempt_operation_id: Uuid,
    /// Step that produced the output.
    pub step: BuildStep,
    /// Source stream.
    pub stream: BuildStream,
    /// At most 64 KiB; readers later normalize terminal bytes.
    pub bytes: Vec<u8>,
}

/// Injectable sink; any failure stops the attempt as infrastructure failure.
#[unimock::unimock(api = BuildLogSinkMock)]
#[async_trait]
pub trait BuildLogSink: Send + Sync {
    /// Record step progress before its first process.
    async fn step_started(&self, attempt_operation_id: Uuid, step: BuildStep) -> Result<()>;
    /// Persist one redacted chunk off the provider stream's reading task.
    async fn write(&self, chunk: BuildLogChunk) -> Result<()>;
}
