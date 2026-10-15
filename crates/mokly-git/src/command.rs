//! Git subprocess request and injectable runner.

use std::ffi::OsString;
use std::path::PathBuf;

use crate::error::Result;

/// Default and maximum retained bytes on each subprocess output stream.
pub const DEFAULT_OUTPUT_LIMIT: usize = 64 * 1024 * 1024;

/// One Git invocation, always executed without a shell.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Request {
    /// Checkout root.
    pub directory: PathBuf,
    /// Exact argument vector.
    pub args: Vec<OsString>,
    /// Per-stream capture bound, at most `DEFAULT_OUTPUT_LIMIT`.
    pub output_limit: usize,
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
}
