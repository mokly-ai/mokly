//! Injectable process workers, shutdown controls, and diagnostic delivery.

use std::path::Path;
use std::sync::Arc;

use crate::error::{Error, Result};
use crate::operations::Operation;
use crate::pool_options::Launch;
use crate::wire::{MethodResult, Request};

/// Diagnostics from protocol events and the process standard error stream.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiagnosticsMock))]
pub trait Diagnostics: Send + Sync {
    /// Select source-owned text reporting while preserving timing and operation reports.
    fn for_source_root(&self, _root: &Path) -> Option<Arc<dyn Diagnostics>> {
        None
    }
    /// Forward diagnostic text to the caller's terminal reporter.
    fn emit(&self, message: &str);
    /// Forward one complete sidecar timing line without diagnostic formatting.
    fn timing(&self, line: &str) {
        tracing::info!(sidecar_timing = line, "sidecar timing");
    }
    /// Count actual worker operations without printing product diagnostics.
    fn operation(&self, operation: Operation, pid: u32) {
        tracing::info!(
            operation = operation.label(),
            worker = pid,
            "sidecar operation"
        );
    }
}

/// Exclusive ordered request exchange with one sidecar process.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WorkerMock))]
pub trait Worker: Send {
    /// Run hello with the exact version check and the supplied deadline.
    fn handshake(&mut self, deadline_ms: u64) -> Result<()>;
    /// Run one call, including any diagnostic frames, within its deadline.
    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult>;
    /// Report sustained memory pressure once for one slot pressure episode.
    fn memory_pressure(&self);
    /// Query the process's current resident set in bytes.
    fn resident_bytes(&self) -> Result<u64>;
}

/// Concurrent shutdown access retained while a worker has an in-flight request.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ControlMock))]
pub trait WorkerControl: Send + Sync {
    /// Read current resident memory without borrowing the request session.
    fn resident_bytes(&self) -> Result<u64>;
    /// Enqueue shutdown behind any in-flight request without blocking on its pipe.
    fn shutdown(&self) -> Result<()>;
    /// Stop the whole process tree and arrange for the child to be reaped.
    fn kill(&self) -> Result<()>;
    /// Wait until the common shutdown deadline, then kill any survivor.
    fn finish(&self, deadline: u64) -> Result<()>;
}

/// A process session and its concurrently usable shutdown handle.
pub struct Spawned {
    /// Single-owner request session.
    pub worker: Box<dyn Worker>,
    /// Process-tree lifetime control.
    pub control: Arc<dyn WorkerControl>,
}

/// A factory failure preserves whether process creation succeeded before setup failed.
#[derive(Debug, thiserror::Error)]
pub enum SpawnFailure {
    /// No child was created, so its startup admission can be released.
    #[error("[mokly-sidecar/start] no child started: {0}")]
    NotStarted(#[source] Error),
    /// A child was created, so its replacement reservation must remain.
    #[error("[mokly-sidecar/start] child started before failure: {0}")]
    Started(#[source] Error),
}

impl SpawnFailure {
    /// Return the original failure without changing the caller's error contract.
    pub fn into_error(self) -> Error {
        match self {
            Self::NotStarted(error) | Self::Started(error) => error,
        }
    }
}

/// Process creation boundary. Construct it in the binary, not in the pool.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FactoryMock))]
pub trait WorkerFactory: Send + Sync {
    /// Start one sidecar, preserving successful child creation in every failure.
    fn spawn(&self, launch: &Launch) -> std::result::Result<Spawned, SpawnFailure>;
}

/// Millisecond monotonic clock used for shared absolute deadlines.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClockMock))]
pub trait Clock: Send + Sync {
    /// Current monotonic instant, independent of wall-clock corrections.
    fn now_ms(&self) -> u64;
}
