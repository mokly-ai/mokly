//! Injectable process workers, shutdown controls, and diagnostic delivery.

use std::sync::Arc;

use crate::error::Result;
use crate::pool_options::Launch;
use crate::wire::{MethodResult, Request};

/// Diagnostics from protocol events and the process standard error stream.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = DiagnosticsMock))]
pub trait Diagnostics: Send + Sync {
    /// Forward diagnostic text to the caller's terminal reporter.
    fn emit(&self, message: &str);
}

/// Exclusive ordered request exchange with one sidecar process.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = WorkerMock))]
pub trait Worker: Send {
    /// Run hello with the exact version check and the supplied deadline.
    fn handshake(&mut self, deadline_ms: u64) -> Result<()>;
    /// Run one call, including any diagnostic frames, within its deadline.
    fn request(&mut self, request: &Request, deadline_ms: u64) -> Result<MethodResult>;
    /// Query the process's current resident set in bytes.
    fn resident_bytes(&self) -> Result<u64>;
}

/// Concurrent shutdown access retained while a worker has an in-flight request.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ControlMock))]
pub trait WorkerControl: Send + Sync {
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

/// Process creation boundary. Construct it in the binary, not in the pool.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = FactoryMock))]
pub trait WorkerFactory: Send + Sync {
    /// Start one sidecar with inherited environment and piped transport.
    fn spawn(&self, launch: &Launch) -> Result<Spawned>;
}

/// Millisecond monotonic clock used for shared absolute deadlines.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = ClockMock))]
pub trait Clock: Send + Sync {
    /// Current monotonic instant, independent of wall-clock corrections.
    fn now_ms(&self) -> u64;
}
