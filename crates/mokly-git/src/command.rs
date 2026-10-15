//! Git subprocess request and injectable runner.

use std::ffi::OsString;
use std::fmt;
use std::io::Write;
use std::path::PathBuf;

use crate::error::Result;

/// Default stderr capture budget, independent of exact stdout budgets.
pub const DEFAULT_STDERR_LIMIT: usize = 1024 * 1024;

/// Default and maximum retained bytes on each subprocess output stream.
pub const DEFAULT_OUTPUT_LIMIT: usize = 64 * 1024 * 1024;

/// One Git invocation, always executed without a shell.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Request {
    /// Checkout root.
    pub directory: PathBuf,
    /// Exact argument vector.
    pub args: Vec<OsString>,
    /// Bounded binary input. The runner closes stdin after these bytes.
    pub stdin: Vec<u8>,
    /// Per-stream capture bound, at most `DEFAULT_OUTPUT_LIMIT`.
    pub output_limit: usize,
    /// Independent stderr capture bound, at most `DEFAULT_OUTPUT_LIMIT`.
    pub stderr_limit: usize,
}

/// Successful bounded Git output.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Output {
    /// Standard output bytes, without Unicode conversion.
    pub stdout: Vec<u8>,
    /// Standard error bytes, without Unicode conversion.
    pub stderr: Vec<u8>,
}

/// Git process execution boundary.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = RunnerMock))]
pub trait Runner: Send + Sync {
    /// Execute one bounded Git invocation and require a successful exit.
    fn run(&self, request: &Request) -> Result<Output>;
    /// Stream standard output into SHA-256 without retaining the blob bytes.
    fn digest(&self, request: &Request) -> Result<String>;
    /// Stream exactly the proved blob size to a writer without retaining stdout.
    fn copy(&self, request: &Request, output: &mut (dyn Write + Send), bytes: usize) -> Result<()>;
    /// Execute with explicit command cancellation and process-tree cleanup.
    fn run_cancellable(&self, request: &Request, cancellation: &dyn Cancellation)
    -> Result<Output>;
}

/// Cancellation observed only while this Git operation is active.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CancellationMock))]
pub trait Cancellation: Send + Sync {
    /// Whether the command has requested cancellation.
    fn is_cancelled(&self) -> bool;
}

impl fmt::Debug for dyn Cancellation + '_ {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("Cancellation")
    }
}
